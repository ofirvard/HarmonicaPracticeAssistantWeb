# Harmonica Practice Assistant (web)

A browser harmonica note reader: mic pitch detection, staff notation, song tab import and Practice
mode. A web rebuild of the JavaFX desktop app `soundTest` (`../soundTest`), which stays untouched as
the reference.

Known bugs and unverified behaviour are in `openbugs.md`. Check it before touching detection.

## Decisions

- Static site with no backend or accounts. Browser storage only for now (see Google Drive below).
- Desktop layout first. Phones get a `max-width: 700px` media query at the end of `style.css`: the
  song list becomes a drawer opened by `#songs-button`, and the splitter is hidden. Keep desktop
  styles outside that block so the desktop UI stays unchanged.
- The duplicate blow 3 / draw 2 note is labelled `3/-2`, since sound alone can't tell them apart.
- Vanilla TypeScript, no UI framework. `vexflow` is pinned to exactly 4.2.5.

## Commands

Run npm from WSL only, not Windows. Open `localhost:5173` in the Windows browser.

```
npm run dev        # dev server
npm test           # unit tests (vitest, src/**/*.test.ts)
npm run typecheck  # tsc
npm run test:e2e   # Playwright, port 5199, fake mic from generated WAVs
npm run build
```

## Layout

- `src/core/`: logic with no DOM.
  - `notes`, `harmonica` (Richter layout, `holeLabel`), `fft`, `pitchDetector`, `noteStabilizer`,
    `noteReader` (hops to committed notes), `songParser`, `staff`.
- `src/audio/`: `mic.ts` (`openMic`, friendly errors), `listener.ts` (`startListening`, reusable by
  Practice).
- `src/ui/staffView.ts`: VexFlow drawing. `setPracticeIndex` is ready for Practice.
- `src/core/recentAudio.ts`: ring buffer of the last 20 s of mic audio and a WAV encoder, for
  Settings → "Save last 20 s of audio".
- `src/settings.ts`: validated settings in localStorage.
- `src/main.ts`: app wiring. The song list is in memory only.
- `public/hop-processor.js`: AudioWorklet. Lives in `public` so it isn't bundled.
- `e2e/`: Playwright. Excluded from `tsconfig.json` on purpose.
- `README.md`: for people (live link, installing on a phone, deploying). Keep it in step.

## How it works

- **Audio:** `getUserMedia` with echo cancellation, noise suppression and auto gain off. The worklet
  posts 2048-sample hops into a sliding 4096 FFT window. The AudioContext is created before the first
  `await` in the click handler.
- **Detection:** Hann window, parabolic peak interpolation, harmonic and subharmonic rejection, RMS
  silence threshold 0.015, peak threshold 0.32. Weak fundamentals absorb their overtones, because
  bends put most energy in overtones. When recording, the detector gets the selected harp's range
  (`Harmonica.range`, ±50 cents) and never reports a note outside it; out-of-range peaks only count
  as overtones. Without a range (as in most unit tests) the old behaviour applies.
- **Stabilizer:** a note must appear in two consecutive hops, and only a note not already sounding
  commits an entry.
- **Staff:** always derived from key-independent `StaffItem`s through `toEntries(items, harmonica)`,
  which is how a key change re-pitches songs and relabels played notes. Each line is drawn in an SVG
  group (`vf-staff-line`, VexFlow adds the prefix), measured with `getBBox()`, then translated, so
  high notes aren't clipped.

## Working on detection

- Every detector change must keep the sweep in `pitchDetector.test.ts` at zero wrong: all two and
  three hole chords in every key, at 44.1 and 48 kHz.
- Thresholds trade missed bends against clean notes dropping an octave, so measure both directions
  before changing one.
- Check a new test fails without the change. Two tests here have passed without testing anything.
- Simulations have missed real bend failures, so a bend isn't fixed until tried on a real harmonica.
- Vitest hides `console.log` for passing tests. Temporary probes should write to a file outside the
  repo and be deleted afterwards.

## Traps

- `/mnt/c` needs `server.watch.usePolling` (already in `vite.config.ts`).
- Porting from Java: use a strict token regex rather than `parseInt`, and `Math.floor(midi / 12)`.
- If port 5199 is stuck, find the process with `ss -ltnpH 'sport = :5199'`, check it's ours, and kill
  that PID. Don't use `pkill -f`: it can kill your own shell.
- Commit only when asked.

## Roadmap

1. Core port: done.
2. Staff and songs, no mic: done.
3. Record: built. Single notes, repeats, level meter and chords work on a real harmonica. Bends are
   still being tuned (see `openbugs.md`).
4. **Practice (next).** In-order note matching, highlighted with `setPracticeIndex`, reusing
   `startListening`. Disable Record during Practice, reset sensibly on key change and clear. Enable
   `#practice-button` in `index.html`, which is disabled with "Not available yet". Revisit match
   strictness on a real harmonica (bug 4 in `openbugs.md`).
5. Song library: IndexedDB storage, in-app editor replacing the ✎ button, export.
6. Deploy: done. `.github/workflows/deploy.yml` publishes to GitHub Pages when run by hand (Actions
   tab or `gh workflow run deploy.yml`), not on push. Deploy only when the user asks.
   Installable and offline: `public/manifest.webmanifest`, icons in `public/icons/`, and `sw.js`,
   which a plugin in `vite.config.ts` generates at build time with every built file precached.
7. **Google Drive integration.** Requested by the user, not designed yet. Presumably saving and
   syncing songs through the user's Drive, which fits the no-backend design. Scope and details need
   confirming with the user. It would change the "browser storage only" decision, so plan it
   alongside phase 5's storage layer.

Real failing audio: Settings → "Save last 20 s of audio" (built). Ask for a WAV before tuning.

## Where things stand (2026-11-08)

- The user tests on an Android phone through the installed app, recording with its mic.
- Confirmed on a real harp: draw 4 bend. Awaiting retest: the out-of-range fix for draw 5 (A3 and
  E5+G#7 readings), other bends. Still open: draw 5 read as E5 instead of F5 (needs a WAV).
- The last changes were made and pushed from a cloud session, where `npm run test:e2e` couldn't run
  (Playwright's browser didn't match). Unit tests passed, and the fake mic was checked by hand
  against a build. Run `npm run test:e2e` locally once to confirm.
- The live app was last deployed with the range fix (commit 4d9251e). Later commits only change the
  deploy trigger and docs, so the live app matches `main`. After new app changes, deploy only when
  asked.
- A local clone made before this session needs `git pull`: the phone layout, audio saving, range
  fix, README and these notes all came from the cloud session.
