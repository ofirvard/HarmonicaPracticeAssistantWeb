import { describe, expect, it } from 'vitest';
import { Bend, HARMONICA_KEYS, Harmonica, keyByName } from './harmonica';
import { noteToFrequency } from './notes';

const C_HARP: Record<number, string> = {
  1: 'C4', 2: 'E4', 3: 'G4', 4: 'C5', 5: 'E5', 6: 'G5', 7: 'C6', 8: 'E6', 9: 'G6', 10: 'C7',
  [-1]: 'D4', [-2]: 'G4', [-3]: 'B4', [-4]: 'D5', [-5]: 'F5', [-6]: 'A5', [-7]: 'B5', [-8]: 'D6',
  [-9]: 'F6', [-10]: 'A6',
};

const cHarp = new Harmonica(keyByName('C')!);

describe('Harmonica', () => {
  it('C harp unbent holes match the Richter layout', () => {
    for (const [number, note] of Object.entries(C_HARP)) {
      const hole = cHarp.find(Number(number));
      expect(hole?.noteName, `hole ${number}`).toBe(note);
      expect(hole?.bend).toBe(Bend.NONE);
    }
  });

  it('returns null for missing holes', () => {
    expect(cHarp.find(0)).toBeNull();
    expect(cHarp.find(11)).toBeNull();
    expect(cHarp.find(-11)).toBeNull();
  });

  it.each(HARMONICA_KEYS.map((k) => [k.name, k] as const))(
    'key %s is the same layout transposed',
    (_, key) => {
      const harp = new Harmonica(key);
      const root = key.rootFrequencyHz;
      expect(harp.find(4)!.frequencyHz).toBeCloseTo(root, 6);
      expect(harp.find(1)!.frequencyHz).toBeCloseTo(root / 2, 6);
      expect(harp.find(7)!.frequencyHz).toBeCloseTo(root * 2, 6);
      expect(harp.find(3)!.noteName).toBe(harp.find(-2)!.noteName);
    },
  );

  it('G harp is pitched below C', () => {
    expect(new Harmonica(keyByName('G')!).find(4)!.noteName).toBe('G4');
    expect(new Harmonica(keyByName('Db')!).find(4)!.noteName).toBe('C#5');
  });

  it('finds bent holes by number and bend', () => {
    expect(cHarp.find(-3, Bend.HALF_STEP)!.noteName).toBe('A#4');
    expect(cHarp.find(-3, Bend.STEP_AND_A_HALF)!.noteName).toBe('G#4');
    expect(cHarp.find(4, Bend.HALF_STEP)).toBeNull();
  });
});

describe('holeLabel', () => {
  it.each(HARMONICA_KEYS.map((k) => [k.name, k] as const))(
    'labels the blow 3 / draw 2 pitch with both holes in key %s',
    (_, key) => {
      const harp = new Harmonica(key);
      expect(harp.holeLabel(harp.find(3)!.frequencyHz)).toBe('3/-2');
    },
  );

  it('labels unbent and bent notes with a single hole', () => {
    expect(cHarp.holeLabel(noteToFrequency('C', 5))).toBe('4');
    expect(cHarp.holeLabel(noteToFrequency('D', 5))).toBe('-4');
    expect(cHarp.holeLabel(noteToFrequency('A#', 4))).toBe("-3'");
    expect(cHarp.holeLabel(noteToFrequency('G#', 4))).toBe('-3"\'');
    expect(cHarp.holeLabel(noteToFrequency('A#', 6))).toBe('10"');
  });

  it('agrees with the note name however far off pitch, as a bend usually is', () => {
    const a4 = noteToFrequency('A', 4);
    for (const cents of [-45, -30, -15, 0, 15, 30, 45]) {
      expect(cHarp.holeLabel(a4 * 2 ** (cents / 1200)), `${cents} cents`).toBe('-3"');
    }
  });

  it('returns null for notes this harmonica cannot play', () => {
    // D#5 is the one chromatic note missing from the middle octave without overblows.
    expect(cHarp.holeLabel(noteToFrequency('D#', 5))).toBeNull();
    expect(cHarp.holeLabel(100)).toBeNull();
    expect(cHarp.holeLabel(5000)).toBeNull();
  });
});
