import { describe, expect, it } from 'vitest';
import { HOP_SIZE, NoteReader } from './noteReader';
import { NoteStabilizer } from './noteStabilizer';

const SAMPLE_RATE = 48000;

/** A continuous sine split into hops, so phase carries across hop boundaries like real audio. */
function hops(freq: number, count: number, startHop = 0): Float32Array[] {
  return Array.from({ length: count }, (_, h) => {
    const hop = new Float32Array(HOP_SIZE);
    for (let i = 0; i < HOP_SIZE; i++) {
      const n = (startHop + h) * HOP_SIZE + i;
      hop[i] = 0.5 * Math.sin((2 * Math.PI * freq * n) / SAMPLE_RATE);
    }
    return hop;
  });
}

const silence = () => new Float32Array(HOP_SIZE);

/** Renders [seconds, frequencies] segments as notes with overtones and short fades. */
function phrase(segments: Array<[number, number[]]>): Float32Array {
  const samples: number[] = [];
  for (const [seconds, frequencies] of segments) {
    const count = Math.round(seconds * SAMPLE_RATE);
    for (let i = 0; i < count; i++) {
      const t = i / SAMPLE_RATE;
      const fade = Math.min(1, t / 0.02, (seconds - t) / 0.02);
      let value = 0;
      for (const f of frequencies) {
        value += Math.sin(2 * Math.PI * f * t);
        value += 0.4 * Math.sin(2 * Math.PI * 2 * f * t);
        value += 0.2 * Math.sin(2 * Math.PI * 3 * f * t);
      }
      samples.push((0.25 * value * fade) / Math.max(1, frequencies.length));
    }
  }
  return Float32Array.from(samples);
}

describe('NoteReader', () => {
  it('detects a note once the sliding window has filled', () => {
    const reader = new NoteReader(SAMPLE_RATE);
    const [first, second] = hops(440, 2);
    reader.push(first!);
    expect(reader.push(second!).map((n) => n.name)).toEqual(['A4']);
  });

  it('keeps the previous hop in the window', () => {
    const reader = new NoteReader(SAMPLE_RATE);
    reader.push(hops(440, 1)[0]!);
    expect(reader.push(silence()).length).toBeGreaterThan(0);
    reader.push(silence());
    expect(reader.lastRms).toBe(0);
  });

  it('commits each played note once through the stabilizer', () => {
    const reader = new NoteReader(SAMPLE_RATE);
    const stabilizer = new NoteStabilizer();
    const audio = [
      ...hops(440, 8),
      ...Array.from({ length: 4 }, silence),
      ...hops(523.25, 8),
      ...Array.from({ length: 4 }, silence),
      ...hops(523.25, 8),
    ];
    const committed = audio.flatMap((hop) => {
      const notes = stabilizer.push(reader.push(hop));
      return notes ? [notes.map((n) => n.name).join('+')] : [];
    });
    expect(committed).toEqual(['A4', 'C5', 'C5']);
  });

  // Where a sound falls relative to the hops differs on every run, and a note ending partway
  // through a window can smear into extra spectral peaks, so this tries every alignment.
  it('commits the same notes wherever the hops happen to land', () => {
    const audio = phrase([
      [0.5, []],
      [0.6, [523.25]],
      [0.4, []],
      [0.6, [392]],
      [0.4, []],
      [0.8, [523.25, 659.25, 783.99]],
      [0.5, []],
    ]);
    const outcomes = new Set<string>();
    for (let offset = 0; offset < HOP_SIZE; offset += 16) {
      const reader = new NoteReader(SAMPLE_RATE);
      const stabilizer = new NoteStabilizer();
      const committed: string[] = [];
      for (let p = offset; p + HOP_SIZE <= audio.length; p += HOP_SIZE) {
        const raw = reader.push(audio.subarray(p, p + HOP_SIZE));
        expect(new Set(raw.map((n) => n.name)).size).toBe(raw.length);
        const notes = stabilizer.push(raw);
        if (notes) {
          committed.push(notes.map((n) => n.name).join('+'));
        }
      }
      outcomes.add(committed.join(' '));
    }
    expect([...outcomes]).toEqual(['C5 G4 C5+E5+G5']);
  });
});
