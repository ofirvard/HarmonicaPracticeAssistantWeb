import { describe, expect, it } from 'vitest';
import { Bend, HARMONICA_KEYS, Harmonica } from './harmonica';
import { noteToFrequency as freq } from './notes';
import { PitchDetector } from './pitchDetector';

const FFT_SIZE = 4096;

/** Sums sines; args alternate frequencyHz, amplitude. Each partial gets a distinct phase. */
function signal(sampleRate: number, ...freqAmpPairs: number[]): Float64Array {
  const samples = new Float64Array(FFT_SIZE);
  for (let p = 0; p < freqAmpPairs.length; p += 2) {
    const f = freqAmpPairs[p]!;
    const amp = freqAmpPairs[p + 1]!;
    const phase = p * 0.7;
    for (let i = 0; i < FFT_SIZE; i++) {
      samples[i]! += amp * Math.sin((2 * Math.PI * f * i) / sampleRate + phase);
    }
  }
  return samples;
}

// Browsers usually capture at 48 kHz rather than the desktop app's 44.1 kHz, so every case runs
// at both rates.
describe.each([44100, 48000])('PitchDetector at %d Hz', (sampleRate) => {
  const detector = new PitchDetector(FFT_SIZE, sampleRate);
  const tone = (...pairs: number[]) => signal(sampleRate, ...pairs);
  const names = (samples: Float64Array) => detector.detect(samples).map((n) => n.name);

  it('detects a single sine', () => {
    const notes = detector.detect(tone(440, 0.5));
    expect(notes).toHaveLength(1);
    expect(notes[0]!.name).toBe('A4');
    expect(Math.abs(notes[0]!.frequencyHz - 440)).toBeLessThan(1);
  });

  it('detects single sines across the harmonica range', () => {
    const notes: Array<[string, number]> = [
      ['C', 4], ['G', 4], ['D', 5], ['F#', 5], ['B', 6], ['C', 7],
    ];
    for (const [name, octave] of notes) {
      expect(names(tone(freq(name, octave), 0.5))).toEqual([`${name}${octave}`]);
    }
  });

  it('detects a major triad as three ascending notes', () => {
    const chord = tone(freq('C', 4), 0.3, freq('E', 4), 0.3, freq('G', 4), 0.3);
    expect(names(chord)).toEqual(['C4', 'E4', 'G4']);
  });

  it('detects a harmonica-style draw chord', () => {
    const chord = tone(freq('D', 4), 0.3, freq('G', 4), 0.3, freq('B', 4), 0.3);
    expect(names(chord)).toEqual(['D4', 'G4', 'B4']);
  });

  it('does not report overtones as separate notes', () => {
    const f0 = freq('A', 3);
    expect(names(tone(f0, 0.5, 2 * f0, 0.35, 3 * f0, 0.25, 4 * f0, 0.15))).toEqual(['A3']);
  });

  it('prefers a quieter fundamental over a louder second harmonic', () => {
    const f0 = freq('G', 4);
    expect(names(tone(f0, 0.3, 2 * f0, 0.45, 3 * f0, 0.2))).toEqual(['G4']);
  });

  it('returns nothing for silence and very quiet input', () => {
    expect(detector.detect(new Float64Array(FFT_SIZE))).toEqual([]);
    expect(detector.detect(tone(440, 0.01))).toEqual([]);
  });

  it('reports the RMS of the most recent input', () => {
    detector.detect(tone(440, 0.5));
    expect(Math.abs(detector.lastRms - 0.5 / Math.sqrt(2))).toBeLessThan(0.01);
    detector.detect(new Float64Array(FFT_SIZE));
    expect(detector.lastRms).toBe(0);
  });

  it('reports a note once when two peaks round to the same name, keeping the louder', () => {
    const c7 = freq('C', 7);
    const louder = c7 * 2 ** (30 / 1200);
    const notes = detector.detect(tone(c7 * 2 ** (-30 / 1200), 0.2, louder, 0.5));
    expect(notes.map((n) => n.name)).toEqual(['C7']);
    expect(Math.abs(notes[0]!.frequencyHz - louder)).toBeLessThan(3);
  });

  // A bent note can put most of its energy in its overtones, as the partials here do.
  const weakFundamental = (f0: number, level = 0.3) =>
    tone(f0, 0.2 * level, 2 * f0, 0.2, 3 * f0, 0.16, 4 * f0, 0.12, 5 * f0, 0.08);

  it('hears a weak fundamental as one note, not a chord of its overtones', () => {
    expect(names(weakFundamental(freq('A', 4)))).toEqual(['A4']);
    expect(names(weakFundamental(freq('A', 4), 0.1))).toEqual(['A4']);
  });

  it('finds the weak fundamental of every bend on a C harp', () => {
    const bends: Array<[string, number]> = [
      ['C#', 4], ['F#', 4], ['F', 4], ['A#', 4], ['A', 4], ['G#', 4], ['C#', 5], ['G#', 5],
    ];
    for (const [name, octave] of bends) {
      expect(names(weakFundamental(freq(name, octave)))).toEqual([`${name}${octave}`]);
    }
  });

  it('finds a bend whose only loud overtone is its octave or twelfth', () => {
    const harp = new Harmonica(HARMONICA_KEYS[0]!);
    const bends = [
      harp.find(-1, Bend.HALF_STEP)!,
      harp.find(-2, Bend.HALF_STEP)!,
      harp.find(-2, Bend.WHOLE_STEP)!,
      harp.find(-3, Bend.HALF_STEP)!,
      harp.find(-3, Bend.WHOLE_STEP)!,
      harp.find(-3, Bend.STEP_AND_A_HALF)!,
      harp.find(-4, Bend.HALF_STEP)!,
      harp.find(-6, Bend.HALF_STEP)!,
    ];
    for (const { frequencyHz: f0, noteName } of bends) {
      for (const level of [0.2, 0.4]) {
        expect(names(tone(f0, 0.3 * level, 2 * f0, 0.3, 3 * f0, 0.03)), noteName).toEqual([noteName]);
        expect(names(tone(f0, 0.3 * level, 3 * f0, 0.3)), noteName).toEqual([noteName]);
      }
    }
  });

  it('does not drop a clean note an octave for a faint peak below it', () => {
    const c6 = freq('C', 6);
    expect(names(tone(c6, 0.3, c6 / 2, 0.03))).toEqual(['C6']);
  });

  it('keeps a real chord whose notes line up as overtones of a silent lower pitch', () => {
    // Blow 7-8-9 is close to harmonics 4, 5 and 6 of C4, but nothing is sounding at C4.
    const chord = [freq('C', 6), 0.3, freq('E', 6), 0.3, freq('G', 6), 0.3];
    expect(names(tone(...chord))).toEqual(['C6', 'E6', 'G6']);
    expect(names(tone(...chord, freq('C', 4), 0.006))).toEqual(['C6', 'E6', 'G6']);
  });

  it('detects every two and three hole chord in every key', () => {
    const partials = [1, 0.7, 0.5, 0.3, 0.2];
    const wrong: string[] = [];
    for (const key of HARMONICA_KEYS) {
      const harp = new Harmonica(key);
      for (const sign of [1, -1]) {
        for (const size of [2, 3]) {
          for (let hole = 1; hole + size - 1 <= 10; hole++) {
            const holes = Array.from({ length: size }, (_, i) => harp.find(sign * (hole + i))!);
            const pairs = holes.flatMap((h) =>
              partials.flatMap((a, k) => [h.frequencyHz * (k + 1), (0.3 / size) * a]),
            );
            const want = holes.map((h) => h.noteName).sort().join('+');
            const got = names(tone(...pairs)).sort().join('+');
            if (got !== want) {
              wrong.push(`${key.name}: want ${want}, got ${got}`);
            }
          }
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('ignores frequencies outside the musical range', () => {
    expect(detector.detect(tone(6000, 0.5))).toEqual([]);
  });
});
