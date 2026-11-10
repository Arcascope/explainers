// Simulated immunotherapy cohorts and the morning/afternoon comparison.
//
// Survival is generated independently of infusion clock time unless
// `effectHR` is above 1. Ported from the cut-point game in the
// tod-immunotherapy-bias-sandbox project (src/sim/dgp.ts, src/stats/*,
// src/simple/SimpleApp.tsx), with the same parameters.

import { GROUPS } from './times.js';

// ---- Parameters ---------------------------------------------------------

export const PARAMS = {
  n: 250,              // patients per dataset
  cureFrac: 0.4,       // durable responders
  earlyFrac: 0.25,     // early failures; the rest are intermediate
  osMedians: [140, 18, 4],  // months, by tier (durable, intermediate, early)
  pfsMedians: [60, 9, 2],   // months, by tier
  followUpMedian: 36,  // months
  doseDays: 21,        // dosing interval
  maxCycles: 35,
  muBase: 12.67,       // mean infusion hour
  totalSd: 2.46,       // SD of infusion hour
  withinFrac: 0.68,    // share of timing variance that is visit to visit
  confoundScale: 2.0,  // hours later per sicker tier, per unit of (HR per hour - 1)
};

export const MIN_GROUP = 30;   // smaller groups are drawn but not tested
export const CUT_MIN = 9;
export const CUT_MAX = 18;
export const CUT_STEP = 0.25;
export const CUTS = [];
for (let c = CUT_MIN; c <= CUT_MAX + 1e-9; c += CUT_STEP) CUTS.push(+c.toFixed(2));

const DAYS_PER_MONTH = 30.4;
const MIN_OS = 1 / DAYS_PER_MONTH;
const CLINIC_OPEN = 7.0;
const CLINIC_CLOSE = 20.5;
const JITTER = 0.1;

// Every patient mean, tagged with its group, for uniform sampling.
const MEANS = GROUPS.flatMap((g, k) => g.means.map((m) => [m, k]));
const N_OFFSETS = GROUPS.reduce((a, g) => a + g.offsets.length, 0);
const GRAND_MEAN = MEANS.reduce((a, [m]) => a + m, 0) / MEANS.length;
const MEANS_SD = Math.sqrt(MEANS.reduce((a, [m]) => a + (m - GRAND_MEAN) ** 2, 0) / (MEANS.length - 1));
const OFFSETS_SD = Math.sqrt(GROUPS.reduce((a, g) => a + g.offsets.reduce((x, r) => x + r * r, 0), 0) / (N_OFFSETS - MEANS.length));

// ---- Random numbers -----------------------------------------------------

export class RNG {
  constructor(seed) {
    let a = (seed === 0 ? 0x9e3779b9 : seed) >>> 0;
    this.next = () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.spare = null;
  }
  random() { return this.next(); }
  uniform(a, b) { return a + (b - a) * this.next(); }
  int(n) { return Math.floor(this.next() * n); }
  gaussian(m = 0, sd = 1) {
    if (this.spare !== null) { const s = this.spare; this.spare = null; return m + sd * s; }
    let u, v, s;
    do { u = 2 * this.next() - 1; v = 2 * this.next() - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
    const k = Math.sqrt((-2 * Math.log(s)) / s);
    this.spare = v * k;
    return m + sd * u * k;
  }
  expMedian(median) { return -(median / Math.LN2) * Math.log(1 - this.next()); }
}

export const randomSeed = () => Math.floor(Math.random() * 0xffffffff) >>> 0;

// ---- Cohort ---------------------------------------------------------------

function median(xs) {
  const a = Array.from(xs).sort((x, y) => x - y);
  const n = a.length;
  return n % 2 ? a[(n - 1) / 2] : 0.5 * (a[n / 2 - 1] + a[n / 2]);
}

const clip = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

function makePatient(rng, P, beta, slotShift) {
  const u = rng.random();
  const tier = u < P.cureFrac ? 0 : u < P.cureFrac + P.earlyFrac ? 2 : 1;

  // Habitual infusion hour: a real patient's mean, rescaled to the
  // between-patient SD, plus the optional scheduling confound.
  const sdWithin = P.totalSd * Math.sqrt(P.withinFrac);
  const sdBetween = P.totalSd * Math.sqrt(1 - P.withinFrac);
  const [m0, k] = MEANS[rng.int(MEANS.length)];
  const offsets = GROUPS[k].offsets;
  const M = P.muBase + slotShift * tier + (m0 - GRAND_MEAN) * (sdBetween / MEANS_SD) + rng.gaussian(0, JITTER);

  let OS = Math.max(rng.expMedian(P.osMedians[tier]), MIN_OS);
  if (beta !== 0) OS = Math.max(OS * Math.exp(-beta * (M - P.muBase)), MIN_OS);

  // Time on treatment: durable responders stop after 6 to 24 months,
  // intermediate patients partway through, early failures at death.
  const TOT = tier === 0 ? Math.min(OS, rng.uniform(6, 24)) : tier === 1 ? OS * rng.uniform(0.4, 0.95) : OS;

  const C = rng.expMedian(P.followUpMedian);
  const observedTime = Math.min(OS, C);
  const event = OS <= C ? 1 : 0;

  const n = Math.min(Math.floor((Math.min(TOT, observedTime) * DAYS_PER_MONTH) / P.doseDays) + 1, P.maxCycles);
  const scale = sdWithin / OFFSETS_SD;
  const times = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    const r = offsets[rng.int(offsets.length)];
    times[j] = clip(M + r * scale + rng.gaussian(0, JITTER), CLINIC_OPEN, CLINIC_CLOSE);
  }
  return { tier, M, OS, observedTime, event, n, times, medianTime: median(times) };
}

/**
 * One dataset. `effectHR` is the simulated hazard ratio per hour later; 1 means
 * infusion time has no influence. Above 1 it adds both a real effect and a
 * scheduling confound (sicker patients booked later), as in the original game.
 */
export function makeDataset(seed, effectHR = 1, P = PARAMS) {
  const beta = Math.log(effectHR);
  const slotShift = (effectHR - 1) * P.confoundScale;
  const rng = new RNG(seed);
  const patients = [];
  for (let i = 0; i < P.n; i++) patients.push(makePatient(rng, P, beta, slotShift));

  // Progression-free survival: shorter, tied to the same prognosis tier,
  // capped at death. Its own stream so it is fixed for the dataset.
  const prng = new RNG((seed ^ 0x5bd1e995) >>> 0);
  const pfsTime = [], pfsEvent = [];
  for (const p of patients) {
    const mult = beta !== 0 ? Math.exp(-beta * (p.M - P.muBase)) : 1;
    const prog = prng.expMedian(P.pfsMedians[p.tier]) * mult;
    const cens = prng.expMedian(P.followUpMedian);
    pfsTime.push(Math.min(prog, p.OS, cens));
    pfsEvent.push(prog <= p.OS && prog <= cens ? 1 : 0);
  }

  const allTimes = [];
  for (const p of patients) for (const t of p.times) allTimes.push(t);

  return {
    seed, effectHR,
    medianTimes: patients.map((p) => p.medianTime),
    os: { time: patients.map((p) => p.observedTime), event: patients.map((p) => p.event) },
    pfs: { time: pfsTime, event: pfsEvent },
    allTimes,
  };
}

// ---- Statistics -----------------------------------------------------------

// Complementary error function (Numerical Recipes erfcc, relative error < 1.2e-7).
export function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
}

/** Kaplan-Meier curve: event times and survival just after each. */
export function kaplanMeier(time, event) {
  const idx = time.map((_, i) => i).sort((a, b) => time[a] - time[b]);
  const times = [], surv = [];
  let s = 1, atRisk = time.length, i = 0;
  while (i < idx.length) {
    const t = time[idx[i]];
    let d = 0, c = 0;
    while (i < idx.length && time[idx[i]] === t) { if (event[idx[i]] === 1) d++; c++; i++; }
    if (d > 0) { s *= 1 - d / atRisk; times.push(t); surv.push(s); }
    atRisk -= c;
  }
  return { times, surv };
}

/**
 * Two-group log-rank test with the Peto hazard ratio for group 1 (afternoon)
 * against group 0 (morning). HR above 1 means the afternoon group did worse.
 */
export function logRank(time, event, group) {
  const idx = time.map((_, i) => i).sort((a, b) => time[a] - time[b]);
  let r1 = 0, r0 = 0;
  for (const g of group) g === 1 ? r1++ : r0++;
  let O1 = 0, E1 = 0, V1 = 0, i = 0;
  while (i < idx.length) {
    const t = time[idx[i]];
    let d1 = 0, d0 = 0, l1 = 0, l0 = 0;
    while (i < idx.length && time[idx[i]] === t) {
      const j = idx[i];
      if (group[j] === 1) { l1++; if (event[j] === 1) d1++; } else { l0++; if (event[j] === 1) d0++; }
      i++;
    }
    const d = d1 + d0, r = r1 + r0;
    if (d > 0 && r > 1 && r1 > 0 && r0 > 0) {
      O1 += d1;
      E1 += (d * r1) / r;
      V1 += (d * r1 * r0 * (r - d)) / (r * r * (r - 1));
    }
    r1 -= l1; r0 -= l0;
  }
  if (!(V1 > 0)) return { hr: 1, p: 1 };
  const chi = ((O1 - E1) ** 2) / V1;
  return { hr: Math.exp((O1 - E1) / V1), p: erfc(Math.sqrt(chi / 2)) };
}

// ---- The comparison -------------------------------------------------------

function groupsAt(ds, cut) {
  const g = ds.medianTimes.map((t) => (t > cut ? 1 : 0));
  const nAfternoon = g.reduce((a, b) => a + b, 0);
  const nMorning = g.length - nAfternoon;
  return { g, nMorning, nAfternoon, tested: nMorning >= MIN_GROUP && nAfternoon >= MIN_GROUP };
}

function split(time, event, g) {
  const t0 = [], e0 = [], t1 = [], e1 = [];
  g.forEach((x, i) => (x ? (t1.push(time[i]), e1.push(event[i])) : (t0.push(time[i]), e0.push(event[i]))));
  return { morning: kaplanMeier(t0, e0), afternoon: kaplanMeier(t1, e1) };
}

/** Everything the page shows for one cut-point: curves, HR and p for PFS and OS. */
export function compare(ds, cut) {
  const { g, nMorning, nAfternoon, tested } = groupsAt(ds, cut);
  const out = { cut, nMorning, nAfternoon, tested };
  for (const k of ['pfs', 'os']) {
    const { time, event } = ds[k];
    out[k] = { ...split(time, event, g), ...(tested ? logRank(time, event, g) : { hr: NaN, p: NaN }) };
  }
  return out;
}

/** Direction of a result: 'morning' if the morning group did better, else 'afternoon'. */
export const direction = (r) => (r.hr > 1 ? 'morning' : 'afternoon');

/**
 * Test every cut-point on the slider. Returns, per cut, the smallest p-value
 * across PFS and OS and its direction, plus summary counts for the dataset.
 */
export function scan(ds, alpha = 0.05) {
  const rows = [];
  for (const cut of CUTS) {
    const { g, tested } = groupsAt(ds, cut);
    if (!tested) { rows.push({ cut, tested: false }); continue; }
    const pfs = logRank(ds.pfs.time, ds.pfs.event, g);
    const os = logRank(ds.os.time, ds.os.event, g);
    const best = pfs.p <= os.p ? pfs : os;
    rows.push({
      cut, tested: true, p: best.p, dir: direction(best),
      sigMorning: [pfs, os].some((r) => r.p < alpha && r.hr > 1),
      sigAfternoon: [pfs, os].some((r) => r.p < alpha && r.hr < 1),
    });
  }
  const tested = rows.filter((r) => r.tested);
  const lowest = tested.reduce((a, r) => (a && a.p <= r.p ? a : r), null);
  return {
    rows,
    nTested: tested.length,
    nMorning: tested.filter((r) => r.sigMorning).length,
    nAfternoon: tested.filter((r) => r.sigAfternoon).length,
    lowest,
  };
}
