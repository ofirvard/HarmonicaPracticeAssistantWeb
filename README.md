# Harmonica Practice Assistant

A harmonica note reader that runs in the browser. It listens through the microphone, shows the notes
you play on a staff with their harmonica tab (`4`, `-4`, `-3"`, …), and imports songs from tab text
files. Practice mode is next.

**Live app:** https://ofirvard.github.io/HarmonicaPracticeAssistantWeb/

## On a phone

Open the link in Chrome and choose **Install app** (or **Add to Home screen**) from the ⋮ menu. After
the first visit it works offline. To get a newer version, close the app fully and reopen it while
online.

Imported songs and the last 3 recordings are kept in the browser on that device, so they're still
there after closing the app. Clearing the site's data removes them. To remove a song, use the × next
to it.

The layout switches to a phone version on screens up to 700px wide: the song list moves behind the
**☰ Songs** button.

## Exporting

**Export** (next to Clear) saves what's on the staff as a `.txt` tab file: shared on a phone,
downloaded on a computer. Song holes are written as tab with their lyrics. Recorded notes are
written as the notes you played, with chords joined by `+` (for example `E5 C5+E5+G5`), so they
keep their pitch whatever harp is selected. **Import** reads the file back to the same staff.

## Reporting a misread note

Record, play the note a few times, press Stop, then open ⚙ Settings → **Recent recordings** and
press **Save** on it. The last 3 recordings are kept, even after closing the app. Send the WAV along with
exactly what you played. Real recordings become test cases.

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
