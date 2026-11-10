# Cut-point choice: site copy

Every user-facing string on the page lives here. Edit the text under each
`## key` heading and reload the page.

- Keep each heading (`## key`) exactly as it is; the page looks up text by it.
- Keep `{placeholders}` (like `{cut}` or `{p}`); the page fills them in.
- `*text*` shows as italic emphasis, `` `text` `` as code, and
  `[text](https://…)` as a link.
- One entry is one paragraph. Blank lines inside an entry are joined with a space.

---

## page.title
Cut-point choice in time-of-day immunotherapy studies

## page.description
A simulation of immunotherapy outcomes in which survival does not depend on infusion time, showing how the choice of a morning/afternoon cut-point affects whether a time-of-day difference appears.

## hero.title
Where to draw the line between morning and afternoon

## hero.lede
In this simulation, patient outcomes are generated without any dependence on the time of day of their immunotherapy infusions. Patients are split into a morning group and an afternoon group at a cut-point you choose, and the two groups are compared with a log-rank test. Depending on where the cut-point is placed, the comparison sometimes reaches p < 0.05.

---

## cut.legend
Cut-point

## cut.label
Afternoon starts at

## cut.hint
Patients whose median infusion time is later than the cut-point are in the afternoon group. Everyone else is in the morning group.

## cut.lowest
Show the lowest p-value

## cut.lowest.none
No cut-point can be tested

---

## data.legend
Dataset

## data.new
New dataset

## data.batch
Add 100 datasets

## data.hint
Each dataset is 250 simulated patients with their own infusion times and outcomes.

## effect.label
Simulated effect of infusion time

## effect.none
none

## effect.value
HR {hr} per hour

## effect.hint
Applies to the next dataset. Above 1.00, later infusion times shorten survival, and sicker patients are also booked slightly later. A retrospective study cannot tell these two apart, so they share one setting.

## effect.pending
The next dataset will use HR {hr} per hour.

## effect.pending.none
The next dataset will have no simulated effect.

---

## status.untested.big
The groups are not compared at this cut-point

## status.untested
At {cut}, one group has fewer than {min} patients, so the groups are not compared.

## status.none.big
No time-of-day effect at this cut-point

## status.none
At {cut}, neither progression-free survival nor overall survival differs between the morning and afternoon groups at p < 0.05.

## status.found.big
A time-of-day effect can be found at this cut-point

## status.found.one
At {cut}, {endpoint} is longer in the {group} group ({p}).

## status.found.two
At {cut}, {endpoint1} is longer in the {group1} group ({p1}), and {endpoint2} is longer in the {group2} group ({p2}).

## status.dataset.null
No effect of infusion time was simulated in this dataset. Of the {tested} cut-points that can be tested, {sig} give p < 0.05 for at least one endpoint.

## status.dataset.effect
An effect of HR {hr} per hour was simulated in this dataset. Of the {tested} cut-points that can be tested, {sig} give p < 0.05 for at least one endpoint.

## endpoint.pfs
progression-free survival

## endpoint.os
overall survival

## group.morning
morning

## group.afternoon
afternoon

---

## km.pfs
Progression-free survival

## km.os
Overall survival

## km.legend.morning
Morning (n = {n})

## km.legend.afternoon
Afternoon (n = {n})

## km.readout
HR {hr}, {p}

## km.readout.untested
Not tested

## km.axis.months
months

## km.aria
Kaplan-Meier curves for the morning and afternoon groups.

---

## hist.heading
Infusion times

## hist.hint
All infusions in this dataset. The line marks the cut-point.

## hist.axis
time of day

## hist.aria
Histogram of infusion times with the cut-point marked.

---

## scan.heading
p-value at each cut-point

## scan.hint
Each point is the smaller of the two p-values (progression-free and overall survival) for one cut-point. Points below the dashed line are under 0.05. Click the chart to move the cut-point.

## scan.untested
group under {min}

## scan.legend.morning
morning group longer

## scan.legend.afternoon
afternoon group longer

## scan.aria
p-value of the morning versus afternoon comparison at every cut-point.

---

## tally.heading
Across datasets

## tally.scope.null
Datasets with no simulated effect of infusion time. A cut-point counts when either endpoint has p < 0.05.

## tally.scope.effect
Datasets with a simulated effect of HR {hr} per hour. A cut-point counts when either endpoint has p < 0.05.

## tally.datasets
Datasets

## tally.morning
Morning group longer at some cut-point

## tally.afternoon
Afternoon group longer at some cut-point

## tally.neither
Neither

## tally.share
{n} ({pct}%)

## tally.reset
Reset

## tally.note
With no simulated effect, roughly six datasets in ten have at least one cut-point that reaches p < 0.05, and the morning group comes out ahead more often than the afternoon group. Some datasets have cut-points in both directions, so the first two rows can add to more than the total.

---

## method.heading
How the simulation works

## method.patients.title
Patients and outcomes

## method.patients.p1
Each dataset has 250 patients. Forty percent are durable responders (median overall survival 140 months), 25% fail early (4 months), and the rest are intermediate (18 months). Progression-free survival is a shorter endpoint tied to the same prognosis and ends no later than death. Follow-up is censored with a median of 36 months.

## method.patients.p2
Unless the simulated effect is above 1.00, infusion time has no influence on either endpoint.

## method.times.title
Infusion times

## method.times.p1
Patients receive an infusion every 21 days while on treatment. Their infusion times are drawn from the times recorded in a real immunotherapy cohort of 82 patients and 550 infusions, which peak in mid-morning and taper into the evening (mean about 12:40, standard deviation about 2.5 hours).

## method.times.p2
About two thirds of the variation in a patient's infusion time is from visit to visit, and one third is a stable personal slot, matching the real cohort. The page stores the real times only in aggregate: patients are sorted into five groups by their usual infusion time, and each group keeps its patients' mean times and the pooled offsets of individual infusions from those means, rounded to 5 minutes.

## method.groups.title
Groups and tests

## method.groups.p1
A patient's infusion time is the median over all their infusions. The cut-point slider runs from 09:00 to 18:00 in 15-minute steps. When either group has fewer than 30 patients, the curves are drawn in gray and no test is run. The test is a two-sided log-rank test, and the hazard ratio is the Peto estimate for the afternoon group relative to the morning group.

## method.why.title
Why the cut-point matters

## method.why.p1
Patients are infused only while they are alive and on treatment, so those with short survival have few infusions, and their median infusion time is noisy. As the cut-point moves, these patients move between groups. Testing two endpoints at many cut-points is many comparisons, and some of them will reach p < 0.05 by chance.

## method.effect.title
The simulated effect

## method.effect.p1
The effect setting is a hazard ratio per hour of later habitual infusion time. It shortens survival for patients with later habitual times, and it also shifts sicker patients toward later appointments by up to 36 minutes per prognosis level at the highest setting. Both produce an association between later infusions and worse outcomes in retrospective data.

---

## footer.data
All outcomes on this page are simulated. They do not describe real patients. Dataset seed {seed}.

## footer.source
Part of [Arcascope explainers](https://arcascope.github.io/explainers/).
