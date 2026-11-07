import type { FrequencyRange } from './harmonica';
import { PitchDetector, type DetectedNote } from './pitchDetector';

export const FFT_SIZE = 4096;
export const HOP_SIZE = 2048; // 50% overlap between analysis windows

/** Feeds hops of audio through a sliding FFT window into the pitch detector. */
export class NoteReader {
  private readonly window = new Float64Array(FFT_SIZE);
  private readonly detector: PitchDetector;

  constructor(sampleRate: number) {
    this.detector = new PitchDetector(FFT_SIZE, sampleRate);
  }

  setRange(range: FrequencyRange | null): void {
    this.detector.setRange(range);
  }

  get lastRms(): number {
    return this.detector.lastRms;
  }

  /** hop must contain exactly HOP_SIZE samples. */
  push(hop: ArrayLike<number>): DetectedNote[] {
    this.window.copyWithin(0, HOP_SIZE);
    this.window.set(hop, FFT_SIZE - HOP_SIZE);
    return this.detector.detect(this.window);
  }
}
