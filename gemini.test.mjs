import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateGemini} from './gemini.mjs';
const response=status=>({status,ok:status===200,json:async()=>status===200?{candidates:[]}:{error:{status:'UNAVAILABLE'}}});
test('retries temporary failure and returns actual successful response',async()=>{let calls=0;const result=await generateGemini({}, {key:'test',fetchImpl:async()=>response(++calls===1?503:200),wait:async()=>{}});assert.equal(result.ok,true);assert.equal(calls,2);});
test('unavailable model switches to documented free fallback',async()=>{const urls=[];const result=await generateGemini({}, {key:'test',fetchImpl:async url=>{urls.push(url);return response(urls.length<3?503:200);},wait:async()=>{}});assert.equal(result.ok,true);assert.match(urls[2],/gemini-3.5-flash-lite/);});
test('invalid key and quota errors are not retried',async()=>{for(const status of [400,401,403,429]){let calls=0;const result=await generateGemini({}, {key:'test',fetchImpl:async()=>{calls++;return response(status);},wait:async()=>{}});assert.equal(result.status,status);assert.equal(calls,1);}});
test('all temporary failures stop after four attempts',async()=>{let calls=0;const result=await generateGemini({}, {key:'test',fetchImpl:async()=>{calls++;return response(503);},wait:async()=>{}});assert.equal(result.ok,false);assert.equal(calls,4);});
