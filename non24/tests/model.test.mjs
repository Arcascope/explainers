import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Skeldon23 } from '../js/model.js';
import { simulate, analyze, initialStateFor, DT } from '../js/simulate.js';
import { exerciseShift } from '../js/prc.js';

const ref = JSON.parse(readFileSync(new URL('./skeldon23_reference.json', import.meta.url)));

test('matches the circadian Python package (16L:8D, 500 lux, 5 days)', () => {
  // Reference: circadian==1.0.3 Skeldon23, dt=0.1 h, light at t[i] drives the step ending at t[i].
  const m = new Skeldon23();
  const n = 24 * 5 * 10;
  for (let i = 1; i < n; i++) {
    const t = i * 0.1;
    const c = t % 24;
    m.step(c >= 7 && c < 23 ? 500 : 0, 0.1);
    if (i % 10 === 0) {
      const want = ref.states[i / 10];
      for (let k = 0; k < 4; k++) assert.ok(Math.abs(m.state[k] - want[k]) < 1e-6, `state ${k} at t=${t}`);
      assert.equal(m.sleep, ref.sleep[i / 10], `sleep at t=${t}`);
    }
  }
});

test('free-running period in darkness equals tau', () => {
  for (const tau of [24.2, 24.8]) {
    const r = simulate({ tau, lightsOn: 0, lightsOff: 0, dayLux: 0, nightLux: 0, wakeMode: 'natural' }, { days: 30, detail: false });
    const d = r.dlmos;
    const period = (d[d.length - 1] - d[d.length - 11]) / 10;
    assert.ok(Math.abs(period - tau) < 0.02, `tau ${tau} -> ${period}`);
  }
});

test('exercise PRC: morning advances, evening delays', () => {
  // study baseline DLMO ~21:37; bouts starting 07:00 and 19:00 have midpoints
  // about 9.9 h and 21.9 h after DLMO
  assert.ok(exerciseShift(9.9) > 0.15);
  assert.ok(exerciseShift(21.9) < -0.15);
});

test('baseline sleeper: tau 24.2 sleeps about 8 h on lights 07:00-20:00', () => {
  const r = simulate({ tau: 24.2, lightsOn: 7, lightsOff: 20, dayLux: 500, nightLux: 15, wakeMode: 'enforced', exercise: { enabled: false } }, { days: 60 });
  let s = 0; for (let d = 53; d < 60; d++) s += r.daily.asleep[d];
  assert.ok(Math.abs(s / 7 - 8) < 0.15, `sleep ${s / 7} h`);
});

test('a bright regular day entrains a modest tau', () => {
  const r = simulate({ tau: 24.3, lightsOn: 7, lightsOff: 23, dayLux: 1000, nightLux: 0, wakeMode: 'enforced', exercise: { enabled: false } }, { days: 90 });
  assert.equal(r.entrainment.entrained, true);
});

test('DLMO marker is not pinned to lights-on for long tau', () => {
  // The x-minimum marker used to stick at 07:00 lights-on (DLMO exactly 00:00) for tau >= 25.2.
  const day = { lightsOn: 7, lightsOff: 23, dayLux: 500, nightLux: 15, wakeMode: 'enforced', exercise: { enabled: false } };
  const a = simulate({ ...day, tau: 25.4 }, { days: 90, detail: false }).entrainment.dlmoClock;
  const b = simulate({ ...day, tau: 25.8 }, { days: 90, detail: false }).entrainment.dlmoClock;
  assert.ok(Math.abs(a - b) > 0.5, `DLMO ${a} vs ${b} should differ`);
});

test('slow drift inside the tolerance band is not entrainment', () => {
  // 4 min/day drift: stays within ±30 min for 14 days but slips a cycle every ~360 days.
  const dlmos = Array.from({ length: 120 }, (_, i) => 22 + i * (24 + 4 / 60));
  const r = analyze(dlmos, 120);
  assert.equal(r.entrained, false);
  assert.ok(Math.abs(r.driftMinPerDay - 4) < 0.01);
});

test('slow drift of 1 min/day is not entrainment', () => {
  const dlmos = Array.from({ length: 120 }, (_, i) => 22 + i * (24 + 1 / 60));
  assert.equal(analyze(dlmos, 120).entrained, false);
});

test('an entrained verdict at 120 days still holds at 400 days', () => {
  // Guards against calling a slow creep "entrained": if the 120-day verdict says
  // entrained, a long run must keep DLMO at the same clock time.
  const mod = (a, n) => ((a % n) + n) % n;
  for (const [tau, lux, nl] of [[25.7, 250, 5], [25.6, 250, 40], [25.2, 500, 15], [24.6, 250, 15]]) {
    const day = { tau, lightsOn: 7, lightsOff: 23, dayLux: lux, nightLux: nl, wakeMode: 'enforced', exercise: { enabled: false } };
    if (!simulate(day, { startDlmoClock: 0, days: 120, detail: false }).entrainment.entrained) continue;
    const long = simulate(day, { startDlmoClock: 0, days: 400, detail: false }).dlmos.slice(-200).map((d) => mod(d, 24));
    const spread = Math.max(...long) - Math.min(...long);
    assert.ok(spread < 1, `tau ${tau} ${lux}/${nl}: DLMO wanders ${spread.toFixed(2)} h over days 200-400`);
  }
});

test('starting phases land on the requested DLMO in darkness', () => {
  const dark = { tau: 25.5, lightsOn: 0, lightsOff: 0, dayLux: 0, nightLux: 0, wakeMode: 'natural' };
  for (const start of [0, 6, 18, 21]) {
    const first = simulate(dark, { startDlmoClock: start, days: 3, detail: false }).dlmos[0];
    assert.ok(Math.abs(first - start) < 0.15, `start ${start} -> first DLMO ${first}`);
  }
});
