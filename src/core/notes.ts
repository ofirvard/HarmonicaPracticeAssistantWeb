/** Converts frequencies to note names using 12-tone equal temperament, A4 = 440 Hz. */

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiNumber(freqHz: number): number {
  return 69 + 12 * Math.log2(freqHz / 440);
}

export function frequencyToNote(freqHz: number): string {
  const midi = Math.round(midiNumber(freqHz));
  const noteIndex = ((midi % 12) + 12) % 12;
  // Math.floor is required: unlike Java's integer division, midi / 12 keeps its fraction here.
  const octave = Math.floor(midi / 12) - 1;
  return `${NAMES[noteIndex]}${octave}`;
}

/** Inverse of frequencyToNote: the frequency of a named note (sharps only, e.g. "C#"). */
export function noteToFrequency(name: string, octave: number): number {
  const noteIndex = NAMES.indexOf(name);
  if (noteIndex < 0) {
    throw new Error(`Unknown note name: ${name}`);
  }
  const midi = (octave + 1) * 12 + noteIndex;
  return 440 * 2 ** ((midi - 69) / 12);
}

// A full note name as frequencyToNote writes it: sharps only, one-digit octave.
const NOTE_NAME = /^([A-G]#?)(\d)$/;

/** Whether text is a full note name such as "C5" or "F#4". */
export function isNoteName(text: string): boolean {
  return NOTE_NAME.test(text);
}

/** The frequency of a full note name such as "C#5". */
export function noteNameToFrequency(noteName: string): number {
  const match = NOTE_NAME.exec(noteName);
  if (!match) {
    throw new Error(`Not a note name: ${noteName}`);
  }
  return noteToFrequency(match[1]!, Number(match[2]));
}

/** Converts a note name like "C#5" into VexFlow's "c#/5" stave-key notation. */
export function toVexFlowKey(noteName: string): string {
  const split = noteName[1] === '#' ? 2 : 1;
  return `${noteName.slice(0, split).toLowerCase()}/${noteName.slice(split)}`;
}
