import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('./upgrade.js',import.meta.url),'utf8');
test('admin page initializes with Firebase config and wires all controls before login',()=>{
 const elements=new Map(['#login','#admin-status','#save-content','#save-projects','#add-project','#refresh-orders','#logout'].map(id=>[id,{}]));
 const document={querySelector:s=>elements.get(s)||null};
 vm.runInNewContext(source,{window:{GG_CONFIG:{firebase:{projectId:'garanti-group'}}},document,location:{reload(){}},AbortSignal},{filename:'upgrade.js'});
 assert.match(elements.get('#admin-status').textContent,/Firebase/);
 assert.equal(typeof elements.get('#login').onsubmit,'function');
 assert.equal(typeof elements.get('#save-content').onclick,'function');
 assert.equal(typeof elements.get('#refresh-orders').onclick,'function');
});

test('admin renders searchable orders, updates counts and restores a rejected status',async()=>{
 const nodes=new Map();
 const make=tag=>({tag,children:[],dataset:{},disabled:false,append(n){this.children.push(n)},replaceChildren(){this.children=[]},querySelectorAll(){return []}});
 for(const id of ['#login','#dashboard','#admin-status','#save-content','#save-projects','#add-project','#refresh-orders','#logout','#project-count','#order-count','#text-editor','#project-editor','#orders'])nodes.set(id,make('div'));
 const data={texts:{},links:{},projects:[]};let rejectStatus=false;
 const document={querySelector:s=>nodes.get(s)||null,createElement:make};
 const fetch=async(url,options)=>{
  if(url==='index.html')return {text:async()=>''};
  if(url.endsWith('/login'))return {ok:true,json:async()=>({token:'test'})};
  if(url.endsWith('/content'))return {ok:true,json:async()=>structuredClone(data)};
  if(options.method==='PUT'){rejectStatus=true;return {ok:false,json:async()=>({error:'save failed'})}}
  return {ok:true,json:async()=>[{id:'order-1',status:'ახალი',created:'2026-10-27T00:00:00Z',value:{name:'Test',phone:'555123456',address:'',notes:'',items:[]}}]};
 };
 vm.runInNewContext(source,{window:{GG_CONFIG:{apiBase:'https://test.example'}},document,fetch,AbortSignal,location:{reload(){}},DOMParser:class{parseFromString(){return {querySelectorAll:()=>[]}}}},{filename:'upgrade.js'});
 await nodes.get('#login').onsubmit({preventDefault(){},target:{elements:{email:{value:'test@example.com'},password:{value:'test'}},reset(){}}});
 assert.equal(nodes.get('#project-count').textContent,'0');assert.equal(nodes.get('#order-count').textContent,'1');
 const row=nodes.get('#orders').children[0];assert.equal(row.dataset.orderId,'order-1');
 const select=row.children.find(n=>n.tag==='select');select.value='დასრულებული';await select.onchange();
 assert.ok(rejectStatus);assert.equal(select.value,'ახალი');assert.equal(select.disabled,false);assert.equal(nodes.get('#admin-status').textContent,'save failed');
});
