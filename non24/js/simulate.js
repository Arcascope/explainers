// Runs the Skeldon model on a repeating 24-hour day and measures entrainment.

import { Skeldon23 } from './model.js';
import { exerciseShift, melatoninShift } from './prc.js';

export const DT = 0.1; // hours (6 minutes)
const STEPS_PER_DAY = Math.round(24 / DT);

// Our baseline sleeper. The package default (H0 = 13) sleeps about 7.4 h; with
// H0 = 12.2 a tau-24.2 person on lights 07:00-20:00 (500 lux, dim light after,
// kept awake while lit) falls asleep about 40 min earlier and sleeps 8.0 h
// (22:54-07:00), which we treat as the normal, well-rested baseline.
export const SLEEP_PARAMS = Object.freeze({ H0: 12.2 });
const MIN_CBT_SEPARATION = 13; // hours, as in the circadian package
const ENTRAINED_TOLERANCE = 0.5; // hours of DLMO wobble still counted as entrained
const SETTLE_WINDOW = 30; // days of stable DLMO needed to call it entrained
const MAX_DRIFT = 0.5; // min/day of residual DLMO drift still counted as entrained

export const mod = (a, n) => ((a % n) + n) % n;
// Signed difference a - b on a 24-hour circle, in (-12, 12].
export const circDiff = (a, b) => { const d = mod(a - b, 24); return d > 12 ? d - 24 : d; };

export function circMean(clocks) {
  let sx = 0, sy = 0;
  for (const c of clocks) { const a = (c / 24) * 2 * Math.PI; sx += Math.cos(a); sy += Math.sin(a); }
  return mod((Math.atan2(sy, sx) / (2 * Math.PI)) * 24, 24);
}

function inWindow(clock, start, end) {
  return start <= end ? clock >= start && clock < end : clock >= start || clock < end;
}

export function isLit(schedule, clock) {
  return inWindow(clock, schedule.lightsOn, schedule.lightsOff);
}

export function luxAt(schedule, clock) {
  return isLit(schedule, clock) ? schedule.dayLux : schedule.nightLux;
}

export function inExercise(schedule, clock) {
  const ex = schedule.exercise;
  if (!ex || !ex.enabled) return false;
  return inWindow(clock, ex.start, mod(ex.start + ex.minutes / 60, 24));
}

// wakeMode: 'natural'  - sleep whenever the model's sleep pressure says so
//           'alarm'    - woken at lights-on, free to sleep otherwise
//           'enforced' - kept awake the whole time the lights are on (default)
function wakeForced(schedule, clock) {
  const mode = schedule.wakeMode ?? 'enforced';
  if (mode === 'enforced') return isLit(schedule, clock);
  if (mode === 'alarm') {
    const d = circDiff(clock, schedule.lightsOn);
    return d >= 0 && d < DT - 1e-9;
  }
  return false;
}

// A point on the free-running (constant darkness) limit cycle for this tau, with
// its CBTmin index, so we can start a simulation at any body-clock phase.
const cycleCache = new Map();
function darkCycle(tau) {
  if (cycleCache.has(tau)) return cycleCache.get(tau);
  const m = new Skeldon23({ tauc: tau, ...SLEEP_PARAMS });
  const steps = Math.round((24 * 12) / DT);
  const states = new Array(steps);
  for (let i = 0; i < steps; i++) { m.step(0, DT); states[i] = Float64Array.from(m.state); }
  // last x-minimum at least 30 h before the end
  let tmin = -1;
  for (let i = steps - Math.round(30 / DT); i > steps - Math.round(60 / DT); i--) {
    if (states[i][0] < states[i - 1][0] && states[i][0] <= states[i + 1][0]) { tmin = i; break; }
  }
  const out = { states, tmin };
  cycleCache.set(tau, out);
  return out;
}

// Initial state whose (dark) DLMO would land at clock time dlmoClock on day 0,
// i.e. CBTmin at t = dlmoClock + 7 h. Stepping back the full (unwrapped) offset
// from a dark CBTmin keeps the 24 starting phases evenly spaced for any tau.
export function initialStateFor(tau, dlmoClock, cbtToDlmo = 7) {
  const { states, tmin } = darkCycle(tau);
  const hoursToCbt = mod(dlmoClock, 24) + cbtToDlmo;
  const s = Float64Array.from(states[tmin - Math.round(hoursToCbt / DT)]);
  s[3] = 12.84; // awake, typical sleep pressure at midnight
  return s;
}

// CBTmin markers from the oscillator phase angle crossing +/-pi (the package's
// phase convention). We avoid the minimum of x: switching light on makes dx/dt
// jump positive, which pins the x-minimum to lights-on whenever the true minimum
// would fall up to ~2 h later (e.g. tau >= 25.2 h with 07:00 lights-on read DLMO
// as exactly 00:00).
function recordCrossing(cbts, prevAngle, angle, t) {
  if (!(prevAngle > Math.PI / 2 && angle < -Math.PI / 2)) return;
  const unwrapped = angle + 2 * Math.PI;
  const f = (Math.PI - prevAngle) / (unwrapped - prevAngle);
  const tc = t - DT + f * DT;
  // An exercise delay can rotate the phase back across pi and forward again;
  // keep only the latest crossing within the minimum separation.
  if (cbts.length && tc - cbts[cbts.length - 1] < MIN_CBT_SEPARATION) cbts[cbts.length - 1] = tc;
  else cbts.push(tc);
}

function sleepEpisodes(sleep, dt) {
  const eps = [];
  let start = null;
  for (let i = 0; i < sleep.length; i++) {
    if (sleep[i] && start === null) start = i;
    if (!sleep[i] && start !== null) { eps.push({ start: start * dt, end: i * dt }); start = null; }
  }
  if (start !== null) eps.push({ start: start * dt, end: sleep.length * dt });
  return eps;
}

// schedule: { tau, lightsOn, lightsOff, dayLux, nightLux, wakeMode,
//             exercise: { enabled, start, minutes }, melatonin: { enabled, start } }
export function simulate(schedule, { startDlmoClock = 21, days = 90, detail = true } = {}) {
  const model = new Skeldon23({ tauc: schedule.tau, ...SLEEP_PARAMS }, initialStateFor(schedule.tau, startDlmoClock), 0);
  const p = model.p;
  const steps = Math.round((days * 24) / DT);
  const cbts = [];
  let prevAngle = model.phaseAngle();
  const sleep = detail ? new Uint8Array(steps + 1) : null;
  const bouts = [];
  // Per-day hours: held awake while the body wanted sleep, awake after lights-off
  // (in dim light, unable to fall asleep), and asleep.
  const daily = {
    fightingSleep: new Float32Array(days), awakeInDim: new Float32Array(days),
    asleep: new Float32Array(days),
  };
  const ex = schedule.exercise;
  const exMid = ex && ex.enabled ? mod(ex.start + ex.minutes / 120, 24) : null;
  // A daily melatonin dose (schedule.melatonin = { enabled, start }) shifts the
  // clock instantly by the melatonin PRC, the same way an exercise bout does.
  const mel = schedule.melatonin;
  const melAt = mel && mel.enabled && mel.start !== null ? mod(mel.start, 24) : null;
  const doses = [];
  // Each happens once a day, on the step whose clock time first reaches it (by
  // step index, so floating-point clock values can't skip or repeat a day).
  const stepOf = (h) => (h === null ? null : Math.ceil(h / DT - 1e-9) % STEPS_PER_DAY);
  const exStep = stepOf(exMid), melStep = stepOf(melAt);

  // Clock hours since the most recent melatonin onset at time t, the way the
  // PRCs were measured. DLMO comes cbt_to_dlmo hours before each CBTmin, so the
  // latest onset may be the one ahead of the last CBTmin; the cycle length is
  // the last observed CBTmin interval (tau while free-running, 24 h once
  // entrained). Before the first marker, fall back to the phase angle.
  const hoursAfterDlmo = (t) => {
    if (!cbts.length) return mod(((model.phaseAngle() - Math.PI) / (2 * Math.PI)) * p.tauc + p.cbt_to_dlmo, p.tauc);
    const period = cbts.length > 1 ? cbts[cbts.length - 1] - cbts[cbts.length - 2] : p.tauc;
    const sinceLastDlmo = t - (cbts[cbts.length - 1] - p.cbt_to_dlmo);
    return sinceLastDlmo >= period ? sinceLastDlmo - period : sinceLastDlmo;
  };

  for (let i = 1; i <= steps; i++) {
    const t = i * DT;
    const clock = mod(t, 24);
    const step = i % STEPS_PER_DAY;
    const exercising = inExercise(schedule, clock);
    const forceWake = exercising || wakeForced(schedule, clock);
    model.step(luxAt(schedule, clock), DT, forceWake);

    // One exercise bout's phase shift when the clock passes the bout midpoint.
    if (step === exStep) {
      const h = hoursAfterDlmo(t);
      const shift = exerciseShift(h, ex.minutes);
      model.shiftPhase(shift);
      if (detail) bouts.push({ t, hoursAfterDlmo: h, shift });
    }
    if (step === melStep) {
      const h = hoursAfterDlmo(t);
      const shift = melatoninShift(h);
      model.shiftPhase(shift);
      if (detail) doses.push({ t, hoursAfterDlmo: h, shift });
    }
    const angle = model.phaseAngle();
    recordCrossing(cbts, prevAngle, angle, t);
    prevAngle = angle;
    if (detail) sleep[i] = model.sleep;
    const day = Math.min(Math.floor((t - DT / 2) / 24), days - 1);
    if (model.sleep) daily.asleep[day] += DT;
    else if (!isLit(schedule, clock)) daily.awakeInDim[day] += DT;
    if (forceWake && model.wantsSleep) daily.fightingSleep[day] += DT;
  }

  const dlmos = cbts.map((c) => c - p.cbt_to_dlmo).filter((d) => d >= 0);
  const result = { schedule, days, dlmos, daily, entrainment: analyze(dlmos, days) };
  if (detail) {
    result.sleepEpisodes = sleepEpisodes(sleep, DT);
    result.bouts = bouts;
    result.doses = doses;
    result.sleepSummary = summarizeSleep(result.sleepEpisodes, days);
  }
  return result;
}

// Least-squares slope of y against index, in y-units per step.
function slope(y) {
  const n = y.length, mx = (n - 1) / 2;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (i - mx) * (y[i] - my); den += (i - mx) * (i - mx); }
  return num / den;
}

// Entrained when, over the last SETTLE_WINDOW days, DLMO both stays within
// ±ENTRAINED_TOLERANCE of its mean clock time AND has no residual trend (a slow
// drift of a few min/day can sit inside the tolerance band for weeks and then
// slip a whole cycle).
export function analyze(dlmos, days) {
  const clocks = dlmos.map((d) => mod(d, 24));
  const n = clocks.length;
  const none = (driftMinPerDay) => ({ entrained: false, driftMinPerDay, daysToEntrain: null, dlmoClock: null });
  if (n < 3) return none(0);
  // Drift from the trend of successive markers: dlmo[i] - 24 i, so one marker per
  // 24 h is flat and a skipped/extra cycle shows up as a 24 h jump.
  const tail = dlmos.slice(-SETTLE_WINDOW);
  const driftMinPerDay = slope(tail.map((d, i) => d - 24 * i)) * 60;
  if (n < SETTLE_WINDOW + 1) return none(driftMinPerDay);
  const last = clocks.slice(-SETTLE_WINDOW);
  const mean = circMean(last);
  const stable = Math.abs(driftMinPerDay) < MAX_DRIFT
    && last.every((c) => Math.abs(circDiff(c, mean)) < ENTRAINED_TOLERANCE)
    && dlmos[n - 1] > (days - 3) * 24;
  if (!stable) return none(driftMinPerDay);

  let k = n - 1;
  while (k > 0 && Math.abs(circDiff(clocks[k - 1], mean)) < ENTRAINED_TOLERANCE) k--;
  // Day numbers are 1-based: the day holding the first DLMO of the settled run
  // is the first fully entrained day (day 1 if it was aligned from the start).
  return { entrained: true, driftMinPerDay, daysToEntrain: Math.floor(dlmos[k] / 24) + 1, dlmoClock: mean };
}

function summarizeSleep(episodes, days) {
  const from = (days - 7) * 24;
  // Main sleeps in the last week that finished before the run ended (a sleep
  // still in progress at the end would be cut short).
  const main = episodes.filter((e) => e.start >= from && e.end < days * 24 && e.end - e.start >= 3);
  if (!main.length) return null;
  const hours = main.reduce((a, e) => a + (e.end - e.start), 0) / main.length;
  return {
    onsetClock: circMean(main.map((e) => mod(e.start, 24))),
    wakeClock: circMean(main.map((e) => mod(e.end, 24))),
    hoursPerDay: hours,
  };
}

// Days to entrain from each starting DLMO clock time (one simulation per start).
// Yields to the event loop between runs so the page stays responsive.
export async function sweepStarts(schedule, { starts = 24, days = 120, onProgress } = {}) {
  const out = [];
  for (let i = 0; i < starts; i++) {
    const startDlmoClock = (24 * i) / starts;
    const r = simulate(schedule, { startDlmoClock, days, detail: false });
    out.push({ startDlmoClock, daily: r.daily, ...r.entrainment });
    onProgress?.((i + 1) / starts);
    await new Promise((res) => setTimeout(res, 0));
  }
  return out;
}
