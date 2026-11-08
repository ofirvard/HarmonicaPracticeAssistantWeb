# Harmonica Practice Assistant

A harmonica note reader that runs in the browser. It listens through the microphone, shows the notes
you play on a staff with their harmonica tab (`4`, `-4`, `-3"`, …), and imports songs from tab text
files. Practice mode is next.

**Live app:** https://ofirvard.github.io/HarmonicaPracticeAssistantWeb/

## On a phone

Open the link in Chrome and choose **Install app** (or **Add to Home screen**) from the ⋮ menu. After
the first visit it works offline. To get a newer version, close the app fully and reopen it while
online.

The layout switches to a phone version on screens up to 700px wide: the song list moves behind the
**☰ Songs** button.

## Reporting a misread note

Record, play the note a few times, press Stop, then use ⚙ Settings → **Save last 20 s of audio**.
Send the WAV along with exactly what you played. Real recordings become test cases.

## Development

Requires Node 22. Run npm from WSL, not Windows.

```
npm install
npm run dev        # dev server on localhost:5173
npm test           # unit tests
npm run typecheck
npm run test:e2e   # browser tests with a fake microphone
npm run build      # production build in dist/
```

## Deploying

Pushing to `main` does not deploy. Run the **Deploy to GitHub Pages** workflow by hand from the
Actions tab, or:

```
gh workflow run deploy.yml
```

It runs the unit tests, builds, and publishes to GitHub Pages. The repo must stay public for Pages to
be free.

Project notes for Claude are in `CLAUDE.md`, and known bugs in `openbugs.md`.
