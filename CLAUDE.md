# Harmonica Practice Assistant (web)

A browser harmonica note reader: mic pitch detection, staff notation, song tab import and Practice
mode. A web rebuild of the JavaFX desktop app `soundTest` (`../soundTest`), which stays untouched as
the reference.

Known bugs and unverified behaviour are in `openbugs.md`. Check it before touching detection.

## Decisions

- Static site with no backend or accounts. Browser storage only for now (see Google Drive below).
- Storage: settings in localStorage; songs and recordings in IndexedDB (`src/storage/library.ts`,
  database `harmonica`). Chosen over localStorage because recordings are several MB each. If
  IndexedDB won't open, the app runs in memory and says so.
- Desktop layout first. Phones get a `max-width: 700px` media query at the end of `style.css`: the
  song list becomes a drawer opened by `#songs-button`, and the splitter is hidden. Keep desktop
  styles outside that block so the desktop UI stays unchanged.
- The duplicate blow 3 / draw 2 note is labelled `3/-2`, since sound alone can't tell them apart.
- A played note with no hole on the selected harp is labelled `n/a` (`NO_HOLE_LABEL` in
  `src/core/staff.ts`). The user may switch it to `?` if it takes too much room.
- Vanilla TypeScript, no UI framework. `vexflow` is pinned to exactly 4.2.5.

## Versioning

`x.y.z`, kept in `package.json` and shown in Settings (`__APP_VERSION__`, defined in
`vite.config.ts`). Bump it in the same commit as the change:

- **x (major):** milestones. 1.0.0 is when Practice is finished.
- **y (minor):** a new feature. Resets z.
- **z (patch):** a bug fix or small UI fix.
- Docs, tests and CI changes don't bump anything.

History, worked out from the commits: 0.1.0 first working app with recording (`941d184`), 0.2.0
deploy and offline (`f8f14f5`), 0.3.0 phone layout (`81930e9`), 0.3.1 Import moved (`79965f8`), 0.3.2
toggle colour fix (`ebd5176`), 0.4.0 save audio (`367d073`), 0.4.1 out-of-range fix (`4d9251e`), 0.5.0
song library in IndexedDB, recordings, `n/a` (`0d67620`).

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
- `src/core/recordings.ts`: the last 3 recordings (Record to Stop, at most the last 5 min each) as
  16-bit audio, and a WAV encoder, for Settings → Recent recordings.
- `src/storage/library.ts`: IndexedDB stores `songs` (by file name) and `recordings` (by start
  time). Unit tests use `fake-indexeddb`. A recording is stored on Stop and when the page is hidden
  mid-recording (a phone may kill a backgrounded app). `navigator.storage.persist()` is requested
  after the first successful write.
- `src/settings.ts`: validated settings in localStorage.
- `src/main.ts`: app wiring. Songs load from storage after startup, merged with any imported meanwhile.
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
  (`Harmonica.range`, ±50 cents). A sound outside it can't replace or absorb an in-range note, and is
  only reported when nothing in range is sounding. Without a range (as in most unit tests) the old
  behaviour applies.
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
5. Song library: IndexedDB storage and delete (×) done. Still to do: in-app editor, export.
6. Deploy: done. `.github/workflows/deploy.yml` publishes to GitHub Pages when run by hand (Actions
   tab or `gh workflow run deploy.yml`), not on push. Deploy only when the user asks.
   Installable and offline: `public/manifest.webmanifest`, icons in `public/icons/`, and `sw.js`,
   which a plugin in `vite.config.ts` generates at build time with every built file precached.
7. **Google Drive integration.** On hold (2026-11-08): the user doesn't know yet where the app will
   be hosted, and the OAuth client needs fixed origins. Idea so far: read songs from a chosen Drive
   folder, cached locally for offline. Persistent local storage comes first (phase 5).

Real failing audio: Settings → Recent recordings → Save (built). Ask for a WAV before tuning.

## Where things stand (2026-11-09)

- Live: v0.5.0 (commit `16ff2ef`, tagged), deployed and matching `main`. Deploy only when asked.
- The user tests on an Android phone through the installed app, recording with its mic. From
  2026-11-09 they also work from a session on the phone.
- First feedback on 0.5.0: "seems better, but not sensitive enough". Playing blow 5 (one note)
  wrote several entries. Their dog was howling along, and since 0.5.0 an out-of-range sound on its
  own is shown again (`n/a`), so the dog may explain some of it. Still unclear whether the problem
  is extra notes (too sensitive) or missed notes (not sensitive enough); these pull thresholds
  opposite ways. **Don't tune anything until the user sends a WAV** (Settings → Recent recordings
  → Save) with what they played, the key and what the staff showed. They'll retest without the dog.
- Still awaiting a real-harp retest: draw 5 (A3 and E5+G#7 readings should be gone; E5 instead of
  F5 needs a WAV), bends other than draw 4, songs and recordings surviving a reopen, the × delete,
  recordings saved when the app is backgrounded, `n/a` width on the staff (may switch to `?`),
  offline in airplane mode.
- Confirmed on a real harp: draw 4 bend (before 0.5.0).
- `npm run test:e2e`: two known failures, both in `openbugs.md`: a flaky chord-onset race in the
  record test, and the narrow-window test (fails on `a1aa082` too).
- Pushing from the user's WSL machine: the SSH key has a passphrase, so push over HTTPS with
  `gh auth git-credential`. A cloud session pushes normally.
