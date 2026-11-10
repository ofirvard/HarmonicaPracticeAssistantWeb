import { Harmonica, holeString } from './harmonica';
import { noteNameToFrequency, toVexFlowKey } from './notes';
import type { DetectedNote } from './pitchDetector';
import type { SongHole, SongPart } from './songParser';

// Shown in place of a hole number when no hole on the current harmonica matches a note.
const NO_HOLE_LABEL = 'n/a';

/**
 * What the player loaded or played, independent of harmonica key. The staff is always derived
 * from these, so changing key can't leave stale notes behind: a song hole is re-pitched, while a
 * played note keeps its pitch and only its hole label changes.
 */
export type StaffItem =
  | { kind: 'hole'; hole: SongHole; word: string; endLine: boolean }
  | { kind: 'played'; notes: DetectedNote[] };

/** One note or chord as drawn on the staff. */
export interface StaffEntry {
  keys: string[]; // VexFlow keys, e.g. ["c/5", "e/5"]
  letters: string; // e.g. "C5+E5"
  holes: string; // e.g. "4+5"
  lyric: string;
  endLine: boolean; // the next entry must start a new line
}

export interface StaffLine {
  entries: StaffEntry[];
  // True for the first line and after a song's own line breaks, false for a soft wrap. Only these
  // lines get a clef, so narrowing the window doesn't sprout a clef mid-phrase.
  startsPhrase: boolean;
}

export function songToItems(lines: readonly SongPart[]): StaffItem[] {
  return lines.flatMap((line): StaffItem[] => {
    if ('played' in line) {
      return line.played.map((names) => ({
        kind: 'played',
        notes: names.map((name) => ({ name, frequencyHz: noteNameToFrequency(name) })),
      }));
    }
    const { holes, words } = line;
    return holes.map(
      (hole, i): StaffItem => ({
        kind: 'hole',
        hole,
        word: words[i] ?? '',
        endLine: i === holes.length - 1,
      }),
    );
  });
}

export function toEntries(items: readonly StaffItem[], harmonica: Harmonica): StaffEntry[] {
  return items.flatMap((item): StaffEntry[] => {
    if (item.kind === 'played') {
      return [
        {
          keys: item.notes.map((n) => toVexFlowKey(n.name)),
          letters: item.notes.map((n) => n.name).join('+'),
          holes: item.notes.map((n) => harmonica.holeLabel(n.frequencyHz) ?? NO_HOLE_LABEL).join('+'),
          lyric: '',
          endLine: false,
        },
      ];
    }
    const hole = harmonica.find(item.hole.number, item.hole.bend);
    if (!hole) {
      return [];
    }
    return [
      {
        keys: [toVexFlowKey(hole.noteName)],
        letters: hole.noteName,
        // The tab as written, not holeLabel: a song says which of 3 and -2 it means.
        holes: holeString(hole),
        lyric: item.word,
        endLine: item.endLine,
      },
    ];
  });
}

/** Splits entries into staff lines at forced line breaks and every perLine entries. */
export function layoutLines(entries: readonly StaffEntry[], perLine: number): StaffLine[] {
  const lines: StaffLine[] = [];
  let current: StaffLine | null = null;
  entries.forEach((entry, i) => {
    if (!current) {
      current = { entries: [], startsPhrase: i === 0 || entries[i - 1]!.endLine };
      lines.push(current);
    }
    current.entries.push(entry);
    if (entry.endLine || current.entries.length >= perLine) {
      current = null;
    }
  });
  return lines;
}
