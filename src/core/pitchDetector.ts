import { fft } from './fft';
import { frequencyToNote } from './notes';

export interface DetectedNote {
  name: string;
  frequencyHz: number;
}

interface Peak {
  frequencyHz: number;
  magnitude: number;
}

const MIN_FREQ = 27.5; // A0
const MAX_FREQ = 4200; // just above C8
const SILENCE_RMS_THRESHOLD = 0.015;
const PEAK_RELATIVE_THRESHOLD = 0.32; // fraction of the loudest bin
const MAX_NOTES = 6;
const MAX_HARMONIC = 8;
const HARMONIC_TOLERANCE_CENTS = 45;
// A quieter peak is only trusted to demote an accepted fundamental down to a subharmonic of it if
// it's at least this loud relative to that fundamental. Otherwise incidental low-level noise near
// an exact octave or fifth below a correctly detected note keeps flipping it down.
const SUBHARMONIC_REPLACE_MIN_RATIO = 0.5;

function centsBetween(freq: number, expected: number): number {
  return 1200 * Math.log2(freq / expected);
}

function isHarmonicOfKnown(freq: number, fundamentals: Peak[]): boolean {
  return fundamentals.some((f) => {
    for (let h = 1; h <= MAX_HARMONIC; h++) {
      if (Math.abs(centsBetween(freq, f.frequencyHz * h)) < HARMONIC_TOLERANCE_CENTS) {
        return true;
      }
    }
    return false;
  });
}

/** The index of a fundamental that is itself an upper harmonic of freq, or -1. */
function indexOfHarmonicOf(freq: number, fundamentals: Peak[]): number {
  return fundamentals.findIndex((f) => {
    for (let h = 2; h <= MAX_HARMONIC; h++) {
      if (Math.abs(centsBetween(f.frequencyHz, freq * h)) < HARMONIC_TOLERANCE_CENTS) {
        return true;
      }
    }
    return false;
  });
}

/**
 * Detects one or more simultaneously sounding notes in a block of audio: FFT the windowed signal,
 * pick spectral peaks, then walk them loudest first, accepting a peak as a new fundamental only
 * if it isn't a harmonic of one already accepted. A heuristic, not full polyphonic transcription.
 */
export class PitchDetector {
  private readonly hannWindow: Float64Array;
  private readonly re: Float64Array;
  private readonly im: Float64Array;
  private rms = 0;

  constructor(
    private readonly fftSize: number,
    private readonly sampleRate: number,
  ) {
    this.hannWindow = new Float64Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      this.hannWindow[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
    }
    this.re = new Float64Array(fftSize);
    this.im = new Float64Array(fftSize);
  }

  /** RMS level (roughly [0, 1]) measured by the most recent call to detect. */
  get lastRms(): number {
    return this.rms;
  }

  /** samples must contain exactly fftSize values, normalized to roughly [-1, 1]. */
  detect(samples: ArrayLike<number>): DetectedNote[] {
    const { fftSize, sampleRate, re, im, hannWindow } = this;
    let sumSq = 0;
    for (let i = 0; i < fftSize; i++) {
      const s = samples[i]!;
      sumSq += s * s;
      re[i] = s * hannWindow[i]!;
      im[i] = 0;
    }

    this.rms = Math.sqrt(sumSq / fftSize);
    if (this.rms < SILENCE_RMS_THRESHOLD) {
      return [];
    }

    fft(re, im);

    const half = fftSize / 2;
    const mag = new Float64Array(half);
    let maxMag = 0;
    for (let i = 0; i < half; i++) {
      mag[i] = Math.hypot(re[i]!, im[i]!);
      maxMag = Math.max(maxMag, mag[i]!);
    }
    if (maxMag <= 0) {
      return [];
    }

    const minBin = Math.max(1, Math.floor((MIN_FREQ * fftSize) / sampleRate));
    const maxBin = Math.min(half - 2, Math.ceil((MAX_FREQ * fftSize) / sampleRate));
    const threshold = maxMag * PEAK_RELATIVE_THRESHOLD;

    const peaks: Peak[] = [];
    for (let i = minBin; i <= maxBin; i++) {
      const beta = mag[i]!;
      const alpha = mag[i - 1]!;
      const gamma = mag[i + 1]!;
      if (beta > threshold && beta > alpha && beta > gamma) {
        const denom = alpha - 2 * beta + gamma;
        const p = denom !== 0 ? (0.5 * (alpha - gamma)) / denom : 0;
        peaks.push({ frequencyHz: ((i + p) * sampleRate) / fftSize, magnitude: beta });
      }
    }
    peaks.sort((a, b) => b.magnitude - a.magnitude);

    const fundamentals: Peak[] = [];
    for (const peak of peaks) {
      if (isHarmonicOfKnown(peak.frequencyHz, fundamentals)) {
        continue;
      }
      const subharmonicOf = indexOfHarmonicOf(peak.frequencyHz, fundamentals);
      if (subharmonicOf >= 0) {
        // An accepted "fundamental" is really one of this peak's harmonics (the true fundamental
        // was quieter than its 2nd or 3rd partial), so replace it if this peak is loud enough to
        // trust.
        const existing = fundamentals[subharmonicOf]!;
        if (peak.magnitude >= SUBHARMONIC_REPLACE_MIN_RATIO * existing.magnitude) {
          fundamentals[subharmonicOf] = peak;
        }
      } else if (fundamentals.length < MAX_NOTES) {
        fundamentals.push(peak);
      }
    }

    return fundamentals
      .sort((a, b) => a.frequencyHz - b.frequencyHz)
      .map((f) => ({ name: frequencyToNote(f.frequencyHz), frequencyHz: f.frequencyHz }));
  }
}
