import test from 'node:test';
import assert from 'node:assert/strict';
import {stackBlocks} from './block-layout.mjs';
const safe = {top: 150, bottom: 280};

test('the screenshot ad matches the user\'s above-center Paper group with 64px gaps', () => {
  const r = stackBlocks([272.8, 190.44, 80.04, 90.48], safe);
  assert.equal(r.gap, 64);
  // Manual pixel snapping differs by less than 0.4px from uniform 64px gaps.
  [396, 733, 987, 1131].forEach((top, i) => assert.ok(Math.abs(r.tops[i] - top) < 0.4));
  assert.ok(Math.abs(r.groupCenter - 808.74) < 0.000001);
  assert.ok(r.spareAbove > 240 && r.spareBelow > 400);
});
test('single and two-block copy uses the same above-center target', () => {
  const single = stackBlocks([100], safe);
  assert.ok(Math.abs(single.tops[0] - 758.74) < 0.000001);
  const r = stackBlocks([100, 100], safe);
  assert.ok(Math.abs(r.groupTop - 676.74) < 0.000001);
  assert.ok(Math.abs(r.groupCenter - single.groupCenter) < 0.000001);
  assert.equal(r.tops[1] - r.tops[0], 164);
});
test('dense copy uses the available gap and accepts the exact 28px boundary', () => {
  assert.equal(stackBlocks([700, 740], safe).gap, 50);
  assert.equal(stackBlocks([700, 762], safe).gap, 28);
});
test('tall groups clamp at the safe top and preserve the bottom clearance', () => {
  const r = stackBlocks([600, 500], safe);
  assert.equal(r.groupTop, 226.74);
  const taller = stackBlocks([700, 600], safe);
  assert.equal(taller.groupTop, 150);
  assert.ok(taller.groupBottom <= 1640);
  const full = stackBlocks([700, 762], safe);
  assert.equal(full.groupTop, 150);
  assert.equal(full.groupBottom, 1640);
});
test('copy that cannot fit at the minimum gap fails without reducing box heights', () => {
  assert.throws(() => stackBlocks([700, 763], safe), /cannot fit/);
  assert.throws(() => stackBlocks([1491], safe), /cannot fit/);
});
test('explicit distributed mode reproduces the original spacing when requested', () => {
  const r = stackBlocks([272.8, 190.44, 80.04, 90.48], safe, 'distributed');
  assert.ok(Math.abs(r.gap - 285.41333333333336) < 0.000001);
  assert.ok(Math.abs(r.groupBottom - 1640) < 0.000001);
});
test('invalid measurements, margins and layout modes fail visibly', () => {
  for (const heights of [[], [0], [-1], [NaN]]) assert.throws(() => stackBlocks(heights, safe));
  assert.throws(() => stackBlocks([100], {top: -1, bottom: 280}));
  assert.throws(() => stackBlocks([100], safe, 'unknown'));
});
