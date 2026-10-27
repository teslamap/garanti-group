import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './ai-worker/worker.js';
import {saveGithubImage} from './ai-worker/github-images.js';
import {isProjectImageUrl, uploadProjectPhoto} from './project-upload.js';
import {validateContent} from './firebase-validation.js';

const endpoint='https://garanti-group-ai.suloanani1.workers.dev/api/upload';
const origin='https://teslamap.github.io';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const env={PROJECT_IMAGES_GITHUB_TOKEN:'test-server-only-token'};
const claims={aud:'garanti-group',iss:'https://securetoken.google.com/garanti-group',sub:'test-admin',iat:1,auth_time:1,exp:Math.floor(Date.now()/1000)+600,firebase:{sign_in_provider:'password'}};
const token=[Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url'),Buffer.from(JSON.stringify(claims)).toString('base64url'),'test'].join('.');
const req=(bytes=Buffer.from(image.split(',')[1],'base64'))=>{
 const form=new FormData(); form.append('file',new Blob([bytes],{type:'image/png'}),'photo.png');
 return new Request(endpoint,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token},body:form});
};
const sha='a'.repeat(40);

test('admin client uploads real bytes to fixed GitHub repository and can publish returned URL',async()=>{
 const oldFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;
  if(String(url).startsWith('https://firestore.googleapis.com/'))return Response.json({fields:{active:{booleanValue:true}}});
  assert.match(url,/^https:\/\/api.github.com\/repos\/teslamap\/garanti-group\/contents\/uploads\/projects\/[a-f0-9-]{36}\.png$/);
  assert.equal(options.method,'PUT');assert.equal(options.headers.Authorization,'Bearer test-server-only-token');
  const data=JSON.parse(options.body);assert.equal(data.branch,'main');assert.equal(data.sha,undefined);
  assert.deepEqual(Buffer.from(data.content,'base64'),Buffer.from(image.split(',')[1],'base64'));
  return Response.json({commit:{sha},content:{path:url.split('/contents/')[1]}},{status:201});
 };
 try{
  const url=await uploadProjectPhoto(image,{getIdToken:async()=>token},endpoint,async(url,options)=>worker.fetch(new Request(url,{...options,headers:{...options.headers,Origin:origin}}),env));
  assert.equal(calls,2);assert.ok(isProjectImageUrl(url));assert.match(url,new RegExp('/'+sha+'/uploads/projects/'));
  validateContent({texts:{},links:{},projects:[{title:'Photo',category:'',description:'',photos:[url]}]});
 }finally{globalThis.fetch=oldFetch;}
});

test('production upload denies non-admins before GitHub and validates image signatures',async()=>{
 const oldFetch=globalThis.fetch;let active=false,calls=0;
 globalThis.fetch=async url=>{calls++;assert.match(String(url),/^https:\/\/firestore.googleapis.com\//);return Response.json({fields:{active:{booleanValue:active}}});};
 try{
  assert.equal((await worker.fetch(req(),env)).status,403);assert.equal(calls,1);
  active=true;assert.equal((await worker.fetch(req(Buffer.from('not an image')),env)).status,400);assert.equal(calls,2);
  const missing=await worker.fetch(req(),{});assert.equal(missing.status,503);assert.equal((await missing.json()).error,'GITHUB_STORAGE_NOT_CONFIGURED');assert.equal(calls,3);
 }finally{globalThis.fetch=oldFetch;}
});

test('GitHub errors and malformed responses never return a successful URL or upstream secrets',async()=>{
 for(const status of [200,401,403,409,422,500]){
  await assert.rejects(saveGithubImage(new Uint8Array([1]),'png',env,async()=>new Response('private upstream details',{status})),e=>e.message.startsWith('GITHUB_STORAGE_')&&!e.message.includes('private'));
 }
 await assert.rejects(saveGithubImage(new Uint8Array([1]),'png',env,async()=>Response.json({commit:{sha},content:{path:'other.png'}},{status:201})),/GITHUB_STORAGE_UPLOAD_FAILED/);
});

test('GitHub project image URLs and legacy URLs are validated safely', () => {
  const uuid = '12345678-1234-1234-1234-123456789012';

  const good = `https://raw.githubusercontent.com/teslamap/garanti-group/${sha}/uploads/projects/${uuid}.png`;

  const mainUrl = `https://raw.githubusercontent.com/teslamap/garanti-group/main/projects/${uuid}.png`;

  assert.equal(isProjectImageUrl(good), true);
  assert.equal(isProjectImageUrl(mainUrl), true);

  const invalid = [
    good.replace('teslamap', 'other'),
    good + '?token=secret',
    good.replace('.png', '.svg'),
    good.replace(
      'raw.githubusercontent.com',
      'raw.githubusercontent.com.evil.example'
    )
  ];

  for (const url of invalid) {
    assert.equal(isProjectImageUrl(url), false);
  }

  assert.equal(
    isProjectImageUrl(
      'https://test.supabase.co/storage/v1/object/public/project-images/projects/old.png'
    ),
    true
  );
});

test('health reports GitHub readiness without exposing token',async()=>{
 const r=await worker.fetch(new Request('https://worker.example/health'),env);
 const body=await r.json();assert.equal(body.projectImageProvider,'github');assert.equal(body.projectImagesConfigured,true);assert.ok(!JSON.stringify(body).includes(env.PROJECT_IMAGES_GITHUB_TOKEN));
});
