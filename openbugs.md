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
- **Next:** get a WAV with Settings → "Save last 20 s of audio", note exactly what was played, and
  use it as a fixture before changing thresholds. Draw 4 bend was confirmed fixed on a real harp in
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

- **Reported:** bends came out as chords of `–`.
- **Cause (simulated):** overtones of a weak fundamental were reported as a chord.
- **Fix:** `absorbIntoWeakFundamentals` in `src/core/pitchDetector.ts`, and `holeLabel` now matches
  by note name. In the simulations it gives `-3"` where it gave `–` before. `-4'` was the first real
  retest and showed the gap above, so other bends are still unconfirmed.

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
off pitch therefore gets the nearest semitone's hole rather than `–`. Intended, but it means `–` only
ever means "this harp can't play that note".

### A chord reduced to part of itself adds no entry

Going from a chord to a subset of its notes with no gap records nothing new
(`src/core/noteStabilizer.ts`). This stops fading chords being recorded twice.

## Inherited from the Java app

### Practice exact match (bug 4)

The desktop app's Practice mode needed an exact match, which may be too strict for real playing.
Deliberately left until Practice is ported and can be tried on a real harmonica.

## Not yet verified

- 48 kHz is only covered by unit tests end to end. The browser fake mic ran at 44.1 kHz, while real
  browsers usually capture at 48 kHz.
- Dev server file watching with edits made from IntelliJ on `/mnt/c` (polling is on, but it hasn't
  been confirmed by the user).

## Capturing real failures

Settings → "Save last 20 s of audio" saves the end of the latest recording as a WAV (shared on
phones, downloaded on desktop), named with the harp key. Use it as a test fixture rather than
tuning against simulations.
