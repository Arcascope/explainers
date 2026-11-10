// Page wiring: one simulated dataset at a time, split at the chosen cut-point.

import { loadCopy, applyCopy, t, html } from './copy.js';
import { makeDataset, compare, scan, randomSeed, MIN_GROUP, CUT_MIN, CUT_MAX, CUT_STEP } from './sim.js';

const $ = (id) => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

const hhmm = (h) => {
  const m = Math.round(h * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const pText = (p) => (p < 0.001 ? 'p < 0.001' : `p = ${p.toFixed(3)}`);
const hrText = (x) => x.toFixed(2);
const effectKey = (hr) => hr.toFixed(2);

const state = {
  cut: 13,
  pendingHR: 1,
  ds: null,
  scan: null,
  tallies: new Map(), // per simulated effect: { n, m, a, x }
};

// ---- Data -------------------------------------------------------------------

function record(res, hr) {
  const k = effectKey(hr);
  const s = state.tallies.get(k) || { n: 0, m: 0, a: 0, x: 0 };
  s.n++;
  if (res.nMorning > 0) s.m++;
  if (res.nAfternoon > 0) s.a++;
  if (res.nMorning === 0 && res.nAfternoon === 0) s.x++;
  state.tallies.set(k, s);
}

function load(seed) {
  state.ds = makeDataset(seed, state.pendingHR);
  state.scan = scan(state.ds);
  record(state.scan, state.ds.effectHR);
}

function newDatasets(count) {
  for (let i = 0; i < count; i++) load(randomSeed());
  render();
}

// ---- SVG helpers ------------------------------------------------------------

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}
function text(parent, x, y, s, attrs = {}) {
  const e = el('text', { x, y, ...attrs }, parent);
  e.textContent = s;
  return e;
}
function clear(svg) {
  while (svg.firstChild) svg.firstChild.remove();
}

// ---- Charts -----------------------------------------------------------------

function drawKM(svg, ep, tau, tested) {
  clear(svg);
  const W = 400, H = 230, m = { l: 34, r: 10, t: 10, b: 32 };
  const x = (v) => m.l + (Math.min(v, tau) / tau) * (W - m.l - m.r);
  const y = (s) => m.t + (1 - s) * (H - m.t - m.b);
  for (const s of [0, 0.25, 0.5, 0.75, 1]) {
    el('line', { x1: m.l, x2: W - m.r, y1: y(s), y2: y(s), class: s === 0 ? 'axis' : 'grid' }, svg);
    if (s % 0.5 === 0) text(svg, m.l - 6, y(s) + 4, String(s), { 'text-anchor': 'end' });
  }
  for (let mo = 0; mo <= tau; mo += 12) text(svg, x(mo), H - m.b + 15, String(mo), { 'text-anchor': 'middle' });
  text(svg, (m.l + W - m.r) / 2, H - 3, t('km.axis.months'), { 'text-anchor': 'middle' });

  const curves = [
    [ep.morning, tested ? css('--morning') : css('--untested')],
    [ep.afternoon, tested ? css('--afternoon') : css('--untested')],
  ];
  for (const [km, color] of curves) {
    let d = `M${x(0)},${y(1)}`;
    for (let i = 0; i < km.times.length && km.times[i] <= tau; i++) d += `H${x(km.times[i])}V${y(km.surv[i])}`;
    d += `H${x(tau)}`;
    el('path', { d, fill: 'none', stroke: color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
  }
}

function drawHist(svg, times, cut) {
  clear(svg);
  const W = 820, H = 150, m = { l: 12, r: 12, t: 8, b: 26 };
  const lo = 7, hi = 20.5, bw = 0.25;
  const nb = Math.round((hi - lo) / bw);
  const counts = new Array(nb).fill(0);
  for (const v of times) counts[Math.min(nb - 1, Math.max(0, Math.floor((v - lo) / bw)))]++;
  const max = Math.max(...counts, 1);
  const x = (h) => m.l + ((h - lo) / (hi - lo)) * (W - m.l - m.r);
  const y = (c) => H - m.b - (c / max) * (H - m.t - m.b);
  counts.forEach((c, i) => {
    if (!c) return;
    el('rect', { x: x(lo + i * bw) + 0.5, y: y(c), width: x(lo + bw) - x(lo) - 1, height: H - m.b - y(c), fill: css('--bar') }, svg);
  });
  el('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'axis' }, svg);
  for (let h = 8; h <= 20; h += 2) text(svg, x(h), H - m.b + 15, hhmm(h), { 'text-anchor': 'middle' });
  el('line', { x1: x(cut), x2: x(cut), y1: m.t - 4, y2: H - m.b, class: 'cutline' }, svg);
}

const SCAN = { W: 820, H: 200, m: { l: 62, r: 30, t: 10, b: 26 } };
const scanX = (c) => SCAN.m.l + ((c - CUT_MIN) / (CUT_MAX - CUT_MIN)) * (SCAN.W - SCAN.m.l - SCAN.m.r);

function drawScan(svg, res, cut) {
  clear(svg);
  const { W, H, m } = SCAN;
  const lp = (p) => -Math.log10(p);
  const top = Math.max(3, Math.ceil(Math.max(...res.rows.filter((r) => r.tested).map((r) => lp(r.p)), 0)));
  const y = (p) => H - m.b - (Math.min(lp(p), top) / top) * (H - m.t - m.b);
  const half = (scanX(CUT_MIN + CUT_STEP) - scanX(CUT_MIN)) / 2;

  // Shade runs of cut-points where a group is too small to test.
  let run = null;
  const shade = (a, b) => {
    const x0 = Math.max(m.l, scanX(a) - half), x1 = Math.min(W - m.r, scanX(b) + half);
    el('rect', { x: x0, y: m.t, width: x1 - x0, height: H - m.t - m.b, fill: css('--paper-2') }, svg);
    if (x1 - x0 > 70) text(svg, (x0 + x1) / 2, m.t + 14, t('scan.untested', { min: MIN_GROUP }), { 'text-anchor': 'middle' });
  };
  for (const r of res.rows) {
    if (!r.tested) run = run ? [run[0], r.cut] : [r.cut, r.cut];
    else if (run) { shade(...run); run = null; }
  }
  if (run) shade(...run);

  for (const p of [1, 0.01, 0.001, 0.0001].filter((p) => lp(p) <= top)) {
    el('line', { x1: m.l, x2: W - m.r, y1: y(p), y2: y(p), class: p === 1 ? 'axis' : 'grid' }, svg);
    text(svg, m.l - 6, y(p) + 4, String(p), { 'text-anchor': 'end' });
  }
  el('line', { x1: m.l, x2: W - m.r, y1: y(0.05), y2: y(0.05), class: 'alpha' }, svg);
  text(svg, m.l - 6, y(0.05) + 4, '0.05', { 'text-anchor': 'end' });
  for (let h = CUT_MIN; h <= CUT_MAX; h++) text(svg, scanX(h), H - m.b + 15, hhmm(h), { 'text-anchor': 'middle' });

  el('line', { x1: scanX(cut), x2: scanX(cut), y1: m.t, y2: H - m.b, class: 'cutline' }, svg);
  for (const r of res.rows) {
    if (!r.tested) continue;
    el('circle', { cx: scanX(r.cut), cy: y(r.p), r: 3.6, fill: css(r.dir === 'morning' ? '--morning' : '--afternoon') }, svg);
  }
}

// ---- Text ---------------------------------------------------------------------

function renderStatus(r) {
  const cut = hhmm(state.cut);
  let big, sub;
  if (!r.tested) {
    big = t('status.untested.big');
    sub = html('status.untested', { cut, min: MIN_GROUP });
  } else {
    const hits = ['pfs', 'os']
      .filter((k) => r[k].p < 0.05)
      .map((k) => ({ endpoint: t(`endpoint.${k}`), group: t(r[k].hr > 1 ? 'group.morning' : 'group.afternoon'), p: pText(r[k].p) }));
    if (!hits.length) {
      big = t('status.none.big');
      sub = html('status.none', { cut });
    } else {
      big = t('status.found.big');
      sub = hits.length === 1
        ? html('status.found.one', { cut, ...hits[0] })
        : html('status.found.two', {
          cut,
          endpoint1: hits[0].endpoint, group1: hits[0].group, p1: hits[0].p,
          endpoint2: hits[1].endpoint, group2: hits[1].group, p2: hits[1].p,
        });
    }
  }
  const s = state.scan;
  const sig = s.rows.filter((x) => x.tested && (x.sigMorning || x.sigAfternoon)).length;
  const hr = state.ds.effectHR;
  $('status-big').textContent = big;
  $('status-sub').innerHTML = sub;
  $('status-data').innerHTML = hr > 1.0001
    ? html('status.dataset.effect', { hr: hrText(hr), tested: s.nTested, sig })
    : html('status.dataset.null', { tested: s.nTested, sig });
}

function renderTally() {
  const hr = state.ds.effectHR;
  const s = state.tallies.get(effectKey(hr));
  const share = (n) => t('tally.share', { n, pct: Math.round((100 * n) / s.n) });
  $('tally-scope').textContent = hr > 1.0001 ? t('tally.scope.effect', { hr: hrText(hr) }) : t('tally.scope.null');
  $('t-n').textContent = s.n;
  $('t-m').textContent = share(s.m);
  $('t-a').textContent = share(s.a);
  $('t-x').textContent = share(s.x);
}

function renderEffect() {
  const p = state.pendingHR;
  $('effect-out').textContent = p > 1.0001 ? t('effect.value', { hr: hrText(p) }) : t('effect.none');
  const differs = effectKey(p) !== effectKey(state.ds.effectHR);
  $('effect-pending').hidden = !differs;
  if (differs) $('effect-pending').textContent = p > 1.0001 ? t('effect.pending', { hr: hrText(p) }) : t('effect.pending.none');
}

// ---- Render -----------------------------------------------------------------

function render() {
  const r = compare(state.ds, state.cut);
  $('cut').value = state.cut;
  $('cut-out').textContent = hhmm(state.cut);

  renderStatus(r);
  drawKM($('km-pfs'), r.pfs, 36, r.tested);
  drawKM($('km-os'), r.os, 60, r.tested);
  $('ro-pfs').textContent = r.tested ? t('km.readout', { hr: hrText(r.pfs.hr), p: pText(r.pfs.p) }) : t('km.readout.untested');
  $('ro-os').textContent = r.tested ? t('km.readout', { hr: hrText(r.os.hr), p: pText(r.os.p) }) : t('km.readout.untested');
  $('lg-m').textContent = t('km.legend.morning', { n: r.nMorning });
  $('lg-a').textContent = t('km.legend.afternoon', { n: r.nAfternoon });
  drawHist($('hist'), state.ds.allTimes, state.cut);
  drawScan($('scan'), state.scan, state.cut);

  const lowest = state.scan.lowest;
  $('lowest').disabled = !lowest;
  $('lowest').textContent = lowest ? t('cut.lowest') : t('cut.lowest.none');

  renderTally();
  renderEffect();
  $('footer-data').textContent = t('footer.data', { seed: state.ds.seed });
}

function setCut(c) {
  state.cut = Math.min(CUT_MAX, Math.max(CUT_MIN, Math.round(c / CUT_STEP) * CUT_STEP));
  render();
}

// ---- Start ------------------------------------------------------------------

async function main() {
  await loadCopy();
  applyCopy();

  const q = new URLSearchParams(location.search);
  const seed = Number(q.get('seed'));
  load(Number.isInteger(seed) && seed > 0 ? seed >>> 0 : randomSeed());
  const cut = Number(q.get('cut'));
  if (q.has('cut') && Number.isFinite(cut)) setCut(cut);
  else render();

  $('cut').addEventListener('input', (e) => setCut(Number(e.target.value)));
  $('lowest').addEventListener('click', () => state.scan.lowest && setCut(state.scan.lowest.cut));
  $('new').addEventListener('click', () => newDatasets(1));
  $('batch').addEventListener('click', () => newDatasets(100));
  $('effect').addEventListener('input', (e) => { state.pendingHR = Number(e.target.value); renderEffect(); });
  $('reset').addEventListener('click', () => {
    state.tallies.delete(effectKey(state.ds.effectHR));
    record(state.scan, state.ds.effectHR);
    renderTally();
  });
  $('scan').addEventListener('click', (e) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const v = pt.matrixTransform(svg.getScreenCTM().inverse());
    const frac = (v.x - SCAN.m.l) / (SCAN.W - SCAN.m.l - SCAN.m.r);
    setCut(CUT_MIN + frac * (CUT_MAX - CUT_MIN));
  });
}

main().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('afterbegin', `<p style="padding:16px">${String(err.message || err)}</p>`);
});
