import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadProjectPhoto,isProjectImageUrl} from './project-upload.js';
import {projectUpload} from './ai-worker/project-upload.js';
import worker from './ai-worker/worker.js';
import {validateContent} from './firebase-validation.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const origin='https://teslamap.github.io',endpoint='https://worker.example/api/upload';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const env={SUPABASE_URL:'https://testproject.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'server-only-secret'};
const claims={aud:'garanti-group',iss:'https://securetoken.google.com/garanti-group',sub:'admin-user',iat:Math.floor(Date.now()/1000)-1,exp:Math.floor(Date.now()/1000)+600,firebase:{sign_in_provider:'password'}};
// Deliberately unsigned fixture: only the mocked Firestore can accept it.
// A real Firestore rejects it (also checked against production separately).
const token=(extra={})=>['eyJhbGciOiJSUzI1NiJ9',Buffer.from(JSON.stringify({...claims,...extra})).toString('base64url'),'fake-signature'].join('.');
const user={getIdToken:async force=>{assert.equal(force,true);return token()}};
const request=(authorization=token(),photo=image)=>{const f=new FormData();f.append('file',new Blob([Buffer.from(photo.split(',')[1],'base64')],{type:photo.split(';')[0].slice(5)}),'photo.png');return new Request(endpoint,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+authorization},body:f})};

test('client -> Worker -> Supabase upload contract, then content accepts the public URL',async()=>{
 const calls=[];
 const upstream=async(url,options)=>{
  calls.push(url);
  if(url.startsWith('https://firestore.googleapis.com/')){assert.match(url,/\/admins\/admin-user$/);assert.equal(options.headers.Authorization,'Bearer '+token());return Response.json({fields:{active:{booleanValue:true}}})}
  assert.match(url,/^https:\/\/testproject.supabase.co\/storage\/v1\/object\/project-images\/projects\/[a-f0-9-]+\.png$/);
  assert.equal(options.headers.Authorization,'Bearer server-only-secret');assert.equal(options.headers['x-upsert'],'false');assert.equal(options.headers['Content-Type'],'image/png');assert.deepEqual(Buffer.from(options.body),Buffer.from(image.split(',')[1],'base64'));
  return Response.json({Key:'stored'});
 };
 const url=await uploadProjectPhoto(image,user,endpoint,async(url,options)=>{assert.equal(options.body.get('file').type,'image/png');assert.equal(options.headers['Content-Type'],undefined);return projectUpload(new Request(url,{...options,headers:{...options.headers,Origin:origin}}),env,upstream)});
 assert.equal(calls.length,2);assert.ok(isProjectImageUrl(url));
 assert.doesNotThrow(()=>validateContent({texts:{},links:{},projects:[{title:'Project',category:'',description:'',photos:[url]}]}));
});

test('server denies missing auth, anonymous, wrong audience, forged/rejected token, inactive role and claim-only admins',async()=>{
 assert.equal((await projectUpload(new Request(endpoint,{method:'POST'}),env)).status,401);
 for(const extra of [{aud:'other'},{iss:'https://evil.example'},{exp:1},{sub:'../other'},{firebase:{sign_in_provider:'anonymous'}}]){
  assert.equal((await projectUpload(request(token(extra)),env,()=>assert.fail('must not call upstream'))).status,403);
 }
 for(const response of [new Response('',{status:401}),new Response('',{status:403}),new Response('',{status:404}),Response.json({fields:{active:{booleanValue:false}}}),Response.json({fields:{active:{stringValue:'true'}}})]){
  assert.equal((await projectUpload(request(token({admin:true})),env,async()=>response)).status,403);
 }
});

test('server fails closed on role service failure, bad origin, bad MIME, huge stream and Supabase failure',async()=>{
 assert.equal((await projectUpload(request(),env,async()=>new Response('',{status:500}))).status,503);
 const wrongOrigin=new Request(request(),{headers:{Origin:'https://evil.example'}});
 assert.equal((await projectUpload(wrongOrigin,env)).status,403);
 const active=async()=>Response.json({fields:{active:{booleanValue:true}}});
 assert.equal((await projectUpload(request(token(),'data:image/png;base64,SGVsbG8='),env,active)).status,400);
 const oversized=new Request(endpoint,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token(),'Content-Type':'multipart/form-data; boundary=x'},body:new Uint8Array(1516385)});
 assert.equal((await projectUpload(oversized,env,active)).status,413);
 let n=0;const failure=await projectUpload(request(),env,async()=>++n===1?active():new Response('secret details',{status:500}));
 assert.equal(failure.status,502);assert.doesNotMatch(await failure.text(),/secret/);
});

test('client preserves authorization errors, rejects foreign/bucket URLs and does not expose server keys',async()=>{
 for(const status of [401,403,500])await assert.rejects(uploadProjectPhoto(image,user,endpoint,async()=>Response.json({error:'failure'},{status})));
 for(const url of ['https://evil.example/a.png','https://testproject.supabase.co/storage/v1/object/public/private-orders/a.png','https://testproject.supabase.co.evil.example/storage/v1/object/public/project-images/a.png','https://testproject.supabase.co/storage/v1/object/public/project-images/a.svg']){
  assert.equal(isProjectImageUrl(url),false);await assert.rejects(uploadProjectPhoto(image,user,endpoint,async()=>Response.json({url})));
 }
});

test('upload preflight allows Authorization; existing AI chat route keeps its contract',async()=>{
 const preflight=await worker.fetch(new Request(endpoint,{method:'OPTIONS',headers:{Origin:origin}}),env);
 assert.equal(preflight.status,204);assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/Authorization/);
 const chat=await worker.fetch(new Request('https://worker.example/api/chat',{method:'POST',headers:{Origin:origin},body:JSON.stringify({messages:[{role:'user',content:'გამარჯობა'}]})}),{AI:{run:async()=>({response:'გამარჯობა!'})}});
 assert.deepEqual(await chat.json(),{question:'გამარჯობა!',quote:null});
});

test('Firebase publish keeps completed URLs across retries and never writes partial content',async()=>{
 const source=(await readFile(new URL('./firebase-client.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
 let uploads=0,writes=0,failUpload=true,failWrite=false;
 const context={window:{GG_CONFIG:{firebase:{},storageEnabled:false,projectUploadUrl:endpoint},addEventListener(){}},
  initializeApp:()=>({}),getAuth:()=>({currentUser:{uid:'admin-user',isAnonymous:false}}),getFirestore:()=>({}),getStorage:()=>({}),setPersistence:async()=>{},inMemoryPersistence:{},
  doc:()=>({}),getDoc:async()=>({exists:()=>true,data:()=>({active:true})}),validateContent,structuredClone,TextEncoder,URL,
  setDoc:async(_ref,data)=>{if(failWrite)throw Error('database unavailable');assert.equal(data.projects[0].photos.length,2);writes++},
  uploadProjectPhoto:async(_photo,_user,url)=>{assert.equal(url,endpoint);uploads++;if(failUpload&&uploads===2)throw Error('upload interrupted');return `https://testproject.supabase.co/storage/v1/object/public/project-images/projects/image${uploads}.png`}};
 vm.createContext(context);vm.runInContext(source+'\nglobalThis.api=firebaseApi;',context);
 const data={texts:{},links:{},projects:[{title:'Project',category:'',description:'',photos:[image,image]}]};
 await assert.rejects(context.api('content','PUT',data),/upload interrupted/);assert.equal(writes,0);assert.ok(isProjectImageUrl(data.projects[0].photos[0]));assert.equal(data.projects[0].photos[1],image);
 failUpload=false;failWrite=true;await assert.rejects(context.api('content','PUT',data),/database unavailable/);assert.equal(uploads,3);assert.equal(writes,0);
 failWrite=false;await context.api('content','PUT',data);assert.equal(uploads,3);assert.equal(writes,1);
});
