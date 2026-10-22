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
