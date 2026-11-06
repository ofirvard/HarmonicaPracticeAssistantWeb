const SAMPLE_RATE = 48000;
const FADE_SECONDS = 0.02;

export interface Segment {
  seconds: number;
  frequencies: number[]; // empty for silence
}

/** Each note gets overtones and a little noise, so the fake mic is closer to a real reed. */
function sampleAt(frequencies: number[], t: number): number {
  let value = 0;
  for (const f of frequencies) {
    value += Math.sin(2 * Math.PI * f * t);
    value += 0.4 * Math.sin(2 * Math.PI * 2 * f * t);
    value += 0.2 * Math.sin(2 * Math.PI * 3 * f * t);
  }
  return (0.25 * value) / Math.max(1, frequencies.length);
}

/** Renders segments as a 16-bit mono WAV file. */
export function renderWav(segments: Segment[]): Buffer {
  const samples: number[] = [];
  for (const { seconds, frequencies } of segments) {
    const count = Math.round(seconds * SAMPLE_RATE);
    for (let i = 0; i < count; i++) {
      const t = i / SAMPLE_RATE;
      const fade = Math.min(1, t / FADE_SECONDS, (seconds - t) / FADE_SECONDS);
      const noise = (Math.random() - 0.5) * 0.001;
      samples.push(sampleAt(frequencies, t) * fade + noise);
    }
  }

  const dataSize = samples.length * 2;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); // fmt chunk size
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(1, 22); // mono
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * 2, 28); // bytes per second
  wav.writeUInt16LE(2, 32); // bytes per frame
  wav.writeUInt16LE(16, 34); // bits per sample
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  samples.forEach((s, i) => wav.writeInt16LE(Math.round(s * 32767), 44 + i * 2));
  return wav;
}
