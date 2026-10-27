import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import worker from './ai-worker/worker.js';
import {commercialIntent,phoneFrom,saveInquiry,requestId} from './ai-worker/inquiries.js';
const schema=await readFile(new URL('./ai-worker/schema.sql',import.meta.url),'utf8');
function database(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(schema);
 return {sqlite,prepare(sql){return {bind(...args){
  const stmt=sqlite.prepare(sql);
  return {async first(){return stmt.get(...args)||null},async all(){return {results:stmt.all(...args)}},async run(){return {meta:{changes:Number(stmt.run(...args).changes)}}}};
 }}}};
}
const transcript=[{role:'user',content:'მინდა ფანჯრის შეკვეთა, დამირეკეთ +995 598 12 30 30'},{role:'assistant',content:'რა ზომის ფანჯარა გსურთ?'}];
test('commercial intent and phone extraction cover Georgian, transliteration and English',()=>{
 for(const text of ['მინდა აივნის შემინვა','mchirdeba fanjara','Please quote for a balcony','აზომვა მინდა'])assert.ok(commercialIntent(text));
 assert.equal(commercialIntent('გამარჯობა'),false);
 assert.equal(phoneFrom(transcript[0].content),'+995598123030');
 assert.equal(phoneFrom('ზომა 1200 x 1500 მმ'), '');
});
test('SQL upsert deduplicates retries, preserves managed status, avoids stale overwrite and erases personal data',async()=>{
 const db=database(),id=await requestId('test-conversation');
 assert.equal((await saveInquiry(db,id,transcript,true)).state,'saved');
 db.sqlite.prepare('UPDATE ai_requests SET status=? WHERE id=?').run('დაკავშირება',id);
 await saveInquiry(db,id,transcript,true);
 await saveInquiry(db,id,[...transcript,{role:'user',content:'მონტაჟიც მჭირდება'}],false);
 await saveInquiry(db,id,transcript,true);
 const row=db.sqlite.prepare('SELECT * FROM ai_requests').get();
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS n FROM ai_requests').get().n,1);
 assert.equal(row.status,'დაკავშირება');assert.equal(row.message_count,3);assert.match(row.transcript,/მონტაჟიც/);
 db.sqlite.prepare("UPDATE ai_requests SET deleted=1,phone='',summary='',transcript='[]' WHERE id=?").run(id);
 assert.equal((await saveInquiry(db,id,transcript,true)).state,'removed');
 assert.equal(db.sqlite.prepare('SELECT phone FROM ai_requests').get().phone,'');
});
const chat=(body,headers={})=>new Request('https://example.test/api/chat',{method:'POST',headers:{Origin:'https://teslamap.github.io','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('Worker records inquiry before AI failure, retries update one row, ordinary greetings are not saved',async()=>{
 const db=database();let fail=true;
 const env={INQUIRIES:db,AI:{async run(model,input){if(input.max_tokens===8)return {response:'NO'};if(fail)throw Error('offline');return {response:'რა ზომის გსურთ?'}}}};
 const body={conversationId:crypto.randomUUID(),message:transcript[0].content,history:[]};
 assert.equal((await worker.fetch(chat(body),env)).status,502);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,1);
 fail=false;const response=await worker.fetch(chat(body),env);assert.equal(response.status,200);assert.equal((await response.json()).inquiry.state,'saved');
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,1);
 const greeting=await worker.fetch(chat({conversationId:crypto.randomUUID(),message:'გამარჯობა',history:[]}),env);
 assert.equal((await greeting.json()).inquiry.state,'none');
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,1);
 assert.equal((await worker.fetch(chat({...body,history:Array(41).fill(transcript[0])}),env)).status,400);
 assert.equal((await worker.fetch(chat(body,{Origin:'https://evil.test'}),env)).status,403);
 for(let n=0;n<20;n++)await worker.fetch(chat(body),env);
 assert.equal((await worker.fetch(chat(body),env)).status,429);
});
test('admin endpoints reject unauthenticated access and enforce verified active admin and allowed statuses',async()=>{
 const db=database(),env={INQUIRIES:db},id=await requestId('admin-test');await saveInquiry(db,id,transcript,true);
 const request=(method='GET',body,token)=>new Request('https://example.test/api/inquiries',{method,headers:token?{Authorization:'Bearer '+token}:{},body:body?JSON.stringify(body):undefined});
 assert.equal((await worker.fetch(request(),env)).status,401);
 const now=Math.floor(Date.now()/1000);
 const token=[{alg:'RS256',kid:'test'},{aud:'garanti-group',iss:'https://securetoken.google.com/garanti-group',sub:'test-admin',exp:now+3600,iat:now,auth_time:now,firebase:{sign_in_provider:'password'}}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.signature';
 const original=globalThis.fetch;let active=false;
 try{
  globalThis.fetch=async()=>Response.json({fields:{active:{booleanValue:active}}});
  assert.equal((await worker.fetch(request('GET',null,token),env)).status,403);
  active=true;assert.equal((await (await worker.fetch(request('GET',null,token),env)).json()).requests.length,1);
  assert.equal((await worker.fetch(request('PATCH',{id,status:'ADMIN'},token),env)).status,400);
  assert.equal((await worker.fetch(request('PATCH',{id,status:'დასრულებული'},token),env)).status,200);
  assert.equal((await worker.fetch(request('DELETE',{id},token),env)).status,200);
  assert.equal((await (await worker.fetch(request('GET',null,token),env)).json()).requests.length,0);
  assert.equal(db.sqlite.prepare('SELECT transcript FROM ai_requests').get().transcript,'[]');
 }finally{globalThis.fetch=original}
});
