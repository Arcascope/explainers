import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseCopy } from '../js/copy.js';
import { makeDataset, compare, scan, logRank, kaplanMeier, erfc, CUTS, MIN_GROUP } from '../js/sim.js';

const dir = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, dir), 'utf8');

test('every copy key the page uses exists in copy.md', () => {
  const copy = parseCopy(read('copy.md'));
  const src = read('index.html') + read('js/app.js');
  const keys = new Set();
  for (const m of src.matchAll(/data-copy(?:-aria)?="([\w.]+)"/g)) keys.add(m[1]);
  for (const m of src.matchAll(/\b(?:t|html)\('([\w.]+)'/g)) keys.add(m[1]);
  for (const k of ['endpoint.pfs', 'endpoint.os', 'page.title', 'page.description']) keys.add(k);
  const missing = [...keys].filter((k) => !(k in copy));
  assert.deepEqual(missing, []);
});

test('copy avoids spaced em dashes and middle dots', () => {
  const files = ['copy.md', 'index.html', 'README.md', ...readdirSync(new URL('js/', dir)).map((f) => `js/${f}`)];
  for (const f of files) {
    const s = read(f);
    assert.ok(!s.includes(' — '), `${f} has a spaced em dash`);
    assert.ok(!s.includes('·') && !s.includes('&middot;'), `${f} has a middle dot`);
  }
});

test('erfc matches known values', () => {
  assert.ok(Math.abs(erfc(0) - 1) < 1e-7);
  assert.ok(Math.abs(erfc(Math.sqrt(3.841458820694124 / 2)) - 0.05) < 1e-6);
  assert.ok(Math.abs(erfc(-1) - 1.8427007929497148) < 1e-6);
});

test('Kaplan-Meier on a small example', () => {
  const km = kaplanMeier([1, 2, 2, 3, 4], [1, 1, 0, 1, 0]);
  assert.deepEqual(km.times, [1, 2, 3]);
  assert.ok(Math.abs(km.surv[0] - 0.8) < 1e-12);
  assert.ok(Math.abs(km.surv[1] - 0.6) < 1e-12);
  assert.ok(Math.abs(km.surv[2] - 0.3) < 1e-12);
});

test('log-rank: identical groups give p = 1 and HR = 1', () => {
  const time = [1, 1, 2, 2, 3, 3, 4, 4], event = [1, 1, 1, 1, 0, 0, 1, 1], g = [0, 1, 0, 1, 0, 1, 0, 1];
  const r = logRank(time, event, g);
  assert.ok(Math.abs(r.hr - 1) < 1e-12 && Math.abs(r.p - 1) < 1e-6);
});

test('datasets are reproducible from the seed', () => {
  const a = makeDataset(1234), b = makeDataset(1234);
  assert.deepEqual(a.os.time, b.os.time);
  assert.deepEqual(a.pfs.time, b.pfs.time);
  assert.equal(a.medianTimes.length, 250);
});

test('small groups are not tested', () => {
  const ds = makeDataset(99);
  for (const cut of CUTS) {
    const r = compare(ds, cut);
    assert.equal(r.tested, r.nMorning >= MIN_GROUP && r.nAfternoon >= MIN_GROUP);
    if (!r.tested) assert.ok(Number.isNaN(r.os.p));
  }
});

test('with no simulated effect, a single fixed cut-point rejects about 5% of the time', () => {
  let rej = 0, n = 0;
  for (let s = 1; s <= 600; s++) {
    const r = compare(makeDataset(s * 104729), 13);
    if (!r.tested) continue;
    n++;
    if (r.os.p < 0.05) rej++;
  }
  const rate = rej / n;
  assert.ok(rate > 0.02 && rate < 0.09, `rate ${rate}`);
});

test('searching all cut-points finds p < 0.05 in roughly six datasets in ten (the copy says so)', () => {
  let any = 0, m = 0, a = 0;
  const N = 600;
  for (let s = 1; s <= N; s++) {
    const r = scan(makeDataset(s * 7919));
    any += r.nMorning > 0 || r.nAfternoon > 0;
    m += r.nMorning > 0;
    a += r.nAfternoon > 0;
  }
  assert.ok(any / N > 0.5 && any / N < 0.72, `any ${any / N}`);
  assert.ok(m > a, `morning ${m} afternoon ${a}`);
});
