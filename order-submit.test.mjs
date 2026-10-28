import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function setup(collect = async () => ({name:'Test'})) {
  const source = readFileSync(new URL('./upgrade.js', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf(" $('#order-form').onsubmit="), source.indexOf(" $('#download-order').onclick="));
  const button = {disabled:false}, status = {textContent:''}, states = [];
  let resolve, reject, calls = 0, resets = 0;
  const pending = new Promise((yes, no) => {resolve = yes; reject = no;});
  const form = {
    reset() {resets++;},
    dispatchEvent(event) {states.push(event.detail);}
  };
  const items = {replaceChildren() {}};
  vm.runInNewContext(handler, {
    $: selector => ({'#order-form':form, '[type=submit]':button, '#order-status':status, '#items':items})[selector],
    collect, api: () => {calls++; return pending;}, addItem() {},
    CustomEvent: class {constructor(type, options) {this.type=type; this.detail=options.detail;}}
  });
  return {form, button, status, states, resolve, reject, calls:()=>calls, resets:()=>resets,
    submit:()=>form.onsubmit({preventDefault(){}, target:form})};
}

test('pending order blocks repeated submissions and reports success after reset', async () => {
  const s = setup(), first = s.submit();
  await s.submit();
  assert.equal(s.calls(), 1);
  assert.equal(s.button.disabled, true);
  s.resolve({id:'order-123'});
  await first;
  assert.equal(s.resets(), 1);
  assert.match(s.status.textContent, /order-123/);
  assert.deepEqual(s.states, ['sending','success','idle']);
  assert.equal(s.button.disabled, false);
});

test('failed order preserves the draft and allows a retry', async () => {
  const s = setup(), first = s.submit();
  await Promise.resolve();
  s.reject(Error('Connection failed'));
  await first;
  assert.equal(s.resets(), 0);
  assert.equal(s.status.textContent, 'Connection failed');
  assert.deepEqual(s.states, ['sending','idle']);
  assert.equal(s.button.disabled, false);
});

test('invalid order restores controls without sending', async () => {
  const s = setup(async () => undefined);
  await s.submit();
  assert.equal(s.calls(), 0);
  assert.equal(s.resets(), 0);
  assert.deepEqual(s.states, ['sending','idle']);
  assert.equal(s.button.disabled, false);
});

test('wizard keeps confirmation visible even if the dialog was closed during sending', () => {
  const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
  const wizard = html.slice(html.indexOf('<script id="gg-wizard-integration">'));
  const render = wizard.slice(wizard.indexOf('function render(){')+'function render(){'.length, wizard.indexOf('setVisibility(controls,true);'));
  const controls = {}, status = {}, heading = {}, subtitle = {}, fields = [{}];
  const visibility = new Map();
  const run = vm.runInNewContext('(function(){'+render+'})', {
    completed:true, contact:{}, consent:{}, note:{}, form:{}, items:{}, controls, status, heading, subtitle,
    q:()=>({}), all:()=>fields, setVisibility:(element, visible)=>visibility.set(element,visible)
  });
  run();
  assert.equal(visibility.get(status), true);
  assert.equal(visibility.get(controls), false);
  assert.equal(visibility.get(fields[0]), false);
  assert.equal(heading.textContent, 'შეკვეთა მიღებულია');
});
