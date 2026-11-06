import { describe, expect, it } from 'vitest';
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

  it('ignores frequencies outside the musical range', () => {
    expect(detector.detect(tone(6000, 0.5))).toEqual([]);
  });
});
