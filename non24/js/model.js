// Skeldon et al. (2023) circadian + sleep/wake model.
//
// A. C. Skeldon, T. R. Garcia, S. F. Cleator, C. della Monica, K. K. G. Ravindran,
// V. L. Revell, D.-J. Dijk. "Method to determine whether sleep phenotypes are driven
// by endogenous circadian rhythms or environmental light by combining longitudinal
// data and personalised mathematical models." PLOS Computational Biology (2023).
//
// This is a line-for-line port of the `Skeldon23` class in the open-source
// `circadian` Python package (Arcascope, v1.0.3). States are:
//   x, xc  - van der Pol-type circadian oscillator
//   n      - photoreceptor activation (Process L)
//   H      - homeostatic sleep pressure
// Sleep (S = 1) closes the eyes, so the oscillator receives no light while asleep.
// Sleep onset/offset happen when H crosses thresholds that are modulated by the
// circadian state. tauc is the intrinsic period in hours (f is chosen so that the
// free-running period in darkness equals tauc; see tests/model.test.mjs).

export const DEFAULT_PARAMS = Object.freeze({
  // sleep/wake regulation
  mu: 17.78, chi: 45.0, H0: 13.0, Delta: 1.0, ca: 1.72,
  // light / circadian
  tauc: 24.2, f: 0.99669, G: 19.9, p: 0.6, k: 0.55, b: 0.4,
  gamma: 0.23, alpha_0: 0.16, beta: 0.013, I0: 9500.0,
  kappa: 24.0 / (2.0 * Math.PI),
  // circadian modulation of the sleep/wake thresholds
  c20: 0.7896, alpha21: -0.3912, alpha22: 0.7583,
  beta21: -0.4442, beta22: 0.0250, beta23: -0.9647,
  // CBTmin -> DLMO offset (hours)
  cbt_to_dlmo: 7.0,
});

// State at midnight on a 16L:8D schedule, awake (from the Python package).
export const DEFAULT_INITIAL_STATE = Object.freeze([0.23995682, -1.1547196, 0.50529415, 12.83846474]);

const k1 = new Float64Array(4), k2 = new Float64Array(4), k3 = new Float64Array(4), k4 = new Float64Array(4);
const tmp = new Float64Array(4);

function derivs(p, s, input, S, out) {
  const x = s[0], xc = s[1], n = s[2], H = s[3];
  const light = (1.0 - S) * input;
  const alpha = p.alpha_0 * Math.pow(light / p.I0, p.p);
  const B = p.G * (1.0 - n) * alpha * (1.0 - p.b * x) * (1.0 - p.b * xc);
  const gammaTerm = p.gamma * (xc - (4.0 / 3.0) * xc * xc * xc);
  const r = 24.0 / (p.f * p.tauc);
  const taucTerm = r * r + p.k * B;
  out[0] = (1.0 / p.kappa) * (xc + B);
  out[1] = (1.0 / p.kappa) * (gammaTerm - x * taucTerm);
  out[2] = 60.0 * (alpha * (1.0 - n) - p.beta * n);
  out[3] = (1.0 / p.chi) * (-H + (1.0 - S) * p.mu);
}

// Circadian modulation of wakefulness, C(x, xc).
export function circadianDrive(p, x, xc) {
  return p.c20 + p.alpha21 * xc + p.alpha22 * x
    + p.beta21 * xc * xc + p.beta22 * xc * x + p.beta23 * x * x;
}

export class Skeldon23 {
  constructor(params = {}, initialState = DEFAULT_INITIAL_STATE, initialSleep = 0) {
    this.p = { ...DEFAULT_PARAMS, ...params };
    this.state = Float64Array.from(initialState);
    this.sleep = initialSleep;
  }

  // Advance one RK4 step of size dt (hours) with constant light `lux`.
  // `forceWake` mirrors the package's forced-wakeup option: when true the model
  // is put in the wake state after the step (e.g. alarm, lights on, exercise).
  // Order of operations matches `Skeldon23.step_rk4` exactly: integrate with the
  // current sleep state, then decide the next sleep state from the pre-step state.
  step(lux, dt, forceWake = false) {
    const p = this.p, s = this.state, S = this.sleep;
    derivs(p, s, lux, S, k1);
    for (let i = 0; i < 4; i++) tmp[i] = s[i] + k1[i] * dt / 2;
    derivs(p, tmp, lux, S, k2);
    for (let i = 0; i < 4; i++) tmp[i] = s[i] + k2[i] * dt / 2;
    derivs(p, tmp, lux, S, k3);
    for (let i = 0; i < 4; i++) tmp[i] = s[i] + k3[i] * dt;
    derivs(p, tmp, lux, S, k4);

    const x = s[0], xc = s[1], H = s[3];
    const C = circadianDrive(p, x, xc);
    let next = S;
    if (S === 0) {
      if (H >= p.H0 + 0.5 * p.Delta + p.ca * C) next = 1;
    } else if (H <= p.H0 - 0.5 * p.Delta + p.ca * C) {
      next = 0;
    }
    // What the model would do unforced; lets callers measure time held awake
    // while sleepy (e.g. the lights are on but the body wants to sleep).
    this.wantsSleep = next;
    if (forceWake) next = 0;

    for (let i = 0; i < 4; i++) s[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    this.sleep = next;
  }

  // Oscillator phase angle, as in the package: angle(x - i*xc). Increases with time;
  // equals +/-pi at the core body temperature minimum.
  phaseAngle() {
    return Math.atan2(-this.state[1], this.state[0]);
  }

  // Instantaneously shift the oscillator by `hours` (positive = advance) by rotating
  // (x, -xc) around the origin. Used to apply non-photic (exercise) phase shifts.
  shiftPhase(hours) {
    const x = this.state[0], y = -this.state[1];
    const r = Math.hypot(x, y);
    const a = Math.atan2(y, x) + (2 * Math.PI * hours) / this.p.tauc;
    this.state[0] = r * Math.cos(a);
    this.state[1] = -r * Math.sin(a);
  }
}
