import { describe, expect, it } from 'vitest';
import { frequencyToNote, noteToFrequency, toVexFlowKey } from './notes';

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

describe('notes', () => {
  it('reference pitches', () => {
    expect(frequencyToNote(440)).toBe('A4');
    expect(frequencyToNote(261.63)).toBe('C4');
    expect(frequencyToNote(27.5)).toBe('A0');
    expect(frequencyToNote(4186.01)).toBe('C8');
    expect(noteToFrequency('A', 4)).toBeCloseTo(440, 9);
    expect(Math.abs(noteToFrequency('C', 4) - 261.63)).toBeLessThan(0.01);
  });

  it('rounds to the nearest semitone', () => {
    expect(frequencyToNote(440 * 2 ** (40 / 1200))).toBe('A4');
    expect(frequencyToNote(440 * 2 ** (-40 / 1200))).toBe('A4');
    expect(frequencyToNote(440 * 2 ** (60 / 1200))).toBe('A#4');
    expect(frequencyToNote(440 * 2 ** (-60 / 1200))).toBe('G#4');
  });

  it('handles the octave boundary between B and C', () => {
    expect(frequencyToNote(noteToFrequency('B', 3))).toBe('B3');
    expect(frequencyToNote(noteToFrequency('C', 4))).toBe('C4');
  });

  it('round-trips every note across octaves', () => {
    for (let octave = 1; octave <= 7; octave++) {
      for (const name of NAMES) {
        expect(frequencyToNote(noteToFrequency(name, octave))).toBe(`${name}${octave}`);
      }
    }
  });

  it('throws on unknown note names', () => {
    expect(() => noteToFrequency('Db', 4)).toThrow();
    expect(() => noteToFrequency('H', 4)).toThrow();
  });

  it('formats VexFlow keys', () => {
    expect(toVexFlowKey('A4')).toBe('a/4');
    expect(toVexFlowKey('C#5')).toBe('c#/5');
    expect(toVexFlowKey('G10')).toBe('g/10');
  });
});
