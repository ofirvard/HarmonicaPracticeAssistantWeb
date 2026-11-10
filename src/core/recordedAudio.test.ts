import { describe, expect, it } from 'vitest';
import { HARMONICA_KEYS, Harmonica } from './harmonica';
import { HOP_SIZE, NoteReader } from './noteReader';
import { NoteStabilizer } from './noteStabilizer';
import trainNoiseWav from './fixtures/train-noise-C-48k.wav?inline';

/** Decodes a base64 data URL of a 16-bit mono WAV, as Settings → Recent recordings → Save makes. */
function decodeWav(dataUrl: string): { samples: Float32Array; sampleRate: number } {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  let sampleRate = 0;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const id = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') {
      sampleRate = view.getUint32(offset + 12, true);
    } else if (id === 'data') {
      const samples = new Float32Array(size / 2);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = view.getInt16(offset + 8 + i * 2, true) / 32768;
      }
      return { samples, sampleRate };
    }
    offset += 8 + size + (size & 1);
  }
  throw new Error('no data chunk');
}

/** Every entry recording would write, as the listener does it: reader, then stabilizer. */
function entries(wav: string, harp: Harmonica): string[] {
  const { samples, sampleRate } = decodeWav(wav);
  const reader = new NoteReader(sampleRate);
  reader.setRange(harp.range);
  const stabilizer = new NoteStabilizer();
  const result: string[] = [];
  for (let i = 0; i + HOP_SIZE <= samples.length; i += HOP_SIZE) {
    const notes = stabilizer.push(reader.push(samples.subarray(i, i + HOP_SIZE)));
    if (notes) {
      result.push(notes.map((n) => n.name).join('+'));
    }
  }
  return result;
}

describe('real recordings', () => {
  // 7 s on a train with nothing played, recorded on the user's Android phone at 48 kHz with the
  // key set to C (2026-11-10). It held engine rumble near G1 and noise around A3, all below the
  // harp, and 0.5.0 wrote 25 n/a entries from it.
  it('writes nothing for train noise with no harp playing (C harp)', () => {
    expect(entries(trainNoiseWav, new Harmonica(HARMONICA_KEYS[0]!))).toEqual([]);
  });
});
