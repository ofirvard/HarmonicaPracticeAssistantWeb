/**
 * Keeps the last few recordings (Record to Stop), so a real misread note can be saved as a WAV
 * and turned into a test fixture. Simulated audio has missed real bend failures, so real
 * recordings are the evidence to tune against. src/storage/library.ts keeps them across reloads.
 */

/** One Record-to-Stop take, held as 16-bit samples, the same precision the WAV file keeps. */
export class Recording {
  private chunks: Int16Array[] = [];
  private length = 0;
  private rate = 0;

  constructor(
    readonly keyName: string, // the harp key selected when recording started
    private readonly maxSeconds: number, // beyond this only the end is kept, to bound memory
    readonly startedAt = new Date(),
  ) {}

  /** A recording read back from storage. */
  static restore(
    keyName: string,
    maxSeconds: number,
    startedAt: Date,
    sampleRate: number,
    samples: Int16Array,
  ): Recording {
    const recording = new Recording(keyName, maxSeconds, startedAt);
    recording.rate = sampleRate;
    recording.chunks = [samples];
    recording.length = samples.length;
    return recording;
  }

  get sampleRate(): number {
    return this.rate;
  }

  /** Seconds of audio held. */
  get duration(): number {
    return this.rate > 0 ? this.length / this.rate : 0;
  }

  push(samples: ArrayLike<number>, sampleRate: number): void {
    if (sampleRate !== this.rate) {
      // The rate is fixed for a mic session, so this only happens on the first push.
      this.chunks = [];
      this.length = 0;
      this.rate = sampleRate;
    }
    const chunk = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      chunk[i] = toPcm16(samples[i]!);
    }
    this.chunks.push(chunk);
    this.length += chunk.length;
    const max = Math.round(this.maxSeconds * sampleRate);
    while (this.chunks.length > 1 && this.length - this.chunks[0]!.length >= max) {
      this.length -= this.chunks.shift()!.length;
    }
  }

  /** The held audio in order, oldest first. */
  samples(): Int16Array {
    const out = new Int16Array(this.length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }

  /** The held audio as a 16-bit mono PCM WAV file. */
  toWav(): Uint8Array<ArrayBuffer> {
    return encodeWav(this.samples(), this.rate);
  }
}

/** The most recent recordings, newest first. Starting one beyond the limit drops the oldest. */
export class RecordingList {
  private items: Recording[] = [];

  constructor(
    private readonly keep: number,
    private readonly maxSeconds: number,
  ) {}

  get all(): readonly Recording[] {
    return this.items;
  }

  /** Adds recordings read back from storage, keeping the newest. Any started meanwhile stay. */
  restore(recordings: readonly Recording[]): void {
    this.items = [...this.items, ...recordings]
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, this.keep);
  }

  start(keyName: string, startedAt = new Date()): Recording {
    const recording = new Recording(keyName, this.maxSeconds, startedAt);
    this.items = [recording, ...this.items].slice(0, this.keep);
    return recording;
  }
}

/** A sample in roughly [-1, 1] as a clamped 16-bit PCM value. */
export function toPcm16(sample: number): number {
  const s = Math.max(-1, Math.min(1, sample));
  return Math.round(s < 0 ? s * 0x8000 : s * 0x7fff);
}

export function encodeWav(samples: Int16Array, sampleRate: number): Uint8Array<ArrayBuffer> {
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
    view.setInt16(44 + i * 2, samples[i]!, true);
  }
  return bytes;
}
