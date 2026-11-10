# Cut-point choice

A browser page that simulates immunotherapy outcomes in which survival does not
depend on infusion time, splits patients into morning and afternoon groups at a
cut-point the reader chooses, and compares the groups with a log-rank test.

- Kaplan-Meier curves for progression-free and overall survival at the cut-point
- A histogram of infusion times with the cut-point marked
- The p-value at every cut-point from 09:00 to 18:00
- A running count, across datasets, of how often some cut-point reaches p < 0.05
- An optional simulated effect of infusion time, for comparison

It is a cleaned-up version of the cut-point game in the
`tod-immunotherapy-bias-sandbox` project (`simple.html`), rewritten as plain ES
modules with the same parameters and statistics. The look follows the amplitude
explainer (Merriweather Light headings, Work Sans body, light grey paper).

## Run it

```sh
npm start        # python3 -m http.server 8080, then open http://localhost:8080
npm test         # node --test (Node 18+)
```

ES modules need to be served over HTTP, so opening `index.html` from disk will
not work. Add `?seed=1234` to the URL to load a specific dataset.

## Editing the copy

Every user-facing string lives in [`copy.md`](copy.md), one `## key` heading per
string. Edit the text, keep the keys and `{placeholders}`, and reload. `npm test`
checks that every key the page uses exists.

## Files

| File | What it does |
|---|---|
| `js/sim.js` | Cohort generator, Kaplan-Meier, log-rank test, cut-point scan |
| `js/times.js` | Real infusion times in aggregate form (see below) |
| `js/app.js` | Page wiring and SVG charts |
| `js/copy.js` | Loads `copy.md` |

## Infusion times

Infusion times come from a real immunotherapy cohort (82 patients, 550
infusions). Because this repository is public, `js/times.js` does not store any
patient's times. Patients are sorted by mean infusion hour into five groups;
each group keeps its patients' mean hours and the pooled offsets of every
infusion from its patient's mean, rounded to 5 minutes and shuffled.

This changes the rates slightly from the original game, which bootstrapped each
real patient's own times. Over 2,000 datasets with no simulated effect:

| Times | Morning cut found | Afternoon cut found | Any cut found |
|---|---|---|---|
| Per patient (original game) | 35% | 27% | 57% |
| Five groups (this page) | 40% | 30% | 64% |

The copy only claims "roughly six datasets in ten" and "morning more often than
afternoon", which holds for both.
