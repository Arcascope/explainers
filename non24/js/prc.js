// Exercise phase response curve (PRC) after Youngstedt, Elliott & Kripke (2019).
//
// S. D. Youngstedt, J. A. Elliott, D. F. Kripke. "Human circadian phase-response
// curves for exercise." Journal of Physiology 597(8):2253-2268 (2019).
// doi:10.1113/JP276943
//
// Protocol: 60 min of moderate treadmill exercise (65-75% heart-rate reserve) on
// three consecutive days at one of eight times (01:00, 04:00, ... 22:00). Phase
// shifts of urinary aMT6s onset showed advances at 07:00 and 13:00-16:00 and delays
// at 19:00-22:00, with small shifts overnight.
//
// Anchor values are the published means from Table 3 ("Onset shift", mean h,
// n = 99): aMT6s onset phase shift after the three-day protocol at each of the
// eight laboratory clock times, already normalised for the sample's mean drift.
// (SDs 0.9-1.4 h; per-time n 10-15.)
//
// Units: `shift3d` is the total shift (hours, + = advance) after the three-day
// protocol. A single 60-minute bout is modelled as one third of it.

// Converting clock time to "hours after DLMO": the study's circadian time is
// normalised to the sample's mean baseline aMT6s onset, 22.62 h (Table 2), and
// urinary aMT6s markers run about 60 min after plasma melatonin (Methods), so
// the matching DLMO is about 21.62 h on the study clock.
export const STUDY_BASELINE_DLMO_CLOCK = 22.62 - 1.0;

export const YOUNGSTEDT_ANCHORS = Object.freeze([
  { clock: 1, shift3d: -0.3 },
  { clock: 4, shift3d: -0.1 },
  { clock: 7, shift3d: 0.9 },
  { clock: 10, shift3d: 0.1 },
  { clock: 13, shift3d: 0.7 },
  { clock: 16, shift3d: 0.9 },
  { clock: 19, shift3d: -0.5 },
  { clock: 22, shift3d: -0.7 },
]);

const BOUTS_IN_PROTOCOL = 3;
// The eight times are when each 60-minute bout started ("at 3-h intervals from
// 01:00"); shifts here are keyed to the bout's midpoint.
const BOUT_MIDPOINT = 0.5;
const REFERENCE_MINUTES = 60;

const mod = (a, n) => ((a % n) + n) % n;

// Periodic monotone cubic (Fritsch-Carlson) through points [{ h, v }] on a
// 24 h circle: passes exactly through each point and never overshoots between
// them, so peaks sit on the data rather than on interpolation artefacts.
function monotonePeriodic(points) {
  const pts = [...points].sort((a, b) => a.h - b.h);
  const n = pts.length;
  const P = (k) => { const q = mod(k, n); return { h: pts[q].h + 24 * Math.floor(k / n), v: pts[q].v }; };
  const slope = (k) => { const a = P(k), b = P(k + 1); return (b.v - a.v) / (b.h - a.h); };
  const tangent = (k) => {
    const d0 = slope(k - 1), d1 = slope(k);
    if (d0 * d1 <= 0) return 0;
    const h0 = P(k).h - P(k - 1).h, h1 = P(k + 1).h - P(k).h;
    return (3 * (h0 + h1)) / ((2 * h1 + h0) / d0 + (h1 + 2 * h0) / d1);
  };
  return (h) => {
    h = mod(h, 24);
    let k = n - 1;
    for (let j = 0; j < n; j++) if (pts[j].h <= h) k = j;
    if (h < pts[0].h) k = -1; // P(-1) is the last point shifted back 24 h
    const A = P(k), B = P(k + 1);
    const w = B.h - A.h, t = (h - A.h) / w;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * A.v + (t3 - 2 * t2 + t) * w * tangent(k) + (-2 * t3 + 3 * t2) * B.v + (t3 - t2) * w * tangent(k + 1);
  };
}

const sample = (fn, samples) => Array.from({ length: samples }, (_, i) => {
  const h = (24 * i) / (samples - 1);
  return { h, shift: fn(h) };
});

// ---------- exercise ----------

// Anchors re-expressed as hours after DLMO, per bout.
const POINTS = YOUNGSTEDT_ANCHORS
  .map(({ clock, shift3d }) => ({ h: mod(clock + BOUT_MIDPOINT - STUDY_BASELINE_DLMO_CLOCK, 24), v: shift3d / BOUTS_IN_PROTOCOL }))
  .sort((a, b) => a.h - b.h);
const exercisePrc = monotonePeriodic(POINTS);

// Phase shift in hours (+ = advance) from one bout of exercise whose midpoint falls
// `hoursAfterDlmo` hours after the person's melatonin onset. Duration scales the
// effect linearly relative to the 60-minute reference bout (an assumption; the
// study only tested 60 minutes).
export function exerciseShift(hoursAfterDlmo, minutes = REFERENCE_MINUTES) {
  return exercisePrc(hoursAfterDlmo) * (minutes / REFERENCE_MINUTES);
}

export const prcCurve = (samples = 97) => sample(exercisePrc, samples);
export const PRC_POINTS = POINTS;

// ---------- melatonin ----------

// 0.5 mg melatonin PRC from Burgess et al. (2010) J Clin Endocrinol Metab
// 95:3325-3331, Fig. 3 (the 0.5 mg fitted curve, solid line), digitised from
// the figure's pixels:
// hours relative to baseline DLMO -> phase shift in hours (+ = advance) after
// three days of daily melatonin. One dose gets a third of it, as in Emens &
// Burgess (2015). Measured in dim-light ultradian conditions, so it may
// overestimate shifts under a normal light-dark cycle.
const BURGESS_05MG = [
  [-9, -0.96], [-8, -0.55], [-7, 0.05], [-6, 0.67], [-5, 1.20], [-4, 1.52], [-3.75, 1.58],
  [-3, 1.57], [-2, 1.37], [-1, 0.94], [0, 0.42], [1, -0.06], [2, -0.43], [3, -0.61],
  [3.25, -0.63], [4, -0.59], [5, -0.43], [6, -0.20], [7, -0.02], [8, 0.02], [9, -0.05],
  [10, -0.30], [11, -0.66], [12, -1.00], [13, -1.21], [13.25, -1.25], [14, -1.22],
];
const DAYS_IN_PROTOCOL = 3;
const MEL_POINTS = BURGESS_05MG.map(([h, v]) => ({ h: mod(h, 24), v: v / DAYS_IN_PROTOCOL }));
const melatoninPrc = monotonePeriodic(MEL_POINTS);

export const melatoninShift = (hoursAfterDlmo) => melatoninPrc(hoursAfterDlmo);
export const melatoninCurve = (samples = 193) => sample(melatoninPrc, samples);

// ---------- good windows ----------

// Peaks within TIE of the biggest count as equally good (the exercise means
// carry SDs of about 1 h, and 07:00 and 16:00 are both +0.9 h).
const TIE = 0.1;

// Windows (hours after DLMO) on a PRC where a dose or workout taken at the
// same clock time every day is most likely to help: one side of each peak
// within TIE of the biggest, out to where the curve falls to half the peak.
// The side is the stable one. A long-period clock drifts later, so a fixed
// dose lands earlier relative to DLMO each day: after an advance peak that
// drift moves it back toward the peak; before it, the dose slides away into
// the delays. A short-period clock drifts the other way, so for delays it's
// the side before the peak. The peak whose stable side runs soonest into the
// opposite direction can be capped at `edgeMaxHours`.
function windowsOn(fn, kind, edgeMaxHours = Infinity) {
  const sign = kind === 'advance' ? 1 : -1;
  const step = 0.05, n = Math.round(24 / step);
  const v = (i) => sign * fn(mod(i, n) * step);
  const peaks = [];
  for (let i = 0; i < n; i++) if (v(i) >= v(i - 1) && v(i) > v(i + 1)) peaks.push(i);
  const top = Math.max(...peaks.map(v));
  const chosen = peaks.filter((i) => v(i) >= top * (1 - TIE));
  const distToFlip = (p) => {
    let j = p;
    if (kind === 'advance') { while (v(j) > 0 && j - p < n) j++; return j - p; }
    while (v(j) > 0 && p - j < n) j--; return p - j;
  };
  const edge = chosen.reduce((a, b) => (distToFlip(b) < distToFlip(a) ? b : a));
  const cap = Math.round(edgeMaxHours / step);
  return chosen.map((p) => {
    const half = v(p) / 2;
    let lo = p, hi = p;
    if (kind === 'advance') {
      while (v(hi + 1) >= half && hi - p < n / 2) hi++;
      if (p === edge) hi = Math.min(hi, p + cap);
    } else {
      while (v(lo - 1) >= half && p - lo < n / 2) lo--;
      if (p === edge) lo = Math.max(lo, p - cap);
    }
    return { from: mod(lo, n) * step, to: mod(hi, n) * step, peak: mod(p, n) * step };
  }).sort((a, b) => a.from - b.from);
}

// Exercise: for advances, only the hour after the peak right before the switch
// to delays, where the curve is least certain.
export const exerciseZones = (kind) => windowsOn(exercisePrc, kind, kind === 'advance' ? 1 : Infinity);
export const melatoninZones = () => windowsOn(melatoninPrc, 'advance');
