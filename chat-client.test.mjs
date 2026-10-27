import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import worker from './ai-worker/worker.js';
const source=await readFile(new URL('./chat-client.js',import.meta.url),'utf8');

function chat(fetcher){
 const nodes=new Map();
 const element=()=>({value:'',disabled:false,textContent:'',children:[],classList:{contains:()=>false,toggle(){}},setAttribute(){},addEventListener(type,fn){this[type]=fn},querySelector(){return element()},querySelectorAll(){return []},append(n){this.children.push(n)},focus(){}});
 for(const id of ['gg-chat-toggle','gg-chat-panel','gg-chat-messages','gg-chat-form','gg-chat-input','gg-chat-send'])nodes.set(id,element());
 vm.runInNewContext(source,{document:{getElementById:id=>nodes.get(id),createElement:element,addEventListener(){}},fetch:fetcher,AbortSignal});
 return {nodes,ask:async value=>{nodes.get('gg-chat-input').value=value;nodes.get('gg-chat-form').submit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve))}};
}
test('website chat preserves the production request contract and successful history',async()=>{
 const calls=[];const ui=chat(async(_url,options)=>{calls.push(JSON.parse(options.body));assert.ok(options.signal);return Response.json({reply:'გამარჯობა!'})});
 await ui.ask('გამარჯობა');await ui.ask('ალუმინის კარი მინდა');
 assert.deepEqual(calls[0],{message:'გამარჯობა',history:[]});
 assert.equal(calls[1].history.length,2);assert.equal(ui.nodes.get('gg-chat-send').disabled,false);
 assert.equal(ui.nodes.get('gg-chat-messages').children.at(-1).textContent,'გამარჯობა!');
});
test('failed chat replies do not enter history; quota errors are understandable',async()=>{
 let count=0;const calls=[];const ui=chat(async(_url,options)=>{calls.push(JSON.parse(options.body));return ++count===1?Response.json({error:'RATE_LIMIT'},{status:429}):Response.json({question:'პასუხი'})});
 await ui.ask('გამარჯობა');assert.match(ui.nodes.get('gg-chat-messages').children.at(-1).textContent,/ლიმიტი/);
 await ui.ask('ხელახლა');assert.deepEqual(calls[1].history,[]);assert.equal(ui.nodes.get('gg-chat-messages').children.at(-1).textContent,'პასუხი');
});
test('Worker accepts the website format, preserves history, and exposes actual health settings',async()=>{
 const env={AI_MODEL:'configured-model',AI:{run:async(model,input)=>{assert.equal(model,'configured-model');assert.equal(input.messages.at(-1).content,'კარი მინდა');assert.equal(input.messages.length,4);return {response:'რა ზომის?'}}}};
 const result=await worker.fetch(new Request('https://worker.example/api/chat',{method:'POST',body:JSON.stringify({message:'კარი მინდა',history:[{role:'user',content:'გამარჯობა'},{role:'assistant',content:'გამარჯობა!'}]})}),env);
 assert.deepEqual(await result.json(),{reply:'რა ზომის?'});
 const health=await (await worker.fetch(new Request('https://worker.example/health'),env)).json();assert.equal(health.model,'configured-model');assert.equal(health.storageConfigured,false);
 for(const body of [null,{message:'გამარჯობა',history:{}},{message:' '},{message:'x',history:[{role:'system',content:'bad'}]}])assert.equal((await worker.fetch(new Request('https://worker.example/api/chat',{method:'POST',body:JSON.stringify(body)}),env)).status,400);
});
