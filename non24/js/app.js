import { simulate, sweepStarts, mod, circMean, circDiff } from './simulate.js';
import { prcCurve, PRC_POINTS, exerciseZones, exerciseShift, melatoninCurve, melatoninZones, melatoninShift } from './prc.js';
import { drawActogram, drawPrc, prcScale, fmtClock, lightTier } from './charts.js';
import { loadCopy, applyCopy, t, html } from './copy.js';

const $ = (id) => document.getElementById(id);
const SNAP = 0.25; // 15-minute steps

const STARTS = 24;
// Melatonin is offered (and its chart shown) only for a long period: low-dose
// melatonin is used to pull a late-drifting clock earlier.
const MEL_MIN_TAU = 24.05;
const TUNE_STEP = 0.5; // hours lights-off moves per "Longer nights" click
const MAX_DARK = 12;
const DAY_LUX_LEVELS = [125, 250, 500, 10000]; // matches the light chips
const NIGHT_LUX_LEVELS = [5, 15, 40]; // matches the dim-light chips
const DAYS = 120;

const parseTime = (v) => { const [h, m] = v.split(':').map(Number); return h + m / 60; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const median = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };

const state = {
  tau: 24.8,
  lightsOn: 7,
  lightsOff: 23,
  dayLux: 125, // typical home light at eye level
  nightLux: 15,
  exercise: { enabled: true, start: 7.5, minutes: 60 },
  days: 60,
  melatonin: { enabled: false, start: null }, // start: dose time the simulation uses
  settledDlmo: null, // where melatonin onset settles on this day (latest run), or null
  zones: null, // exercise zones in clock time once settled: [{ from, to }] (lights-on hours only)
  melZones: null, // the melatonin window in clock time, same rules
  melHelps: null, // false when the latest run left melatonin out because it didn't help
  melSettles: null, // whether the clock settled with or without it (for that note)
  exHelps: null, // same two for exercise
  exSettles: null,
  tuneHelps: {}, // per suggestion: true once the model says it helps this day
};

const melOffered = () => state.tau > MEL_MIN_TAU;

const schedule = () => ({
  tau: state.tau,
  lightsOn: state.lightsOn,
  lightsOff: state.lightsOff,
  dayLux: state.dayLux,
  nightLux: state.nightLux,
  wakeMode: 'enforced',
  exercise: { ...state.exercise },
  melatonin: { ...state.melatonin, enabled: state.melatonin.enabled && melOffered() },
});

// ---------- suggestions ----------

// Each suggestion as a change to the day, or null where it no longer applies.
function tuneChanges() {
  const dark = mod(state.lightsOn - state.lightsOff, 24);
  const nextLux = DAY_LUX_LEVELS.find((l) => l > state.dayLux);
  const dimmer = [...NIGHT_LUX_LEVELS].reverse().find((l) => l < state.nightLux);
  return {
    night: dark + TUNE_STEP > MAX_DARK ? null : { lightsOff: mod(state.lightsOff - TUNE_STEP, 24) },
    dim: dimmer === undefined ? null : { nightLux: dimmer },
    bright: nextLux === undefined ? null : { dayLux: nextLux },
  };
}

// Suggestions show only once the model says they help (state.tuneHelps).
function renderTunes() {
  const ch = tuneChanges();
  for (const k of ['night', 'dim', 'bright']) $(`tune-${k}`).hidden = !ch[k] || state.tuneHelps[k] !== true;
  if (ch.night) $('tune-night-q').textContent = t('tune.night.desc', { new: fmtClock(ch.night.lightsOff), old: fmtClock(state.lightsOff) });
  if (ch.dim) $('tune-dim-q').textContent = t('tune.dim.desc', { new: ch.dim.nightLux, old: state.nightLux });
  if (ch.bright) $('tune-bright-q').textContent = t('tune.bright.desc', { new: ch.bright.dayLux.toLocaleString(), old: state.dayLux.toLocaleString() });
  $('tune').hidden = $('tune-night').hidden && $('tune-dim').hidden && $('tune-bright').hidden;
}

const DIFFICULTY_RANK = { easy: 0, manageable: 1, dark: 2, tiring: 2, hard: 3 };

// Does changing the day from `base` rows to `next` rows (same starting points)
// help? More starts lock on; or as many, settling sooner or more easily
// without being worse on the other. A day that never settles only counts as
// helped if the change makes it settle. Never a help: a day that becomes
// unliveable, settles melatonin onset more than MAX_EARLY_DLMO hours before
// lights-off (and earlier than before), or costs sleep once settled.
const MAX_EARLY_DLMO = 3;
const SLEEP_CUT = 0.25; // hours
function helps(base, next) {
  const ok = (rows) => rows.filter((r) => r.entrained);
  const nb = ok(base).length, nn = ok(next).length;
  const cb = costOf(base).late, cn = costOf(next).late;
  if (unliveable(cn) && !unliveable(cb)) return false;
  if (nn > 0) {
    const dlmo = circMean(ok(next).map((r) => r.dlmoClock));
    const before = nb > 0 ? circMean(ok(base).map((r) => r.dlmoClock)) : null;
    if (circDiff(state.lightsOff, dlmo) > MAX_EARLY_DLMO && (before === null || circDiff(before, dlmo) > 0)) return false;
    if (nb > 0 && cn.asleep < cb.asleep - SLEEP_CUT) return false;
  }
  if (nn !== nb) return nn > nb;
  if (nn === 0) return false;
  const days = (rows) => median(ok(rows).map((r) => r.daysToEntrain));
  const db = days(base), dn = days(next), rb = DIFFICULTY_RANK[difficulty(cb)[2]], rn = DIFFICULTY_RANK[difficulty(cn)[2]];
  return (dn < db && rn <= rb) || (dn <= db && rn < rb);
}

const TUNE_STARTS = 12; // every other one of the 24 starting points

async function checkTunes(id, s, starts) {
  const base = starts.filter((_, i) => i % (STARTS / TUNE_STARTS) === 0);
  for (const [k, change] of Object.entries(tuneChanges())) {
    if (!change) continue;
    const rows = await sweepStarts({ ...s, ...change }, { starts: TUNE_STARTS, days: DAYS });
    if (id !== runId) return;
    state.tuneHelps[k] = helps(base, rows);
    renderTunes();
  }
}

// ---------- copy helpers ----------

function driftText(minPerDay) {
  const min = Math.round(Math.abs(minPerDay));
  if (min === 0) return t('drift.none');
  return t(minPerDay > 0 ? 'drift.later' : 'drift.earlier', { min });
}

// ---------- day editor ----------

const svgNS = 'http://www.w3.org/2000/svg';
const DE = { W: 480, padX: 14, trackY: 30, trackH: 30, exY: 70, exH: 14, labelY: 118 };
const dx = (h) => DE.padX + (h / 24) * (DE.W - 2 * DE.padX);
const toHour = (px) => ((px - DE.padX) / (DE.W - 2 * DE.padX)) * 24;

function node(name, attrs, parent) {
  const n = document.createElementNS(svgNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.append(n);
  return n;
}

// Segments [a, b) of a possibly-wrapping window, in 0..24.
function segments(start, end) {
  if (start === end) return [];
  return start < end ? [[start, end]] : [[start, 24], [0, end]];
}

// Name a block, placed just past it (or before it if that would run off the
// right edge).
function blockLabel(svg, text, start, hours, y) {
  const left = dx(start), right = left + Math.max(dx(start + hours) - left, 4);
  const fits = right + 8 + text.length * 7 < DE.W;
  const label = node('text', { x: fits ? right + 8 : left - 8, y, class: 'de-block-label', 'text-anchor': fits ? 'start' : 'end' }, svg);
  label.textContent = text;
}

function drawDayEditor() {
  const svg = $('day-svg');
  svg.replaceChildren();
  node('rect', { x: dx(0), y: DE.trackY, width: dx(24) - dx(0), height: DE.trackH, rx: 6, class: 'de-track' }, svg);
  for (const [a, b] of segments(state.lightsOn, state.lightsOff)) {
    node('rect', { x: dx(a), y: DE.trackY, width: dx(b) - dx(a), height: DE.trackH, class: `de-light-${lightTier(state.dayLux)}` }, svg);
  }
  for (let h = 0; h <= 24; h += 6) {
    node('line', { x1: dx(h), x2: dx(h), y1: DE.trackY + DE.trackH + 2, y2: DE.trackY + DE.trackH + 6, class: 'de-tick' }, svg);
    const tick = node('text', { x: dx(h), y: DE.labelY, 'text-anchor': 'middle', class: 'de-label' }, svg);
    tick.textContent = String(h % 24).padStart(2, '0');
  }
  const cap = node('text', { x: dx(0), y: 19, class: 'de-cap' }, svg);
  cap.textContent = t('day.editor.caption', { on: fmtClock(state.lightsOn), off: fmtClock(state.lightsOff) });

  const ex = state.exercise;
  if (ex.enabled && state.exHelps !== false && state.zones?.length) {
    for (const z of state.zones) {
      for (const [a, b] of segments(z.from, z.to)) {
        node('rect', { x: dx(a), y: DE.exY - 3, width: Math.max(dx(b) - dx(a), 4), height: DE.exH + 6, rx: 6, class: 'de-zone' }, svg);
      }
    }
    const last = state.zones[state.zones.length - 1];
    blockLabel(svg, t('day.editor.workout'), last.from, mod(last.to - last.from, 24), DE.exY + 11);
  }
  for (const key of ['lightsOn', 'lightsOff']) {
    const h = node('rect', { x: dx(state[key]) - 6, y: DE.trackY - 5, width: 12, height: DE.trackH + 10, rx: 4, class: 'de-handle', tabindex: 0, role: 'slider',
      'aria-label': t(key === 'lightsOn' ? 'day.editor.handle.lightsOn' : 'day.editor.handle.lightsOff'), 'data-handle': key, 'aria-valuemin': 0, 'aria-valuemax': 24, 'aria-valuenow': state[key], 'aria-valuetext': fmtClock(state[key]) }, svg);
    bindDrag(h, key);
  }
}

function setDayValue(key, hour) {
  hour = mod(Math.round(hour / SNAP) * SNAP, 24);
  state[key] = hour;
  syncInputs();
  drawDayEditor();
  // keep keyboard focus on the same handle after redraw
  return $('day-svg').querySelector(`[data-handle="${key}"]`);
}

function bindDrag(elm, key) {
  elm.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const svg = $('day-svg');
    const pt = (ev) => {
      const r = svg.getBoundingClientRect();
      return toHour(((ev.clientX - r.left) / r.width) * DE.W);
    };
    let target = elm;
    const move = (ev) => { target = setDayValue(key, pt(ev)) || target; scheduleRun(); };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); target?.focus({ preventScroll: true }); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  elm.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -SNAP, ArrowDown: -SNAP, ArrowRight: SNAP, ArrowUp: SNAP, PageDown: -1, PageUp: 1 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    setDayValue(key, state[key] + step)?.focus();
    scheduleRun();
  });
}

// ---------- inputs ----------

function syncInputs() {
  $('tau-out').value = t('clock.tau.value', { tau: state.tau.toFixed(2) });
  const drift = (state.tau - 24) * 60;
  $('tau-hint').textContent = Math.abs(drift) < 1
    ? t('clock.tau.hint.even')
    : t(drift > 0 ? 'clock.tau.hint.late' : 'clock.tau.hint.early', { min: Math.round(Math.abs(drift)) });
  $('lights-on').value = fmtClock(state.lightsOn);
  $('lights-off').value = fmtClock(state.lightsOff);
  const tier = lightTier(state.dayLux);
  $('legend-light').className = `sw sw-${tier}`;
  $('legend-light-label').textContent = t(`legend.light.${tier}`);
  $('ex-fields').hidden = !state.exercise.enabled;
  renderZones();
  renderMelatonin();
  renderTunes();
  for (const r of document.querySelectorAll('input[name="day-lux"]')) r.checked = Number(r.value) === state.dayLux;
  for (const r of document.querySelectorAll('input[name="night-lux"]')) r.checked = Number(r.value) === state.nightLux;
}

function bindInputs() {
  const on = (id, ev, fn) => $(id).addEventListener(ev, (e) => { fn(e.target); syncInputs(); drawDayEditor(); scheduleRun(); });
  on('tau', 'input', (t) => {
    state.tau = Number(t.value);
    // Melatonin is only offered for a long period; switch it off when hidden.
    if (!melOffered() && state.melatonin.enabled) { state.melatonin.enabled = false; $('mel-on').checked = false; }
  });
  on('lights-on', 'change', (t) => { if (t.value) state.lightsOn = parseTime(t.value); });
  on('lights-off', 'change', (t) => { if (t.value) state.lightsOff = parseTime(t.value); });
  on('ex-on', 'change', (t) => { state.exercise.enabled = t.checked; });
  // Suggestions apply their change to the day (see tuneChanges).
  for (const k of ['night', 'dim', 'bright']) {
    $(`tune-${k}`).addEventListener('click', () => {
      const change = tuneChanges()[k];
      if (!change) return;
      Object.assign(state, change);
      syncInputs(); drawDayEditor(); scheduleRun();
    });
  }
  on('ex-min', 'change', (t) => { state.exercise.minutes = Number(t.value); });
  on('mel-on', 'change', (t) => { state.melatonin.enabled = t.checked; });
  on('days', 'change', (t) => { state.days = Number(t.value); });
  for (const [name, key] of [['day-lux', 'dayLux'], ['night-lux', 'nightLux']]) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((r) => r.addEventListener('change', () => {
      state[key] = Number(document.querySelector(`input[name="${name}"]:checked`).value);
      syncInputs(); drawDayEditor(); scheduleRun();
    }));
  }
}

// ---------- phone panes ----------

// On phones your day and the results sit side by side and are swiped between;
// the tab bar jumps to either and follows the swipe.
function bindPanes() {
  const panes = $('panes');
  const tabs = [...document.querySelectorAll('.pane-tab')];
  const list = [$('pane-controls'), $('pane-results')];
  const phone = window.matchMedia('(max-width: 860px)');
  let current = 0;
  // The scroller is as tall as the pane in view (not the taller of the two),
  // so there's no empty gap below a short pane.
  const fit = () => { panes.style.height = phone.matches ? `${list[current].offsetHeight}px` : ''; };
  // After switching panes, bring the new pane's top into view if the page is
  // scrolled past it (otherwise a swipe can land on empty space).
  const toTop = () => {
    const top = panes.getBoundingClientRect().top - tabs[0].parentElement.offsetHeight;
    if (top < 0) window.scrollBy({ top, behavior: 'smooth' });
  };
  const select = (i) => {
    if (i === current) return;
    current = i;
    tabs.forEach((tab, j) => tab.setAttribute('aria-current', String(i === j)));
    fit();
    toTop();
  };
  tabs.forEach((tab, i) => tab.addEventListener('click', () => {
    panes.scrollTo({ left: list[i].offsetLeft - panes.offsetLeft, behavior: 'smooth' });
    select(i);
  }));
  panes.addEventListener('scroll', () => select(Math.round(panes.scrollLeft / Math.max(panes.clientWidth, 1))), { passive: true });
  new ResizeObserver(fit).observe(list[0]);
  new ResizeObserver(fit).observe(list[1]);
  phone.addEventListener('change', fit);
  fit();
}

// ---------- running ----------

let timer = null;
let runId = 0;
let lastResult = null;

function scheduleRun() {
  clearTimeout(timer);
  timer = setTimeout(run, 120);
}

function fillList(dl, rows) {
  dl.replaceChildren(...rows.map(([k, v]) => {
    const d = document.createElement('div');
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    d.append(dt, dd);
    return d;
  }));
}

const hrs = (h) => `${h.toFixed(1)} h`;

// "Good … windows: [08:45–12:45] [14:30–16:00]" as pills, or a note when none
// fall during the lights-on hours.
function renderWindows(target, zones, oneKey, manyKey, noneKey) {
  if (!zones) { target.replaceChildren(); return; }
  if (state.settledDlmo === null) { target.textContent = t('windows.drifting'); return; }
  if (!zones.length) { target.textContent = t(noneKey); return; }
  const label = document.createElement('span');
  label.textContent = t(zones.length > 1 ? manyKey : oneKey);
  target.replaceChildren(label, ...zones.map((z) => {
    const pill = document.createElement('span');
    pill.className = 'time-pill';
    pill.textContent = `${fmtClock(z.from)}–${fmtClock(z.to)}`;
    return pill;
  }));
}

function renderMelatonin() {
  const offered = melOffered();
  $('mel-row').hidden = !offered;
  $('mel-fields').hidden = !(offered && state.melatonin.enabled);
  if (!offered || !state.melatonin.enabled) return;
  if (state.melHelps === false) $('mel-windows').textContent = t(state.melSettles ? 'melatonin.skip' : 'melatonin.skip.drifting');
  else renderWindows($('mel-windows'), state.melZones, 'melatonin.text', 'melatonin.text', 'melatonin.none');
}

// A day nobody could live on, whatever the clock does: hardly any sleep, or
// fighting sleep or sitting in the dark for most of it.
const unliveable = (c) => c.asleep < 4.5 || c.fighting > 10 || c.dim > 8;

function renderVerdict(starts, example, cost) {
  const ok = starts.filter((r) => r.entrained);
  const pill = $('pill');
  const stats = [];
  const set = (cls, status, key, vars) => {
    pill.className = `status ${cls}`;
    pill.textContent = t(status);
    $('tab-status').className = `status ${cls} tab-status`;
    $('tab-status').textContent = t(status);
    $('verdict-main').innerHTML = html(key, vars);
  };
  if (ok.length === 0) {
    set('no', 'verdict.status.no', 'verdict.no', { drift: driftText(median(starts.map((r) => r.driftMinPerDay))) });
  } else {
    const d = ok.map((r) => r.daysToEntrain);
    const slowest = Math.max(...d);
    const days = t('range.days', { n: slowest });
    const dlmo = circMean(ok.map((r) => r.dlmoClock));
    if (unliveable(cost.late)) {
      set('no', 'verdict.status.unliveable', 'verdict.unliveable', {});
    } else if (ok.length < starts.length) {
      set('some', 'verdict.status.some', 'verdict.some', { days });
    } else if (difficulty({ ...cost.late, dim: 0 })[2] === 'hard') {
      // "Only by sleep-depriving you": hard on sleep or sleepiness alone (a long
      // dim-light wait with plenty of sleep makes the day hard, not depriving).
      set('some', 'verdict.status.costly', 'verdict.ok.costly', { days });
    } else {
      set('ok', 'verdict.status.ok', 'verdict.ok', { days, dlmo: fmtClock(dlmo) });
    }
    stats.push([t('stats.daysToEntrain'), t('range.upTo', { n: slowest })], [t('stats.typical'), t('range.days', { n: median(d) })], [t('stats.dlmo'), fmtClock(dlmo)]);
  }
  if (example.sleepSummary && example.entrainment.entrained) {
    stats.push([t('stats.sleep'), `${fmtClock(example.sleepSummary.onsetClock)}–${fmtClock(example.sleepSummary.wakeClock)}`]);
  }
  fillList($('stats'), stats);
}

// Average daily cost over each run's adjustment window and its final week.
// The settled cost comes from the runs that entrain (a start or two that never
// lock on shouldn't pull the settled numbers toward a drifting clock); only
// when none do is it the last week of drifting.
function costOf(starts) {
  const adjusting = (r) => Math.max(r.entrained ? r.daysToEntrain : 14, 7); // days, at least a week
  const avg = (rows, key, from, to) => mean(rows.map((r) => mean(Array.from(r.daily[key].slice(from(r), to(r))))));
  const ok = starts.filter((r) => r.entrained);
  const settled = ok.length > 0;
  const early = (key) => avg(starts, key, () => 0, adjusting);
  const late = (key) => avg(settled ? ok : starts, key, () => DAYS - 7, () => DAYS);
  return {
    settled,
    early: { asleep: early('asleep'), fighting: early('fightingSleep'), dim: early('awakeInDim') },
    late: { asleep: late('asleep'), fighting: late('fightingSleep'), dim: late('awakeInDim') },
  };
}

// Judged on the settled state (the lasting cost). Each measure gets a level
// (0 easy .. 3 hard) and the label is the worst of them, so a short sleep, a
// long stretch of sleepy-but-awake hours, or a long wait in dim light after
// lights-off each rules out "Easy". Bands are wide: some sleepy time before bed
// is normal even for a well-matched clock.
const DIFFICULTY_BANDS = {
  asleep: [7, 6.5, 6], // at least this many hours for easy / manageable / tiring
  fighting: [2.5, 4.5, 7], // under this many sleepy-but-awake hours
  dim: [1, 2, 3.5], // under this many hours awake in dim light after lights-off
};
function difficulty(c) {
  const level = (v, [a, b, d], higherIsBetter) => {
    const ok = (x) => (higherIsBetter ? v >= x : v < x);
    return ok(a) ? 0 : ok(b) ? 1 : ok(d) ? 2 : 3;
  };
  const body = Math.max(
    level(c.asleep, DIFFICULTY_BANDS.asleep, true),
    level(c.fighting, DIFFICULTY_BANDS.fighting, false),
  );
  const dark = level(c.dim, DIFFICULTY_BANDS.dim, false);
  // When the long wait in dim light is the main problem (sleep and sleepiness
  // are fine), it isn't tiring so much as a lot of time in the dark.
  if (dark >= 2 && dark > body) return ['some', t('difficulty.dark'), 'dark'];
  const worst = Math.max(body, dark);
  return [
    ['ok', t('difficulty.easy'), 'easy'],
    ['ok', t('difficulty.manageable'), 'manageable'],
    ['some', t('difficulty.tiring'), 'tiring'],
    ['no', t('difficulty.hard'), 'hard'],
  ][worst];
}

function renderCost(c) {
  const [cls, label] = difficulty(c.late);
  $('cost-pill').className = `status ${cls}`;
  $('cost-pill').textContent = label;
  $('cost-early-h').textContent = t('cost.early');
  const rows = (x) => [
    [t('cost.row.sleep'), hrs(x.asleep)],
    [t('cost.row.sleepy'), hrs(x.fighting)],
    [t('cost.row.dim'), hrs(x.dim)],
  ];
  fillList($('cost-early'), rows(c.early));
  fillList($('cost-late'), rows(c.late));
  $('cost-late-h').textContent = t(c.settled ? 'cost.late' : 'cost.late.drifting');
  const notes = [];
  if (c.settled && c.late.asleep < 7) {
    // Say lights-on cuts sleep short only when that's what's happening: the
    // settled sleep ends right as the lights come on.
    const sl = lastResult?.entrainment.entrained ? lastResult.sleepSummary : null;
    const cut = sl && sl.hoursPerDay < 7 && Math.abs(circDiff(sl.wakeClock, state.lightsOn)) < 0.25;
    notes.push(cut
      ? t('cost.note.shortNights', { onset: fmtClock(sl.onsetClock), on: fmtClock(state.lightsOn) })
      : t('cost.note.shortSleep'));
  }
  if (c.settled && c.early.fighting > c.late.fighting + 0.75) notes.push(t('cost.note.adjusting'));
  if (c.settled && c.late.dim >= DIFFICULTY_BANDS.dim[1]) notes.push(t('cost.note.longWait', { hours: c.late.dim.toFixed(1) }));
  $('cost-note').textContent = notes.join(' ');
}

function renderPrc(r) {
  const last = (a) => (a?.length ? { h: a[a.length - 1].hoursAfterDlmo, shift: a[a.length - 1].shift } : null);
  const marker = state.exercise.enabled ? last(r.bouts) : null;
  const showMel = melOffered();
  const melMarker = showMel && state.melatonin.enabled ? last(r.doses) : null;
  // Zones on the DLMO axis, labelled with the clock times they fall at once
  // settled (when the clock settles with that workout or dose in place).
  // Zones that fall while the lights are off are left out (no workouts or
  // doses then); unlabelled while the clock doesn't settle.
  // Zones switched off are shown without times; zones left out because they
  // wouldn't help aren't shown at all.
  const bare = (defs) => defs.map((z) => ({ from: z.from, to: z.to, label: '' }));
  const label = (defs, len) => (state.settledDlmo === null ? bare(defs) : defs.flatMap((z) => {
    const c = clipZone(state.settledDlmo, z, len);
    return c ? [{ from: z.from, to: z.to, label: `${fmtClock(c.from)}–${fmtClock(c.to)}` }] : [];
  }));
  const zonesFor = (on, helps, defs, len) => (!on ? bare(defs) : helps === false ? [] : label(defs, len));
  const exCurve = prcCurve(), melCurve = melatoninCurve();
  const yMax = prcScale(showMel ? [exCurve, melCurve] : [exCurve], [marker, melMarker]);
  drawPrc($('prc-svg'), exCurve, PRC_POINTS, marker, zonesFor(state.exercise.enabled, state.exHelps, zoneDefs()), { yMax });
  $('mel-prc').hidden = !showMel;
  if (showMel) {
    drawPrc($('mel-prc-svg'), melCurve, [], melMarker, zonesFor(state.melatonin.enabled, state.melHelps, melatoninZones(), 0),
      { yMax, yAxis: 'prc.mel.yAxis', zoneKey: 'prc.mel.zone', markerKey: 'prc.dose', lineClass: 'prc-line mel' });
  }
}

function renderMain() {
  if (!lastResult) return;
  // Legend entries only for what the shown run actually includes.
  $('legend-ex').hidden = !lastResult.schedule.exercise?.enabled;
  $('legend-mel').hidden = !lastResult.schedule.melatonin?.enabled;
  const view = { ...lastResult, days: Math.min(state.days, lastResult.days) };
  drawActogram($('actogram'), view);
}

// The run shown in the actogram: the start whose days-to-entrain is the median
// (or the first start, if none entrain).
function exampleStart(starts) {
  const ok = starts.filter((r) => r.entrained);
  if (!ok.length) return starts[0].startDlmoClock;
  const m = median(ok.map((r) => r.daysToEntrain));
  return ok.find((r) => r.daysToEntrain === m).startDlmoClock;
}

// Where the clock settles from a few starting points: dlmo is the entrained
// DLMO clock time (null if none entrain), and solid is true when every start
// locks on, all within an hour of each other. Strong timed doses or workouts
// can leave a second, later resting point (a dose that lands early on a late
// clock delays it and holds it there), which solid rules out.
async function settle(s) {
  const rows = await sweepStarts(s, { starts: 6, days: DAYS });
  const ok = rows.filter((r) => r.entrained);
  if (!ok.length) return { dlmo: null, solid: false };
  const dlmo = circMean(ok.map((r) => r.dlmoClock));
  const solid = ok.length === rows.length && ok.every((r) => Math.abs(circDiff(r.dlmoClock, dlmo)) < 1);
  return { dlmo, solid };
}

// Exercise zones (hours after DLMO): advance windows for tau above 24 h, the
// delay window for tau below 24 h (see windowsOn in prc.js).
const zoneDefs = () => exerciseZones(state.tau >= 24 ? 'advance' : 'delay');

// The zones as clock windows for a given DLMO, clipped to the lights-on hours
// (no workouts during the night's sleep period); empty ones are dropped.
function clipZone(dlmo, z, len = state.exercise.minutes / 60) {
  const lit = mod(state.lightsOff - state.lightsOn, 24);
  let a = mod(dlmo + z.from - state.lightsOn, 24), b = a + mod(z.to - z.from, 24);
  if (a > lit) { a -= 24; b -= 24; } // a zone that starts before lights-on
  a = Math.max(a, 0); b = Math.min(b, lit);
  return b - a >= Math.min(len, 0.5) ? { from: mod(state.lightsOn + a, 24), to: mod(state.lightsOn + b, 24), off: a, len: b - a } : null;
}

function clockZones(dlmo) {
  return zoneDefs().map((z) => clipZone(dlmo, z)).filter(Boolean);
}
const melClockZones = (dlmo) => melatoninZones().map((z) => clipZone(dlmo, z, 0)).filter(Boolean);

// Where the simulation puts the workout and the dose: the workout in the
// middle of a zone (the earlier one when there are two: the later one sits
// right before the switch to delays, where the curve is least certain),
// the dose in the middle of the melatonin window. Windows are measured from
// the DLMO the person ends up entrained at, which itself depends on them, so
// repeat until the placement stops moving, keeping only placements that still
// entrain. Each returns null when no window falls in the lights-on hours.
const exStartIn = (dlmo) => {
  const zs = clockZones(dlmo);
  if (!zs.length) return null;
  const z = zs[0];
  const off = Math.max(z.off, z.off + z.len / 2 - state.exercise.minutes / 120);
  return mod(state.lightsOn + Math.ceil(off / SNAP - 1e-9) * SNAP, 24);
};
const melStartIn = (dlmo) => {
  const zs = melClockZones(dlmo);
  if (!zs.length) return null;
  const z = zs[zs.length - 1];
  return mod(state.lightsOn + Math.round((z.off + z.len / 2) / SNAP) * SNAP, 24);
};

// Lights-on hours, latest first (doses close to lights-off are the safer bet
// for a long-period clock), as fallback dose times.
function litHoursLatestFirst() {
  const lit = mod(state.lightsOff - state.lightsOn, 24);
  const out = [];
  for (let off = lit - 0.5; off >= 0; off -= 1) out.push(mod(state.lightsOn + off, 24));
  return out;
}

// Places the workout and the dose together: from where the clock settles
// without them, put each in the middle of its window, re-measure where the
// clock settles with them, and repeat until the times stop moving. A step is
// kept only if the clock still settles (and stays solid, if it was), so the
// result is the last placement that worked. Returns false if a newer run took
// over.
async function placeAll(id) {
  const s = schedule();
  const exOn = s.exercise.enabled, melOn = s.melatonin.enabled;
  const apply = ({ ex, mel }) => ({
    ...s,
    exercise: { ...s.exercise, enabled: exOn && ex !== null, start: ex },
    melatonin: { ...s.melatonin, enabled: melOn && mel !== null, start: mel },
  });
  const from = (dlmo) => ({ ex: exOn ? exStartIn(dlmo) : null, mel: melOn ? melStartIn(dlmo) : null });
  const same = (a, b) => [a.ex, a.mel].every((v, i) => {
    const w = [b.ex, b.mel][i];
    return v === w || (v !== null && w !== null && Math.abs(circDiff(v, w)) < SNAP);
  });

  const anchor = (await settle(apply({ ex: null, mel: null }))).dlmo ?? mod(state.lightsOff - 1.5, 24); // no anchor: a typical DLMO
  let cur = from(anchor);
  let res = await settle(apply(cur));
  // Nothing settles: try dose times until one does.
  if (res.dlmo === null && melOn) {
    for (const mel of litHoursLatestFirst()) {
      if (id !== runId) return false;
      const r = await settle(apply({ ...cur, mel }));
      if (r.dlmo !== null) { cur = { ...cur, mel }; res = r; break; }
    }
  }
  for (let round = 0; round < 5 && res.dlmo !== null; round++) {
    if (id !== runId) return false;
    const next = from(res.dlmo);
    if (same(next, cur)) break;
    const r = await settle(apply(next));
    if (r.dlmo === null || (res.solid && !r.solid)) break;
    cur = next; res = r;
  }
  if (id !== runId) return false;
  state.exercise.start = cur.ex;
  state.melatonin.start = cur.mel;
  return true;
}

function renderZones() {
  if (!state.exercise.enabled) return;
  if (state.exHelps === false) $('ex-windows').textContent = t(state.exSettles ? 'exercise.skip' : 'exercise.skip.drifting');
  else renderWindows($('ex-windows'), state.zones, 'exercise.zones.one', 'exercise.zones', 'exercise.zones.none');
}

async function run() {
  const id = ++runId;
  state.tuneHelps = {};
  renderTunes();
  $('tab-status').className = 'status tab-status';
  $('tab-status').textContent = '…';
  const s0 = schedule();
  if (s0.exercise.enabled || s0.melatonin.enabled) {
    $('sweep-progress').textContent = t('progress.workout');
    if (!(await placeAll(id))) return;
  }
  const s = schedule();
  // No window during lights-on hours: leave it out.
  if (s.exercise.start === null) s.exercise.enabled = false;
  if (s.melatonin.start === null) s.melatonin.enabled = false;
  $('sweep-progress').textContent = t('progress.starts');
  let starts = await sweepStarts(s, { starts: STARTS, days: DAYS });
  if (id !== runId) return;
  // Melatonin and exercise only where they help: once settled, the dose or
  // workout must still shift the clock the way it needs to go (earlier for a
  // long period, later for a short one), and the day must go better with it
  // than without (see helps()). Otherwise it's left out of the results.
  const want = state.tau >= 24 ? 1 : -1;
  const gate = async (key, shiftAt) => {
    if (!s[key].enabled) return null;
    const plain = await sweepStarts({ ...s, [key]: { ...s[key], enabled: false } }, { starts: STARTS, days: DAYS });
    if (id !== runId) return undefined;
    const ok = starts.filter((r) => r.entrained);
    const right = ok.length > 0 && want * shiftAt(circMean(ok.map((r) => r.dlmoClock))) > 0;
    const good = right && helps(plain, starts);
    const settles = ok.length > 0 || plain.some((r) => r.entrained);
    if (!good) { starts = plain; s[key] = { ...s[key], enabled: false }; }
    return { good, settles };
  };
  const mel = await gate('melatonin', (dlmo) => melatoninShift(mod(s.melatonin.start - dlmo, 24)));
  if (mel === undefined) return;
  state.melHelps = mel && mel.good; state.melSettles = mel?.settles;
  const ex = await gate('exercise', (dlmo) => exerciseShift(mod(s.exercise.start + s.exercise.minutes / 120 - dlmo, 24), s.exercise.minutes));
  if (ex === undefined) return;
  state.exHelps = ex && ex.good; state.exSettles = ex?.settles;
  const exStart = exampleStart(starts);
  lastResult = simulate(s, { startDlmoClock: exStart, days: DAYS });
  const cost = costOf(starts);
  renderVerdict(starts, lastResult, cost);
  const okStarts = starts.filter((r) => r.entrained);
  state.settledDlmo = okStarts.length ? circMean(okStarts.map((r) => r.dlmoClock)) : null;
  // Windows from where the clock settles; if it never does, from a typical DLMO
  // for these lights so there is still something to aim for.
  const anchor = state.settledDlmo ?? mod(state.lightsOff - 1.5, 24);
  state.zones = clockZones(anchor);
  state.melZones = melClockZones(anchor);
  renderZones();
  drawDayEditor();
  renderMelatonin();
  renderCost(cost);
  renderMain();
  renderPrc(lastResult);
  $('acto-hint').textContent = t('acto.hint');

  $('sweep-progress').textContent = '';
  await checkTunes(id, s, starts);
}

// Redraw canvas on resize and theme change (canvas colours are read from CSS tokens).
let resizeTimer = null;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderMain, 100); });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderMain);
new MutationObserver(renderMain).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

await loadCopy();
applyCopy();
syncInputs();
drawDayEditor();
bindInputs();
bindPanes();
run();
