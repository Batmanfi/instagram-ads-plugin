import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHighlight} from './instagram-highlight.mjs';
const make = widths => buildHighlight({textWidths: widths, rowHeight: 60, paddingX: 20, paddingY: 12, outerRadius: 14, innerRadius: 12, mergeThreshold: 4});
test('single line has four convex arcs and exact padding', () => {
  const g = make([300]); assert.equal(g.width, 340); assert.equal(g.height, 84);
  assert.equal((g.d.match(/ A /g) ?? []).length, 4); assert.ok(!g.d.includes('NaN'));
});
test('equal adjacent lines make one rounded rectangle', () => {
  const g = make([300,300,300]); assert.equal(g.height, 204);
  assert.equal((g.d.match(/ A /g) ?? []).length, 4);
});
test('width changes produce both convex and concave circular corners', () => {
  const g = make([300,180,350]);
  assert.match(g.d, /A 12 12 0 0 0/); assert.match(g.d, /A 14 14 0 0 1/); assert.ok(g.d.endsWith(' Z'));
});
test('tiny width differences merge without narrowing copy', () => {
  const g = make([300,303]); assert.deepEqual(g.widths,[343,343]);
  assert.equal((g.d.match(/ A /g) ?? []).length, 4);
});
test('overlapping line boxes widen at the next top and narrow at the previous bottom', () => {
  const opts = {rowHeight:60,paddingX:20,paddingY:12,outerRadius:0,innerRadius:0,mergeThreshold:0};
  const wider = buildHighlight({...opts,textWidths:[180,300]});
  const narrower = buildHighlight({...opts,textWidths:[300,180]});
  assert.match(wider.d,/L 280 60/);
  assert.match(narrower.d,/L 340 84/);
});
test('radii clamp to short edges and stay finite', () => {
  const g = buildHighlight({textWidths:[300,305],rowHeight:20,paddingX:2,paddingY:0,outerRadius:100,innerRadius:100,mergeThreshold:0});
  assert.ok(!/NaN|Infinity/.test(g.d)); assert.match(g.d,/A 1.25 1.25/);
});
test('invalid dimensions and empty copy fail visibly', () => {
  assert.throws(()=>make([])); assert.throws(()=>make([0])); assert.throws(()=>make([NaN]));
  assert.throws(()=>buildHighlight({textWidths:[300],rowHeight:0,paddingX:20,paddingY:10,outerRadius:14}));
  assert.throws(()=>buildHighlight({textWidths:[300,200,300],rowHeight:40,paddingX:20,paddingY:21,outerRadius:14}));
});
