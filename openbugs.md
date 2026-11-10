# Open bugs

Known problems and unverified behaviour. Roadmap items live in `CLAUDE.md`.

## Needs testing on a real harmonica

Everything about bends so far was reproduced and fixed against simulated audio only. Simulations
have already missed real failures twice, so none of these count as fixed until tried on a harp.

### Draw 5 misread on a phone (needs a recording)

- **Reported:** on Android, with the key set to C, draw 5 gave `5` (E5), `5+–` (E5+G#7) and `–` (A3)
  instead of `-5` (F5). Screenshot only, no audio yet.
- **Reading the symptoms:** all three fit one sound near E5. A3 is a third of E5 (220 Hz), so a
  quiet low peak (breath or handling rumble) was probably taken as the fundamental, with E5 as its
  3rd harmonic. The single-overtone rule added for the draw 4 bend (`SINGLE_OVERTONE_MIN_RATIO`,
  harmonics up to `SINGLE_OVERTONE_MAX_HARMONIC = 3`) allows exactly that, and `LOWEST_HARMONICA_NOTE`
  (190 Hz) is key-independent, so A3 passes even though a C harp's lowest note is C4. G#7 is E5's 5th
  harmonic reported as a second note. E5 rather than F5 suggests draw 5 played flat (draw 5 bends
  toward the blow reed's E5) or the blow reed sounding.
- **Fix (awaiting retest):** at first nothing outside the selected harp's range was reported. The
  user then asked for those notes back (labelled `n/a`), so now an out-of-range sound is reported
  only when nothing in range is sounding. The protections below still hold. `PitchDetector.setRange` gets `Harmonica.range` (lowest to highest playable note, ±50
  cents) on every hop. An out-of-range sound still claims its own overtones (so a low hum doesn't
  show up as its octave), but can't be reported, can't replace a note as its lower fundamental, and
  can't absorb a note as its overtone. So the A3 rumble no longer replaces E5, and G#7 no longer
  shows beside it. Any played note with no hole, in range or not, shows `n/a`.
- **Still open:** E5 rather than F5. Get a WAV from Settings → Recent recordings, note
  exactly what was played, and use it as a fixture. Draw 4 bend was confirmed fixed on a real harp in
  the same session, so any change must keep it working.

### Draw 4 bend showed `–` (confirmed fixed on a real harp)

- **Reported:** bending draw 4 wrote just `–`.
- **Likely cause:** the fundamental was quiet and only its octave was loud, so the octave was
  reported as the note. On a C harp that is C#6, which the harp doesn't have, hence `–`. The letters
  shown with the note and the harp key were not reported, so this is reproduced by simulation, not
  confirmed.
- **Fix:** `SINGLE_OVERTONE_MIN_RATIO` in `src/core/pitchDetector.ts` accepts a quiet fundamental
  with one loud overtone (2nd or 3rd harmonic), if it is at least 15% as loud as that overtone.
- **Still fails:** a fundamental under 15% of its overtone still shows `–`. 15% was picked by
  measurement: at 8%, 74 of 960 clean notes dropped an octave under heavy breath; at 15%, 0 did.
- **Confirmed:** `-4'` read correctly on a real harmonica (Android phone, 2026-11-07).
- **Retest:** other bends. If it fails, note the letters and the harp key. C#6 means a very
  quiet fundamental; anything else is a different cause. Also check the key selected in the app
  matches the harp.

### Bends showed `–+–+–` (fix awaiting retest)

`–` was the no-hole label at the time; it is now `n/a`.

- **Reported:** bends came out as chords of `–`.
- **Cause (simulated):** overtones of a weak fundamental were reported as a chord.
- **Fix:** `absorbIntoWeakFundamentals` in `src/core/pitchDetector.ts`, and `holeLabel` now matches
  by note name. In the simulations it gives `-3"` where it gave `–` before. `-4'` was the first real
  retest and showed the gap above, so other bends are still unconfirmed.

### Background noise written as `n/a` entries (fixed in 0.5.1 for a C harp)

- **Reported (2026-11-10):** recording for a moment on a train, with nothing played, wrote many
  entries. WAV: `src/core/fixtures/train-noise-C-48k.wav` (7 s, C harp, 48 kHz phone mic).
- **Cause:** all of it was below a C harp: engine rumble near G1 (49 Hz) and broadband noise
  around A3 (220 Hz). Since 0.5.0 an out-of-range sound is shown when nothing in range is
  sounding, so the noise came out as 25 `n/a` entries.
- **Fix:** with a harp selected, an out-of-range sound is only reported if it is at least 190 Hz
  (where some harmonica could play it) and a clear tone: its peak at least 20× the median level
  within half an octave (`MIN_OUT_OF_RANGE_PROMINENCE`). Noise peaks in the recording scored at
  most 12.3; a clean tone scores in the hundreds. Tested by `recordedAudio.test.ts`, which replays
  the WAV through the reader and stabilizer.
- **Still open:** the check only covers sounds outside the selected harp. Replaying the same WAV
  with the key set to G or A (whose range includes A3) still writes 7–8 entries. Applying it to
  in-range notes risks quiet bend fundamentals (the draw 4 bend fix), so wait for a real recording
  of a bend, or of noise on a lower harp, before extending it. A real out-of-range harp note in
  noise hasn't been tried either.

### One note written as several entries (reported on 0.5.0, needs a recording)

- **Reported (2026-11-09):** playing blow 5 once wrote several entries. The user's dog was howling
  along at the time.
- **Possible causes:** the dog, since an out-of-range sound on its own is shown again since 0.5.0;
  the note wobbling across a semitone boundary; or the note dropping out for a hop and committing
  again. The user also said "not sensitive enough", so it isn't yet clear whether notes are
  missed as well.
- **Next:** a WAV without the dog, with exactly what was played, the key and a screenshot. Don't
  tune thresholds before then.

## Open behaviour

### A bend may show as a chord with its second reed

Simulated only: a bend that also sounds the other reed gives something like `3/-2+-3"`. How often
real bends do this is unknown. Reliable handling would need a recording.

### Stray notes in very breathy playing

In the heaviest simulated breath noise with pitch wobble, 3 of 16 runs added a stray overtone entry.

### Sliding into a bend records every semitone

Bending `-3` down to `-3"` records `-3`, `-3'`, `-3"` as three entries. Accurate, but it may not be
what the player wants on the staff. Keeping only the landing note would delay every note slightly.
**Undecided**, leaning towards keeping all three. It shouldn't hurt Practice, where passing notes
are ignored.

### Off-pitch notes take the nearest semitone's label

`holeLabel` goes by note name so the label always agrees with the name shown. A note played well
off pitch therefore gets the nearest semitone's hole rather than `n/a`. Intended, but it means `n/a`
only ever means "this harp can't play that note", which includes anything outside its range.

### A chord reduced to part of itself adds no entry

Going from a chord to a subset of its notes with no gap records nothing new
(`src/core/noteStabilizer.ts`). This stops fading chords being recorded twice.

## Inherited from the Java app

### Practice exact match (bug 4)

The desktop app's Practice mode needed an exact match, which may be too strict for real playing.
Deliberately left until Practice is ported and can be tried on a real harmonica.

### A chord's notes can start in different hops (flaky e2e test)

When a chord's notes don't all clear the threshold in the same hop, one of them can commit alone
first, e.g. `E5` then `C5+E5+G5`. The `records notes, chords and repeats` Playwright test hits this
in roughly 1 run in 10 (seen with the code before and after the out-of-range change; a unit probe
over hop alignments found it in both). Not fixed: holding back a lone note to see if a chord follows
would delay every note.

### Narrow-window e2e test fails

`a narrower window wraps the staff without a page scrollbar` (`e2e/ui.spec.ts`) fails locally:
resizing to 620px doesn't add staff lines. Fails on `a1aa082` too, so it predates the recordings
and range changes. Not investigated yet.

## Not yet verified

- 48 kHz end to end in the browser: the Playwright fake mic runs at 44.1 kHz. The user's Android
  phone captures at 48 kHz (confirmed from a saved WAV, 2026-11-10), and the unit tests cover both.
- On the phone: the installed app opening in airplane mode, and the share sheet for saved audio.
- Dev server file watching with edits made from IntelliJ on `/mnt/c` (polling is on, but it hasn't
  been confirmed by the user).

## Capturing real failures

Settings → Recent recordings keeps the last 3 recordings (Record to Stop, the last 5 minutes of
each, stored on the device across reloads). Save gives a WAV (shared on phones, downloaded on desktop), named
with the harp key and start time. Use it as a test fixture rather than
tuning against simulations.
