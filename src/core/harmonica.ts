import { frequencyToNote, noteToFrequency } from './notes';

/** How far a hole's pitch is bent down, written as its tab symbol. */
export const Bend = {
  NONE: '',
  HALF_STEP: "'",
  WHOLE_STEP: '"',
  STEP_AND_A_HALF: '"\'',
} as const;
export type Bend = (typeof Bend)[keyof typeof Bend];

export interface HarmonicaKey {
  name: string;
  rootFrequencyHz: number; // hole 4 blow
}

function key(name: string, rootNote: string, rootOctave: number): HarmonicaKey {
  return { name, rootFrequencyHz: noteToFrequency(rootNote, rootOctave) };
}

/** The 12 keys a standard Richter-tuned 10-hole diatonic harmonica comes in. */
export const HARMONICA_KEYS: readonly HarmonicaKey[] = [
  key('C', 'C', 5),
  key('Db', 'C#', 5),
  key('D', 'D', 5),
  key('Eb', 'D#', 5),
  key('E', 'E', 5),
  key('F', 'F', 5),
  key('F#', 'F#', 5),
  key('G', 'G', 4),
  key('Ab', 'G#', 4),
  key('A', 'A', 4),
  key('Bb', 'A#', 4),
  key('B', 'B', 4),
];

export function keyByName(name: string): HarmonicaKey | undefined {
  return HARMONICA_KEYS.find((k) => k.name === name);
}

/** A positive number is blow, negative is draw (e.g. -2 is "draw 2"), as in standard tab. */
export interface HarmonicaHole {
  number: number;
  bend: Bend;
  noteName: string;
  frequencyHz: number;
}

export function holeString(hole: Pick<HarmonicaHole, 'number' | 'bend'>): string {
  return `${hole.number}${hole.bend}`;
}

// Standard Richter layout as half-step offsets from hole 4 blow. The same table applies to every
// key; only the root frequency changes.
const TUNING: ReadonlyArray<readonly [number, Bend, number]> = [
  [1, Bend.NONE, -12],
  [2, Bend.NONE, -8],
  [3, Bend.NONE, -5],
  [4, Bend.NONE, 0],
  [5, Bend.NONE, 4],
  [6, Bend.NONE, 7],
  [7, Bend.NONE, 12],
  [8, Bend.NONE, 16],
  [8, Bend.HALF_STEP, 15],
  [9, Bend.NONE, 19],
  [9, Bend.HALF_STEP, 18],
  [10, Bend.NONE, 24],
  [10, Bend.HALF_STEP, 23],
  [10, Bend.WHOLE_STEP, 22],
  [-1, Bend.NONE, -10],
  [-1, Bend.HALF_STEP, -11],
  [-2, Bend.NONE, -5],
  [-2, Bend.HALF_STEP, -6],
  [-2, Bend.WHOLE_STEP, -7],
  [-3, Bend.NONE, -1],
  [-3, Bend.HALF_STEP, -2],
  [-3, Bend.WHOLE_STEP, -3],
  [-3, Bend.STEP_AND_A_HALF, -4],
  [-4, Bend.NONE, 2],
  [-4, Bend.HALF_STEP, 1],
  [-5, Bend.NONE, 5],
  [-6, Bend.NONE, 9],
  [-6, Bend.HALF_STEP, 8],
  [-7, Bend.NONE, 11],
  [-8, Bend.NONE, 14],
  [-9, Bend.NONE, 17],
  [-10, Bend.NONE, 21],
];

export interface FrequencyRange {
  minHz: number;
  maxHz: number;
}

/** Whether this hole and bend exist on a Richter harmonica. The layout is the same in every key. */
export function isPlayable(number: number, bend: Bend): boolean {
  return TUNING.some(([n, b]) => n === number && b === bend);
}

/** All playable holes of a Richter-tuned harmonica in a given key. */
export class Harmonica {
  readonly key: HarmonicaKey;
  private readonly holes: HarmonicaHole[];

  constructor(harmonicaKey: HarmonicaKey) {
    this.key = harmonicaKey;
    this.holes = TUNING.map(([number, bend, halfSteps]) => {
      const frequencyHz = harmonicaKey.rootFrequencyHz * 2 ** (halfSteps / 12);
      return { number, bend, noteName: frequencyToNote(frequencyHz), frequencyHz };
    });
  }

  /** The lowest and highest notes this harmonica can play, bends included. */
  get range(): FrequencyRange {
    const frequencies = this.holes.map((h) => h.frequencyHz);
    return { minHz: Math.min(...frequencies), maxHz: Math.max(...frequencies) };
  }

  /** The hole with this number and bend, or null if this harmonica has no such hole. */
  find(number: number, bend: Bend = Bend.NONE): HarmonicaHole | null {
    return this.holes.find((h) => h.number === number && h.bend === bend) ?? null;
  }

  /**
   * The tab label for a detected frequency, or null if this harmonica can't play that note. Goes
   * by note name so the label always agrees with the name shown beside it: a bend often sits
   * between two semitones and still has to be labelled. Blow 3 and draw 2 are the same pitch on
   * every Richter harmonica, so sound alone can't tell which was played, and that note is
   * labelled with both ("3/-2") rather than guessing.
   */
  holeLabel(freqHz: number): string | null {
    const noteName = frequencyToNote(freqHz);
    const matches = this.holes.filter((h) => h.noteName === noteName);
    return matches.length > 0 ? matches.map(holeString).join('/') : null;
  }
}
