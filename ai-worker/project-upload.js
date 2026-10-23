const ORIGIN='https://teslamap.github.io';
const PROJECT='garanti-group';
const MAX_FILE=1500000,MAX_BODY=MAX_FILE+16384;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});

async function limitedBody(request){
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();
 const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();throw Error('TOO_LARGE')}chunks.push(value)}}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes;
}

// Decoding is NOT verification. Firestore below verifies this Firebase ID token
// and enforces the deployed self-only admins/{uid} read rule before trusting it.
async function activeAdmin(token,fetcher){
 let claims;
 try{const parts=token.split('.');if(parts.length!==3)return false;claims=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return false}
 const now=Math.floor(Date.now()/1000);
 if(claims.aud!==PROJECT||claims.iss!==`https://securetoken.google.com/${PROJECT}`||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>128||claims.sub.includes('/')||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now||claims.firebase?.sign_in_provider==='anonymous')return false;
 const role=await fetcher(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/admins/${encodeURIComponent(claims.sub)}`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000),redirect:'error'});
 if([401,403,404].includes(role.status))return false;
 if(!role.ok)throw Error('AUTH_UNAVAILABLE');
 return (await role.json()).fields?.active?.booleanValue===true;
}

function imageType(bytes){
 if(bytes.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return ['image/png','png'];
 if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return ['image/jpeg','jpg'];
 if(bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP')return ['image/webp','webp'];
 return null;
}

export async function projectUpload(request,env,fetcher=fetch){
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==ORIGIN)return json({error:'ORIGIN_DENIED'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return json({error:'METHOD_NOT_ALLOWED'},405);
 const authorization=request.headers.get('Authorization')||'';
 if(!/^Bearer [A-Za-z0-9._-]+$/.test(authorization)||authorization.length>8192)return json({error:'AUTH_REQUIRED'},401);
 try{
  if(!await activeAdmin(authorization.slice(7),fetcher))return json({error:'ADMIN_REQUIRED'},403);
  // Never accept a project URL, bucket, object path or credentials from a client.
  const supabase=new URL(env.SUPABASE_URL);
  if(supabase.protocol!=='https:'||! /^[a-z0-9-]+\.supabase\.co$/.test(supabase.hostname)||supabase.username||supabase.password||supabase.port||supabase.pathname!=='/'||supabase.search||supabase.hash||!env.SUPABASE_SERVICE_ROLE_KEY)return json({error:'STORAGE_NOT_CONFIGURED'},503);
  if(Number(request.headers.get('Content-Length'))>MAX_BODY)return json({error:'TOO_LARGE'},413);
  if(!request.headers.get('Content-Type')?.startsWith('multipart/form-data;'))return json({error:'MULTIPART_REQUIRED'},400);
  const body=await limitedBody(request);
  const form=await new Response(body,{headers:{'Content-Type':request.headers.get('Content-Type')}}).formData();
  const file=form.get('file');
  if([...form.keys()].length!==1||!(file instanceof File)||!file.size||file.size>MAX_FILE)return json({error:'INVALID_FILE'},400);
  const bytes=new Uint8Array(await file.arrayBuffer()),type=imageType(bytes);
  if(!type||file.type!==type[0])return json({error:'INVALID_IMAGE'},400);
  const path=`projects/${crypto.randomUUID()}.${type[1]}`;
  const response=await fetcher(`${supabase.origin}/storage/v1/object/project-images/${path}`,{method:'POST',headers:{Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,apikey:env.SUPABASE_SERVICE_ROLE_KEY,'Content-Type':type[0],'x-upsert':'false'},body:bytes,signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok)return json({error:'STORAGE_UPLOAD_FAILED'},502);
  return json({url:`${supabase.origin}/storage/v1/object/public/project-images/${path}`});
 }catch(error){return json({error:error.message==='TOO_LARGE'?'TOO_LARGE':'UPLOAD_UNAVAILABLE'},error.message==='TOO_LARGE'?413:503)}
}
