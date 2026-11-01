import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, goalStartDlmo } from '../js/simulate.js';

const day = (extra = {}) => ({
  tau: 24.8, lightSensitivity: 1, lightsOn: 7, lightsOff: 23, dayLux: 125, nightLux: 15,
  wakeMode: 'enforced', exercise: { enabled: false }, melatonin: { enabled: false }, ...extra,
});

test('light sensitivity speeds entrainment', () => {
  const days = (k) => simulate(day({ tau: 24.5, lightSensitivity: k }), { days: 120, detail: false }).entrainment.daysToEntrain;
  assert.ok(days(4) < days(1) && days(1) < days(0.25));
});

test('realistic noise is repeatable for a seed and differs between seeds', () => {
  const s = day({ noise: { enabled: true } });
  const a = simulate(s, { days: 30, seed: 3 }), b = simulate(s, { days: 30, seed: 3 }), c = simulate(s, { days: 30, seed: 4 });
  assert.deepEqual(a.dlmos, b.dlmos);
  assert.notDeepEqual(a.dlmos, c.dlmos);
  assert.ok(a.lightWindows.length > 30);
});

test('relative coordination is flagged only for a clock that almost holds', () => {
  const weak = day({ lightSensitivity: 0.25 });
  const r = simulate(weak, { startDlmoClock: goalStartDlmo(weak), days: 120 });
  assert.equal(r.entrainment.entrained, false);
  assert.ok(r.scallop, 'expected scalloping');
  assert.ok(r.scallop.slowMinPerDay < 10 && r.scallop.slipEveryDays > 30);
  const ok = simulate(day(), { startDlmoClock: goalStartDlmo(day()), days: 120 });
  assert.equal(ok.entrainment.entrained, true);
  assert.equal(ok.scallop, null);
});
