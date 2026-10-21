import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from './quote.mjs';
// Synthetic test prices, never used by the live catalog.
const profile={id:'test',name:'Test',unit:'m2',rate:100,installationRate:20,approved:true};
const catalog={currency:'GEL',profiles:[profile]};
const input={profileId:'test',width:2,height:1.5,quantity:2,installation:true};
test('area, quantity and installation use catalog rates',()=>assert.equal(calculate(input,catalog).total,720));
test('installation excluded on request',()=>assert.equal(calculate({...input,installation:false},catalog).total,600));
test('invalid measurements and unknown profiles rejected',()=>{for(const patch of [{width:-1},{height:NaN},{quantity:1.5},{profileId:'unknown'},{installation:'true'}])assert.throws(()=>calculate({...input,...patch},catalog));});
test('unapproved or missing tariffs cannot yield an estimate',()=>{assert.throws(()=>calculate(input,{...catalog,profiles:[{...profile,approved:false}]}));assert.throws(()=>calculate(input,{...catalog,profiles:[{...profile,installationRate:null}]}));});
test('linear meters use width and quantity',()=>assert.equal(calculate(input,{...catalog,profiles:[{...profile,unit:'linear_m'}]}).total,480));
