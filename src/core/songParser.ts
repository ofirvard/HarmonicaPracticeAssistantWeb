import { isPlayable, type Bend } from './harmonica';

export interface SongHole {
  number: number;
  bend: Bend;
}

/**
 * One staff line's worth of holes, with an optional lyric word aligned to each hole by index
 * (empty if there was no lyric line, shorter than holes if the lyric line had fewer words).
 */
export interface SongLine {
  holes: SongHole[];
  words: string[];
}

// Checked by regex rather than parseInt, which would accept "3rd" as 3 and turn a lyric line like
// "2nd 3rd" into notes. Bend marks follow the number, e.g. -3' or -3"'.
const HOLE_TOKEN = /^([+-]?\d+)(.*)$/;

function parseHoleToken(token: string): SongHole | null {
  const match = HOLE_TOKEN.exec(token);
  if (!match) {
    return null;
  }
  const number = Number(match[1]);
  const bend = match[2] as Bend;
  return isPlayable(number, bend) ? { number, bend } : null;
}

/**
 * Parses a line as holes only if every whitespace-separated token is a hole that exists on a
 * Richter harmonica. Returns an empty list for a blank line or any other token (e.g. a lyric
 * line), so callers can tell hole lines and lyric lines apart.
 */
export function parseHoleLine(rawLine: string): SongHole[] {
  const holes: SongHole[] = [];
  for (const token of rawLine.split(/\s+/)) {
    if (token === '') {
      continue;
    }
    const hole = parseHoleToken(token);
    if (!hole) {
      return [];
    }
    holes.push(hole);
  }
  return holes;
}

/**
 * Splits a lyric line into one word-unit per note: whitespace-separated words, further split on
 * any hyphen so each syllable lands on its own note ("a-mong" becomes "a-", "-mong"). The hyphen
 * is kept between a word's own syllables so the UI shows they belong together.
 */
export function parseLyricLine(rawLine: string): string[] {
  const words: string[] = [];
  for (const token of rawLine.trim().split(/\s+/)) {
    const syllables = token.split('-').filter((part) => part !== '');
    syllables.forEach((syllable, i) => {
      const prefix = i > 0 ? '-' : '';
      const suffix = i < syllables.length - 1 ? '-' : '';
      words.push(prefix + syllable + suffix);
    });
  }
  return words;
}

/**
 * Parses a song: one staff line per line of holes. A text line immediately after a hole line is
 * that line's lyrics; any other text is ignored.
 *
 * Known limitation: a lyric line made only of valid hole numbers (e.g. a verse marker like "1 2")
 * can't be told apart from a second hole line and is parsed as one.
 */
export function parseSong(text: string): SongLine[] {
  const lines: SongLine[] = [];
  const rawLines = text.split(/\r?\n/);
  for (let i = 0; i < rawLines.length; i++) {
    const holes = parseHoleLine(rawLines[i]!);
    if (holes.length === 0) {
      continue;
    }
    let words: string[] = [];
    const nextLine = rawLines[i + 1];
    if (nextLine !== undefined && nextLine.trim() !== '' && parseHoleLine(nextLine).length === 0) {
      words = parseLyricLine(nextLine);
      i++;
    }
    lines.push({ holes, words });
  }
  return lines;
}
