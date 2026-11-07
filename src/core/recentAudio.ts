/**
 * Keeps the most recent stretch of microphone audio, so a real misread note can be saved as a WAV
 * and turned into a test fixture. Simulated audio has missed real bend failures, so real recordings
 * are the evidence to tune against.
 */
export class RecentAudio {
  private buffer: Float32Array | null = null;
  private written = 0; // total samples ever pushed since the last reset
  private rate = 0;

  constructor(private readonly seconds: number) {}

  get sampleRate(): number {
    return this.rate;
  }

  get hasAudio(): boolean {
    return this.written > 0;
  }

  /** Seconds of audio currently held. */
  get duration(): number {
    return this.buffer ? Math.min(this.written, this.buffer.length) / this.rate : 0;
  }

  push(samples: ArrayLike<number>, sampleRate: number): void {
    if (!this.buffer || sampleRate !== this.rate) {
      this.rate = sampleRate;
      this.buffer = new Float32Array(Math.round(this.seconds * sampleRate));
      this.written = 0;
    }
    const buffer = this.buffer;
    for (let i = 0; i < samples.length; i++) {
      buffer[(this.written + i) % buffer.length] = samples[i]!;
    }
    this.written += samples.length;
  }

  /** The held audio in order, oldest first. */
  samples(): Float32Array {
    const buffer = this.buffer;
    if (!buffer) {
      return new Float32Array(0);
    }
    if (this.written <= buffer.length) {
      return buffer.slice(0, this.written);
    }
    const start = this.written % buffer.length;
    const out = new Float32Array(buffer.length);
    out.set(buffer.subarray(start));
    out.set(buffer.subarray(0, start), buffer.length - start);
    return out;
  }

  /** The held audio as a 16-bit mono PCM WAV file. */
  toWav(): Uint8Array<ArrayBuffer> {
    return encodeWav(this.samples(), this.rate);
  }
}

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const dataSize = samples.length * 2;
  const bytes = new Uint8Array(44 + dataSize);
  const view = new DataView(bytes.buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), true);
  }
  return bytes;
}
