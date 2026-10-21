# Non-24 Day Planner: site copy

Every user-facing string on the site lives here. Edit the text under each
`## key` heading and reload the page.

- Keep each heading (`## key`) exactly as it is; the page looks text up by it.
- Keep `{placeholders}` (like `{time}` or `{n}`); the page fills them in.
- `*text*` shows as gold italic emphasis, `` `text` `` as code, and
  `[text](https://…)` as a link.
- One entry is one paragraph. Blank lines inside an entry are joined with a space.

---

## page.title
Non-24 Day Planner

## page.description
Explore different days, and see if entrainment is possible or not.

## hero.title
Non-24 Day Planner

## hero.lede
Explore different days, and see if entrainment is possible or not with an open-source model of the human circadian clock.

## hero.note
Educational only: not medical advice.

## clock.format.aria
Time format

## clock.format.12
AM/PM

## clock.format.24
24 h

## tabs.aria
Your day and results

## tabs.day
Your day

## tabs.results
Results

## settings.heading
Settings

---

## clock.legend
Your body clock

## clock.tau.label
Natural period (τ)

## clock.tau.value
{tau} h

## clock.tau.hint.even
Left alone in the dark, your clock would keep 24-hour time.

## clock.tau.hint.late
Left alone in the dark, your clock would run {min} min later each day.

## clock.tau.hint.early
Left alone in the dark, your clock would run {min} min earlier each day.

---

## day.legend
Your day

## day.editor.aria
24-hour day editor. Drag the handles or use the arrow keys.

## day.editor.caption
Lights {on}–{off}

## day.editor.workout
exercise zone

## day.editor.handle.lightsOn
Lights on

## day.editor.handle.lightsOff
Lights off

## day.lightsOn
Lights on

## day.lightsOff
Lights off

## day.hint
You're awake when lights are on, then in dim until you fall asleep.

## day.lux.label
Light while the lights are on

## day.lux.125
Home

## day.lux.250
Bright home

## day.lux.500
Office

## day.lux.10000
Light box or outdoors

## units.lux
{n} lux

## day.dim.label
Dim light while you're still awake

## day.dim.5
Night light

## day.dim.15
Dim lamp

## day.dim.40
Lamp and screen

## day.dim.hint
Light level you're in when the main lights are off but you're not asleep yet.

---

## activity.legend
Activity

## exercise.toggle
Daily exercise

## exercise.length
Length

## units.minutes
{n} min

## exercise.zones
Good workout windows:

## exercise.zones.one
Good workout window:

## exercise.zones.none
None of the times when exercise helps fall during your lights-on hours, so the results above leave exercise out.

## exercise.skip
Exercise wouldn't help on this day, so the results leave it out.

## exercise.skip.drifting
Exercise wouldn't make your clock settle on this day, so the results leave it out.

## melatonin.toggle
Melatonin, 0.5 mg

## melatonin.text
Good melatonin window:

## melatonin.none
No time during your lights-on hours lands in the good window, so the results above leave melatonin out.

## melatonin.skip
Melatonin wouldn't help on this day, so the results leave it out.

## melatonin.skip.drifting
Melatonin wouldn't make your clock settle on this day, so the results leave it out.

## windows.drifting
Your clock doesn't settle on this day, so there's no fixed time to aim for.

## melatonin.safety
Melatonin is a medicine. Check with a doctor or pharmacist before taking it, especially if you're pregnant, take other medicines, or have a health condition. It can make you drowsy, so don't drive after taking it.

---

## verdict.heading
Result

## verdict.calculating
Calculating

## verdict.running
Running the model…

## progress.starts
Running the model…

## progress.workout
Finding the best times…

## verdict.status.ok
Entrains

## verdict.status.some
Sometimes entrains

## verdict.status.no
Does not entrain

## verdict.status.costly
Entrains, at a cost

## verdict.status.unliveable
Don't do this

## verdict.ok
Your clock locks on to this day within *{days}*, with natural melatonin onset settling near *{dlmo}*.

## verdict.ok.costly
Your clock locks on within *{days}*, but only by sleep-depriving you.

## verdict.unliveable
Your clock might lock on, but you'd barely sleep or spend most of the day fighting sleep.

## verdict.some
Your clock usually locks on, within *{days}*, but not always: sometimes it keeps drifting.

## verdict.no
This day can't hold your clock. It keeps drifting about *{drift}*.

## range.days
{n} days

## range.upTo
up to {n}

## drift.none
about on time

## drift.later
{min} min later each day

## drift.earlier
{min} min earlier each day

## stats.daysToEntrain
Days to entrain

## stats.typical
Typical

## stats.dlmo
DLMO

## stats.sleep
Sleep once settled

## stats.sleepDuration
Sleep duration

## stats.hoursMinutes
{h} h {m} min

---

## acto.heading
Actogram

## legend.light.daylight
Bright light

## legend.light.lamp
Indoor light

## legend.light.ember
Dim light

## legend.dim
Dim light, awake

## legend.asleep
Asleep

## legend.exercise
Exercise

## legend.melatonin
Melatonin dose

## legend.dlmo
DLMO

## acto.hint.initial
An example run showing entrainment. Each row is one day, plotted twice (48 hours) so a drifting clock looks like diagonal stripes, while entrainment is vertical stripes.

## acto.hint
An example run. Each row is one day, plotted twice (48 hours) so a drifting clock shows as diagonal stripes and entrainment is vertical stripes.

## acto.days
Days shown

## acto.aria
Actogram of simulated sleep and melatonin onset

---

## cost.heading
How hard it will be

## cost.intro
Hours per day, on average.

## cost.early.initial
While you adjust

## cost.early
While you adjust

## cost.late
Once you've settled

## cost.late.drifting
After four months (still drifting)

## cost.row.sleep
Sleep per day

## cost.row.sleepy
Sleepy-but-awake hours per day

## cost.row.dim
Awake in dim light after lights-off

## difficulty.easy
Easy

## difficulty.manageable
Manageable

## difficulty.tiring
Tiring

## difficulty.hard
Hard

## difficulty.dark
A lot of dark

## cost.note.shortNights
Lights-on cuts your sleep short: you fall asleep around {onset} and the lights come on at {on}.

## cost.note.shortSleep
Even once settled, sleep runs short. Lights-off may be later or earlier than your body wants to sleep.

## cost.note.adjusting
Expect to fight sleepiness most during the adjustment period.

## cost.note.longWait
You'd spend about {hours} h a night in dim light before you can fall asleep: your lights go off earlier than your body is ready to sleep.

## tune.title
Things you can try to improve your schedule

## tune.night.desc
Lights off at {new} instead of {old}

## tune.night.action
Longer nights →

## tune.dim.desc
{new} lux instead of {old} if you're awake after lights-off

## tune.dim.action
Dimmer nights →

## tune.bright.desc
{new} lux instead of {old} while the lights are on

## tune.bright.action
Brighter light →

---

## chart.dlmoAxis
Hours after melatonin onset (DLMO)

## chart.advance
advance ↑

## chart.delay
delay ↓

## prc.heading
Exercise phase response curve

## prc.hint
How much one bout shifts the clock depending on when it happens relative to melatonin onset. Shaded: when exercise is most likely to help you, with the clock times they fall at once your clock settles.

## prc.aria
Exercise phase response curve

## prc.yAxis
Shift per bout (min)

## prc.zone
good zone

## prc.mel.heading
Melatonin phase response curve

## prc.mel.aria
Melatonin phase response curve

## prc.mel.yAxis
Shift per dose (min)

## prc.dose
Your dose: {shift} min

## prc.mel.zone
good window

## prc.workout
Your workout: {shift} min

---

## method.heading
How this works

## method.model.title
The model

## method.model.p1
The body clock and sleep come from the Skeldon et al. (2023) model: a light-driven circadian oscillator coupled to a homeostatic sleep-pressure process. Sleep pressure builds while awake and drains while asleep, and the body clock moves the thresholds for falling asleep and waking. We lower the sleep threshold slightly from the published default so a typical person (τ = 24.2 h) gets 8 hours of sleep, our baseline for good sleep. DLMO (dim-light melatonin onset) is when your body starts releasing melatonin in the evening, the standard marker of where the body clock is.

## method.model.p2
The code is a direct port of the `Skeldon23` model in the open-source `circadian` Python package.

## method.day.title
Your day

## method.day.p1
While the lights are on, the model is kept awake. After lights-off it falls asleep only when its sleep pressure crosses the threshold, and sits in dim light until then. It wakes on its own or when the lights come on, whichever is first.

## method.day.p2
A clock can entrain to a schedule like this and still be short on sleep every night. The cost panel shows that tradeoff.

## method.exercise.title
Exercise

## method.exercise.p1
Each workout shifts the clock instantly by the amount the phase response curve gives for that body-clock time. The curve follows the shape reported by Youngstedt, Elliott and Kripke (2019) for 60 minutes of moderate treadmill exercise. Their protocol used three consecutive days, so one bout gets a third of the reported shift. For a long period we highlight the stretch after each advance peak, and only the hour after the second, which sits right before the switch to delays.

## method.exercise.p2
The curve passes through the published mean onset shifts at all eight exercise times (Youngstedt et al. 2019, Table 3), placed relative to the study's average melatonin onset.

## method.entrain.title
Entrainment and cost

## method.entrain.p1
A run counts as entrained when, over its last 30 days, melatonin onset stays within 30 minutes of the same clock time and drifts less than half a minute a day. "While you adjust" covers each run's days until it entrains (at least 7). "Sleepy-but-awake hours" counts lit hours when the model would have fallen asleep or stayed asleep if it could.

## method.entrain.p2
Every person differs. Light sensitivity, caffeine and day-to-day variation are not modelled.

## method.melatonin.title
Melatonin

## method.melatonin.p1
A dose shifts the clock instantly by a third of the three-day 0.5 mg curve in Burgess et al. (2010), measured against melatonin onset, as in Emens and Burgess (2015). It was measured in dim light, so it may overestimate shifts, and melatonin's drowsiness isn't modelled. 

## method.tau.title
Finding your own τ

## method.tau.p1
Keep a sleep diary for 2–3 weeks while sleeping whenever you're tired, without alarms. Work out how much later you fall asleep each day on average and add it to 24 hours. Light in the evening stretches the period a diary shows. If your lights stay on until you fall asleep, subtract about 0.3 h (0.5 h if they're bright). If you spend the last couple of hours before sleep in dim light, the diary is about right. Falling asleep about 40 minutes later each day means τ ≈ 24.7 − 0.3 = 24.4 h.

## sources.heading
Sources

## sources.skeldon
Skeldon AC, Garcia TR, Cleator SF, della Monica C, Ravindran KKG, Revell VL, Dijk D-J. Method to determine whether sleep phenotypes are driven by endogenous circadian rhythms or environmental light by combining longitudinal data and personalised mathematical models. *PLOS Computational Biology* (2023).

## sources.youngstedt
Youngstedt SD, Elliott JA, Kripke DF. Human circadian phase–response curves for exercise. *Journal of Physiology* 597(8):2253–2268 (2019). [doi:10.1113/JP276943](https://doi.org/10.1113/JP276943)

## sources.burgess
Burgess HJ, Revell VL, Molina TA, Eastman CI. Human phase response curves to three days of daily melatonin: 0.5 mg versus 3.0 mg. *Journal of Clinical Endocrinology & Metabolism* 95(7):3325–3331 (2010).

## sources.emens
Emens JS, Burgess HJ. Effect of light and melatonin and other melatonin receptor agonists on human circadian physiology. *Sleep Medicine Clinics* 10(4):435–453 (2015).

## sources.circadian
`circadian` Python package (Arcascope). [github.com/Arcascope/circadian](https://github.com/Arcascope/circadian)

---

## footer.license
Open source under the MIT License.

## footer.disclaimer
A research and education tool. It is not medical advice. Talk to a sleep clinician before changing treatment.

