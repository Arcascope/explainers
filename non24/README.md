# Non-24 Day Planner

A browser tool for people with non-24-hour sleep–wake disorder. Pick your intrinsic
circadian period (τ), design one repeating day of light, darkness and exercise, and
see whether a mathematical model of the human clock predicts you would entrain to it.

- **Actogram** of 120 simulated days (sleep, light, exercise, melatonin onset)
- **Days to entrain** across 24 starting body-clock phases, and the **sleep cost**
  while adjusting and once settled
- **Suggestions** (longer nights, dimmer nights, brighter light), **exercise
  zones**, and melatonin (0.5 mg) for long periods (Burgess et al. 2010)
- **Exercise and melatonin phase response curves** with your timing marked

The look follows Arcascope's jetlag.gy (Merriweather Light headings with gold
italic emphasis, Work Sans body, the daylight → lamp → ember light ramp with
near-black sleep) on a reddish-purple ground.

## Run it

```sh
npm start        # python3 -m http.server 8080, then open http://localhost:8080
npm test         # node --test (Node 18+)
```

Any static host works (GitHub Pages, Netlify, Firebase Hosting). ES modules need to
be served over HTTP, so opening `index.html` from disk will not work.

## Editing the copy

Every user-facing string lives in [`copy.md`](copy.md), one `## key` heading per
string. Edit the text, keep the keys and `{placeholders}`, and reload. `*text*`
renders as gold emphasis. `npm test` checks that every key the page uses exists.

## Model

| Piece | Source | File |
|---|---|---|
| Circadian oscillator + sleep homeostat | Skeldon et al., *PLOS Comput Biol* (2023) | `js/model.js` |
| Exercise phase response curve | Youngstedt, Elliott & Kripke, *J Physiol* 597:2253 (2019) | `js/prc.js` |
| Simulation, entrainment metrics | this project | `js/simulate.js` |

`js/model.js` is a line-for-line port of `Skeldon23` from the
[`circadian`](https://github.com/Arcascope/circadian) Python package (v1.0.3). The
test suite checks states and sleep/wake transitions against that package's output
(`tests/skeldon23_reference.json`, 16L:8D at 500 lux, dt = 0.1 h) to 1e-6. τ maps
directly to the model's `tauc`; the tests confirm the free-running period in darkness
equals τ.

**Baseline sleeper.** The package's default sleep threshold (H0 = 13) sleeps
about 7.4 h. We use H0 = 12.2 (`SLEEP_PARAMS` in `js/simulate.js`), so a tau-24.2
person on lights 07:00–20:00 (500 lux, dim light after, kept awake while lit)
falls asleep about 40 min earlier and sleeps 8.0 h (22:54–07:00). `js/model.js`
keeps the package defaults so the reference test still checks the port.

**Sleep and light.** The person is kept awake while the lights are on (the
package's forced-wakeup option) and during exercise. After lights-off the model
falls asleep only when its sleep pressure allows, sitting in dim light until then;
asleep, it receives no light. Every schedule is simulated from 24 starting phases
(one per hour of DLMO), and the page reports the range of days to entrain plus the
sleep cost: hours asleep, hours held awake while the model wanted to sleep, and
hours awake in dim light, during adjustment and once settled. Workouts
are kept inside the lights-on hours.

**Exercise.** At the midpoint of each bout, the oscillator is rotated in the
(x, −xc) plane by the PRC value for the current body-clock time, measured in hours
after DLMO (CBTmin − 7 h). Youngstedt et al. gave exercise on three consecutive days,
so one 60-minute bout gets one third of the reported shift; other durations scale
linearly (an assumption).

The PRC anchors are the published means of Table 3 (aMT6s onset shift at the
eight exercise times, n = 99, normalised for mean drift). Clock times are placed
relative to DLMO using the sample's mean baseline aMT6s onset (22.62 h, Table 2)
minus ~1 h for the urinary-vs-plasma lag (Methods). Between anchors the curve is
a periodic monotone cubic, so it never overshoots the data. Melatonin works the
same way, using a third of Burgess et al.'s three-day 0.5 mg curve (2010, Fig. 3).

**Entrainment.** A run is entrained when, over the final 30 days of a 120-day run,
DLMO stays within ±30 min of its circular mean and a linear fit shows less than
0.5 min/day of residual drift (slow drift can sit inside the band for weeks, then
slip a whole cycle). Days to entrain is the first day after
which DLMO never leaves that window.

## Not medical advice

This is a research and education tool. Individual light sensitivity, napping,
masking and day-to-day variation are not modelled.

## License

MIT
