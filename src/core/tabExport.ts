import { holeString } from './harmonica';
import type { StaffItem } from './staff';

// Recorded notes never force a staff line break, so their lines can wrap anywhere. This keeps
// them readable in a text editor.
const PLAYED_PER_LINE = 12;

/** Rejoins lyric word-units, so "a-", "-mong" goes back to "a-mong" as it was written. */
function lyricLine(words: readonly string[]): string {
  let line = '';
  for (const word of words) {
    if (line.endsWith('-') && word.startsWith('-')) {
      line += word.slice(1);
    } else {
      line += (line === '' ? '' : ' ') + word;
    }
  }
  return line.trim();
}

/**
 * Writes what's on the staff as a tab file that Import reads back to the same staff. Song holes
 * are written as tab (with their lyrics), one line per song line. Recorded notes are written as
 * the notes played, chords joined by +, e.g. "E5 C5+E5+G5", so they keep their pitch in any key
 * and nothing is lost to a hole label like 3/-2 or n/a.
 */
export function staffToTab(items: readonly StaffItem[], title: string): string {
  const blocks: string[] = [];
  let holes: string[] = [];
  let words: string[] = [];
  let played: string[] = [];

  const flushHoles = () => {
    if (holes.length === 0) return;
    const lyrics = lyricLine(words);
    blocks.push(lyrics === '' ? holes.join(' ') : `${holes.join(' ')}\n${lyrics}`);
    holes = [];
    words = [];
  };
  const flushPlayed = () => {
    for (let i = 0; i < played.length; i += PLAYED_PER_LINE) {
      blocks.push(played.slice(i, i + PLAYED_PER_LINE).join(' '));
    }
    played = [];
  };

  for (const item of items) {
    if (item.kind === 'played') {
      flushHoles();
      played.push(item.notes.map((n) => n.name).join('+'));
    } else {
      flushPlayed();
      holes.push(holeString(item.hole));
      words.push(item.word);
      if (item.endLine) flushHoles();
    }
  }
  flushHoles();
  flushPlayed();
  return `${title}\n\n${blocks.join('\n\n')}\n`;
}
