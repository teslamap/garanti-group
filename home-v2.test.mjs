import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('CMS excludes wizard markup and preserves legacy positions plus explicit V2 keys', () => {
  const source = readFileSync(new URL('./upgrade.js', import.meta.url), 'utf8');
  const binding = source.slice(source.indexOf('function bindTexts('), source.indexOf('function bindLinks('));
  const nodes = [
    {dataset:{}, textContent:'Wizard', closest:()=>true},
    {dataset:{}, textContent:'Legacy navigation', closest:()=>false},
    {dataset:{cmsKey:'v2-headline'}, textContent:'V2 headline', closest:()=>false},
    {dataset:{}, textContent:'Legacy paragraph', closest:()=>false}
  ];
  const doc = {querySelectorAll:s=>s==='[data-cms-key]'?nodes.filter(n=>n.dataset.cmsKey):nodes};
  const bind = vm.runInNewContext(binding+';bindTexts');
  const result = bind(doc);
  assert.equal(nodes[0].dataset.cmsKey, undefined);
  assert.equal(result['text-0'], 'Legacy navigation');
  assert.equal(result['v2-headline'], 'V2 headline');
  assert.equal(result['text-2'], 'Legacy paragraph');
});

test('project detail photos render as one keyboard and arrow navigable carousel', () => {
  const source = readFileSync(new URL('./upgrade.js', import.meta.url), 'utf8');
  assert.match(source, /className='project-carousel'/);
  assert.match(source, /project-carousel-prev/);
  assert.match(source, /project-carousel-next/);
  assert.match(source, /project-carousel-dots/);
  assert.match(source, /e\.key==='ArrowLeft'/);
  assert.match(source, /e\.key==='ArrowRight'/);
  assert.doesNotMatch(source, /პროექტის დეტალები/);
});
