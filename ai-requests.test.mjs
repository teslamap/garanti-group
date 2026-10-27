import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import worker from './ai-worker/worker.js';
import {commercialIntent,phoneFrom,contactReply,saveInquiry,requestId} from './ai-worker/inquiries.js';
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
test('Georgian phone formats normalize consistently without accepting foreign numbers or measurements',()=>{
 for(const phone of ['598123030','598 12 30 30','598-123-030','598.12.30.30','(598) 12 30 30','+995598123030','+995 (598) 12-30-30','995 598 12 30 30','00995 598 12 30 30','0 598 12 30 30','+995 (0) 598 12 30 30','５９８１２３０３０','598\u00a012\u00a030\u00a030'])assert.equal(phoneFrom(phone),'+995598123030',phone);
 for(const phone of ['032 212 34 56','+995 32 2123456','00995 (32) 212-34-56'])assert.equal(phoneFrom(phone),'+995322123456',phone);
 assert.equal(phoneFrom('0422 12 34 56'),'+995422123456');
 for(const value of ['+1 555 123 4567','+44 598123030','123456789','59812303099','1200 x 1500','1200×1500 მმ'])assert.equal(phoneFrom(value),'',value);
 assert.equal(phoneFrom('ძველი: 598123030\nახალი: 599 12 34 56'),'+995599123456');
 assert.equal(contactReply([{role:'assistant',content:'დაგვიტოვეთ ტელეფონის ნომერი, რომ დაგიკავშირდეთ.'},{role:'user',content:'598 12 30 30'}]),true);
});
const chat=(body,headers={})=>new Request('https://example.test/api/chat',{method:'POST',headers:{Origin:'https://teslamap.github.io','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('phone-only reply to assistant contact request creates inquiry without classifier and updates the same record',async()=>{
 const db=database();const env={INQUIRIES:db,AI:{async run(model,input){assert.notEqual(input.max_tokens,8,'contact reply must not depend on AI classification');return {response:'გმადლობთ.'}}}};
 const body={conversationId:crypto.randomUUID(),message:'00995 (598) 12-30-30',history:[{role:'user',content:'გამარჯობა'},{role:'assistant',content:'დაგვიტოვეთ ნომერი, რომ დაგიკავშირდეთ.'}]};
 const response=await worker.fetch(chat(body),env);assert.equal(response.status,200);assert.equal((await response.json()).inquiry.state,'saved');
 await worker.fetch(chat(body),env);
 const row=db.sqlite.prepare('SELECT * FROM ai_requests').get();assert.equal(row.phone,'+995598123030');assert.equal(row.message_count,4);assert.match(row.transcript,/დაგვიტოვეთ/);
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM ai_requests').get().n,1);
});
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
  globalThis.fetch=async(url,options)=>{assert.equal(options.redirect,'manual','Cloudflare only supports follow or manual redirects');return Response.json({fields:{active:{booleanValue:active}}})};
  assert.equal((await worker.fetch(request('GET',null,token),env)).status,403);
  active=true;assert.equal((await (await worker.fetch(request('GET',null,token),env)).json()).requests.length,1);
  const verifyFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Response(null,{status:302,headers:{Location:'https://example.test/untrusted'}});
  assert.equal((await worker.fetch(request('GET',null,token),env)).status,503,'redirected authorization must fail closed');
  globalThis.fetch=verifyFetch;
  assert.equal((await worker.fetch(request('PATCH',{id,status:'ADMIN'},token),env)).status,400);
  assert.equal((await worker.fetch(request('PATCH',{id,status:'დასრულებული'},token),env)).status,200);
  assert.equal((await worker.fetch(request('DELETE',{id},token),env)).status,200);
  assert.equal((await (await worker.fetch(request('GET',null,token),env)).json()).requests.length,0);
  assert.equal(db.sqlite.prepare('SELECT transcript FROM ai_requests').get().transcript,'[]');
 }finally{globalThis.fetch=original}
});
