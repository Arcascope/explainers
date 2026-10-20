// Hand-drawn charts (canvas actogram + small SVG charts). No charting library.

import { mod, isLit, inExercise } from './simulate.js';
import { t } from './copy.js';

export function themeColors(el = document.documentElement) {
  const cs = getComputedStyle(el);
  const v = (name) => cs.getPropertyValue(name).trim();
  return {
    bg: v('--ink-900'), muted: v('--ink-500'), line: v('--ink-700'), row: v('--row'),
    daylight: v('--daylight'), lamp: v('--lamp'), ember: v('--ember'),
    night: v('--moon'), dim: v('--dim'), move: v('--move'), mel: v('--mel'), marker: v('--teal-400'),
  };
}

// jetlag.gy's light ramp: daylight (sunlight / light box) → lamp (bright indoor) → ember (dim).
export function lightTier(lux) {
  if (lux >= 2500) return 'daylight';
  if (lux >= 100) return 'lamp';
  return 'ember';
}

export const fmtClock = (h) => {
  const m = Math.round(mod(h, 24) * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// Double-plotted actogram: each row shows day d and d+1 (48 h). Rows are rounded
// tracks with gaps, coloured with jetlag.gy's light ramp; sleep is near-black.
export function drawActogram(canvas, result) {
  const c = themeColors();
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const days = result.days;
  const narrow = cssW < 520;
  const left = narrow ? 24 : 30, top = 20, right = 10; // right: room for the last hour label
  const gap = 2;
  const barH = narrow ? 5 : days > 60 ? 6 : 8;
  const rowH = barH + gap;
  const cssH = top + rowH * days + 4;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, cssW, cssH);

  const plotW = cssW - left - right;
  const X = (h) => left + (h / 48) * plotW;
  const s = result.schedule;
  const lightColor = c[lightTier(s.dayLux)];
  const rowY = (d) => top + d * rowH;
  const round = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); g.fill(); };

  g.font = '11px ui-monospace, "SFMono-Regular", Menlo, monospace';
  g.fillStyle = c.muted;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  for (let h = 0; h <= 48; h += 6) g.fillText(String(h % 24).padStart(2, '0'), X(h), 12);

  // light windows as runs (wrap-aware), reused for every row
  const step = 0.25;
  const runs = [];
  for (let h = 0; h < 48; h += step) {
    if (!isLit(s, mod(h, 24))) continue;
    const last = runs[runs.length - 1];
    if (last && Math.abs(last[1] - h) < 1e-9) last[1] = h + step; else runs.push([h, h + step]);
  }
  const exRuns = [];
  if (s.exercise?.enabled) {
    for (let h = 0; h < 48; h += step) {
      if (!inExercise(s, mod(h, 24))) continue;
      const last = exRuns[exRuns.length - 1];
      if (last && Math.abs(last[1] - h) < 1e-9) last[1] = h + step; else exRuns.push([h, h + step]);
    }
  }

  for (let d = 0; d < days; d++) {
    const y = rowY(d);
    g.fillStyle = s.nightLux > 0 ? c.dim : c.row;
    round(X(0), y, plotW, barH, 3);
    g.fillStyle = lightColor;
    for (const [a, b] of runs) round(X(a), y, X(b) - X(a), barH, 2);
  }

  // sleep
  g.fillStyle = c.night;
  for (const e of result.sleepEpisodes) {
    for (let d = Math.floor(e.start / 24) - 1; d <= Math.floor(e.end / 24); d++) {
      if (d < 0 || d >= days) continue;
      const a = Math.max(e.start - d * 24, 0), b = Math.min(e.end - d * 24, 48);
      if (b > a) round(X(a), rowY(d), Math.max(X(b) - X(a), 1), barH, 2);
    }
  }

  // exercise
  g.fillStyle = c.move;
  for (let d = 0; d < days; d++) {
    for (const [a, b] of exRuns) round(X(a), rowY(d) + barH * 0.25, Math.max(X(b) - X(a), 2), barH * 0.5, 1);
  }

  // melatonin doses: a thin tick at the dose time
  const mel = s.melatonin;
  if (mel?.enabled && mel.start !== null) {
    g.fillStyle = c.mel;
    for (let d = 0; d < days; d++) {
      for (const h of [mod(mel.start, 24), mod(mel.start, 24) + 24]) round(X(h) - 1.5, rowY(d) + barH * 0.15, 3, barH * 0.7, 1);
    }
  }

  // DLMO markers
  g.fillStyle = c.marker;
  g.strokeStyle = c.bg;
  g.lineWidth = 1;
  for (const t of result.dlmos) {
    const d = Math.floor(t / 24);
    for (const [row, h] of [[d, t - d * 24], [d - 1, t - (d - 1) * 24]]) {
      if (row < 0 || row >= days || h > 48) continue;
      g.beginPath();
      g.arc(X(h), rowY(row) + barH / 2, Math.max(barH * 0.45, 2.2), 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
  }

  // midnight divider between the two plotted days
  g.strokeStyle = c.line;
  g.beginPath();
  g.moveTo(X(24) + 0.5, top - 2); g.lineTo(X(24) + 0.5, rowY(days));
  g.stroke();

  g.fillStyle = c.muted;
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  for (let d = 0; d < days; d += 10) g.fillText(String(d), left - 6, rowY(d) + barH / 2);
}

const svgNS = 'http://www.w3.org/2000/svg';
function el(name, attrs = {}, text) {
  const n = document.createElementNS(svgNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text !== undefined) n.textContent = text;
  return n;
}

// Shared vertical scale for PRC charts: the biggest shift on any of the curves
// (and markers) with headroom, in 6-minute steps, so charts stacked together
// compare at a glance.
export function prcScale(curves, markers = []) {
  const peakMin = Math.max(...curves.flat().map((p) => Math.abs(p.shift)), ...markers.filter(Boolean).map((m) => Math.abs(m.shift))) * 60;
  return (Math.ceil((peakMin + 4) / 6) * 6) / 60;
}

// A PRC with the person's steady-state timing marked.
// zones: [{ from, to, label }] in hours after DLMO — where a workout or dose
// helps most, shaded, with the clock times they fall at once the clock settles.
// opts: yMax (shared scale), and copy keys / line class for the melatonin chart.
export function drawPrc(svg, curve, points, marker, zones = [], opts = {}) {
  const { yAxis = 'prc.yAxis', zoneKey = 'prc.zone', markerKey = 'prc.workout', lineClass = 'prc-line' } = opts;
  // "advance ↑ / delay ↓" go right, unless a zone reaches the right edge.
  const reachesRight = zones.some((z) => z.from > z.to || z.to > 20);
  const dirSide = opts.dirSide ?? (reachesRight ? 'left' : 'right');
  svg.replaceChildren();
  const W = 720, H = 220, L = 46, R = 10, T = 12, B = 40;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const yMax = opts.yMax ?? prcScale([curve], [marker]);
  const X = (h) => L + (h / 24) * (W - L - R);
  const Y = (v) => T + (H - T - B) * (0.5 - v / (2 * yMax));
  const ticks = [];
  for (let v = -Math.floor(yMax * 10) / 10; v <= yMax + 1e-9; v += 0.1) ticks.push(Math.round(v * 10) / 10);
  for (const v of ticks) {
    svg.append(el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: v === 0 ? 'zero' : 'grid' }));
    svg.append(el('text', { x: L - 6, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }, `${v > 0 ? '+' : ''}${Math.round(v * 60)}`));
  }
  for (let h = 0; h <= 24; h += 4) svg.append(el('text', { x: X(h), y: H - B + 16, class: 'tick', 'text-anchor': 'middle' }, `${h}`));
  svg.append(el('text', { x: L + (W - L - R) / 2, y: H - 6, class: 'axis-label', 'text-anchor': 'middle' }, t('chart.dlmoAxis')));
  svg.append(el('text', { x: 12, y: T + (H - T - B) / 2, class: 'axis-label', 'text-anchor': 'middle', transform: `rotate(-90 12 ${T + (H - T - B) / 2})` }, t(yAxis)));
  // "advance ↑ / delay ↓" in a corner the zones keep clear of.
  const dirX = dirSide === 'left' ? L + 6 : W - R - 4, dirAnchor = dirSide === 'left' ? 'start' : 'end';
  svg.append(el('text', { x: dirX, y: T + 12, class: 'tick', 'text-anchor': dirAnchor }, t('chart.advance')));
  svg.append(el('text', { x: dirX, y: H - B - 6, class: 'tick', 'text-anchor': dirAnchor }, t('chart.delay')));

  for (const z of zones) {
    // A zone can wrap past 24 h (e.g. a delay window around DLMO): two rects.
    const parts = z.from <= z.to ? [[z.from, z.to]] : [[z.from, 24], [0, z.to]];
    for (const [a, b] of parts) svg.append(el('rect', { x: X(a), y: T, width: X(b) - X(a), height: H - B - T, class: 'prc-zone' }));
    // Labels go where the curve isn't: low for advance zones, high for delay zones.
    const len = z.from <= z.to ? z.to - z.from : z.to + 24 - z.from;
    const mid = (z.from + len / 2) % 24, low = curve.find((p) => p.h >= mid)?.shift >= 0;
    const anchor = mid > 20 ? 'end' : mid < 4 ? 'start' : 'middle';
    const y1 = low ? H - B - 22 : T + 42, y2 = low ? H - B - 8 : T + 56;
    svg.append(el('text', { x: X(mid), y: y1, class: 'prc-zone-label', 'text-anchor': anchor }, t(zoneKey)));
    if (z.label) svg.append(el('text', { x: X(mid), y: y2, class: 'prc-zone-label', 'text-anchor': anchor }, z.label));
  }
  const d = curve.map((p, i) => `${i ? 'L' : 'M'}${X(p.h).toFixed(1)},${Y(p.shift).toFixed(1)}`).join('');
  svg.append(el('path', { d, class: lineClass }));
  for (const p of points) svg.append(el('circle', { cx: X(p.h), cy: Y(p.v), r: 3.5, class: 'prc-point' }));
  if (marker) {
    svg.append(el('line', { x1: X(marker.h), x2: X(marker.h), y1: T, y2: H - B, class: 'prc-marker' }));
    svg.append(el('circle', { cx: X(marker.h), cy: Y(marker.shift), r: 6, class: 'prc-you' }));
    const anchor = marker.h > 14 ? 'end' : 'start';
    svg.append(el('text', { x: X(marker.h) + (anchor === 'end' ? -10 : 10), y: T + 14, class: 'prc-label', 'text-anchor': anchor },
      t(markerKey, { shift: `${marker.shift >= 0 ? '+' : ''}${Math.round(marker.shift * 60)}` })));
  }
}
