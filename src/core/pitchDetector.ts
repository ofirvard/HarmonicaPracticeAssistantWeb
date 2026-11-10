import { fft } from './fft';
import type { FrequencyRange } from './harmonica';
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
export const SILENCE_RMS_THRESHOLD = 0.015;
const PEAK_RELATIVE_THRESHOLD = 0.32; // fraction of the loudest bin
const MAX_NOTES = 6;
const MAX_HARMONIC = 8;
const HARMONIC_TOLERANCE_CENTS = 45;
// A quieter peak is only trusted to demote an accepted fundamental down to a subharmonic of it if
// it's at least this loud relative to that fundamental. Otherwise incidental low-level noise near
// an exact octave or fifth below a correctly detected note keeps flipping it down.
const SUBHARMONIC_REPLACE_MIN_RATIO = 0.5;
// A bent note can put so much energy into its overtones that its fundamental falls below
// PEAK_RELATIVE_THRESHOLD. Such a quiet peak is only used to explain louder peaks as its harmonics.
const WEAK_FUNDAMENTAL_THRESHOLD = 0.05; // fraction of the loudest bin
const WEAK_FUNDAMENTAL_MIN_HARMONICS = 2;
// One overtone is weaker evidence than two, as a stray noise peak could sit below any clean note,
// so the quiet fundamental has to be this loud relative to that overtone.
const SINGLE_OVERTONE_MIN_RATIO = 0.15;
const SINGLE_OVERTONE_MAX_HARMONIC = 3;
const WEAK_FUNDAMENTAL_TOLERANCE_CENTS = 30;
const LOWEST_HARMONICA_NOTE = 190; // just below G3, hole 1 blow on the lowest supported key
// With a harp's range set, a note this far beyond its lowest or highest note still counts, so a
// slightly flat bottom note or sharp top note isn't lost. Half a semitone, the naming boundary.
const RANGE_MARGIN = 2 ** (50 / 1200);
// A sound outside the selected harp is only reported if it is a clear tone: its peak must be this
// many times the median level within half an octave either side. On a train (recording from
// 2026-11-10, C harp), every noise peak scored under 13 and was written as a stream of n/a
// entries; a played note scores in the hundreds. Notes the harp can play aren't checked.
const MIN_OUT_OF_RANGE_PROMINENCE = 20;

/** How far a peak stands above the median level of the bins within half an octave of it. */
function prominence(mag: Float64Array, peak: Peak, binHz: number): number {
  const bin = peak.frequencyHz / binHz;
  const lo = Math.max(1, Math.floor(bin / Math.SQRT2));
  const hi = Math.min(mag.length - 1, Math.ceil(bin * Math.SQRT2));
  const around = Array.from(mag.subarray(lo, hi + 1)).sort((a, b) => a - b);
  const median = around[Math.floor(around.length / 2)]!;
  return median > 0 ? peak.magnitude / median : Infinity;
}

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

/** Whether these accepted notes, all harmonics of the quiet candidate, are really its overtones. */
function areOvertonesOf(candidate: Peak, harmonics: Peak[]): boolean {
  if (harmonics.length >= WEAK_FUNDAMENTAL_MIN_HARMONICS) {
    return true;
  }
  const [only] = harmonics;
  return (
    only !== undefined &&
    Math.round(only.frequencyHz / candidate.frequencyHz) <= SINGLE_OVERTONE_MAX_HARMONIC &&
    candidate.magnitude >= SINGLE_OVERTONE_MIN_RATIO * only.magnitude
  );
}

function isUpperHarmonic(freq: number, fundamental: number): boolean {
  const h = Math.round(freq / fundamental);
  return (
    h >= 2 &&
    h <= MAX_HARMONIC &&
    Math.abs(centsBetween(freq, fundamental * h)) < WEAK_FUNDAMENTAL_TOLERANCE_CENTS
  );
}

/**
 * Replaces accepted notes that are really overtones of a quiet fundamental with that fundamental.
 * Needs a real peak at the fundamental, not just notes that fit a harmonic series: a chord like
 * C6+E6+G6 also lines up as harmonics of C4, but nothing is sounding at C4.
 */
function absorbIntoWeakFundamentals(
  fundamentals: Peak[],
  weakPeaks: Peak[],
  canBeNote: (freq: number) => boolean,
): Peak[] {
  let result = fundamentals;
  for (const candidate of [...weakPeaks].sort((a, b) => b.magnitude - a.magnitude)) {
    if (!canBeNote(candidate.frequencyHz)) {
      continue;
    }
    const harmonics = result.filter((f) => isUpperHarmonic(f.frequencyHz, candidate.frequencyHz));
    if (areOvertonesOf(candidate, harmonics)) {
      result = [...result.filter((f) => !harmonics.includes(f)), candidate];
    }
  }
  return result;
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
  private range: FrequencyRange | null = null;

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

  /**
   * Tells the detector which notes the selected harp can play. A sound outside the range still
   * claims its own overtones, so a low hum doesn't show up as its octave, but it never replaces a
   * note as its "true" lower fundamental and never absorbs a note as one of its overtones. It is
   * only reported when nothing inside the range is sounding. That stops a low rumble a twelfth
   * below a note from replacing it, and a high overtone from showing up as a second note, while a
   * note the harp can't play still shows up on its own.
   */
  setRange(range: FrequencyRange | null): void {
    this.range = range;
  }

  private canBeNote(freq: number): boolean {
    if (!this.range) {
      return freq >= LOWEST_HARMONICA_NOTE;
    }
    return freq >= this.range.minHz / RANGE_MARGIN && freq <= this.range.maxHz * RANGE_MARGIN;
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
    const weakThreshold = maxMag * WEAK_FUNDAMENTAL_THRESHOLD;

    const peaks: Peak[] = [];
    const weakPeaks: Peak[] = [];
    for (let i = minBin; i <= maxBin; i++) {
      const beta = mag[i]!;
      const alpha = mag[i - 1]!;
      const gamma = mag[i + 1]!;
      if (beta > weakThreshold && beta > alpha && beta > gamma) {
        const denom = alpha - 2 * beta + gamma;
        const p = denom !== 0 ? (0.5 * (alpha - gamma)) / denom : 0;
        const peak = { frequencyHz: ((i + p) * sampleRate) / fftSize, magnitude: beta };
        (beta > threshold ? peaks : weakPeaks).push(peak);
      }
    }
    peaks.sort((a, b) => b.magnitude - a.magnitude);

    let fundamentals: Peak[] = [];
    for (const peak of peaks) {
      if (isHarmonicOfKnown(peak.frequencyHz, fundamentals)) {
        continue;
      }
      const subharmonicOf = indexOfHarmonicOf(peak.frequencyHz, fundamentals);
      if (subharmonicOf >= 0 && this.range && !this.canBeNote(peak.frequencyHz)) {
        // Something the harp can't play, such as rumble a twelfth below, is never the real note.
        continue;
      }
      if (subharmonicOf >= 0) {
        // An accepted "fundamental" is really one of this peak's harmonics (the true fundamental
        // was quieter than its 2nd or 3rd partial), so replace it if this peak is loud enough to
        // trust.
        const existing = fundamentals[subharmonicOf]!;
        if (peak.magnitude >= SUBHARMONIC_REPLACE_MIN_RATIO * existing.magnitude) {
          fundamentals[subharmonicOf] = peak;
        } else {
          weakPeaks.push(peak);
        }
      } else if (fundamentals.length < MAX_NOTES) {
        fundamentals.push(peak);
      }
    }

    fundamentals = absorbIntoWeakFundamentals(fundamentals, weakPeaks, (f) => this.canBeNote(f));
    // Next to a note the harp can play, a sound outside its range is far more likely an overtone or
    // noise than a second note, so it's only reported when it's the only thing sounding. Even
    // then, it must be pitched where some harmonica could play it (not traffic or engine rumble)
    // and stand out as a clear tone rather than background noise.
    if (this.range) {
      const inRange = fundamentals.filter((f) => this.canBeNote(f.frequencyHz));
      const binHz = sampleRate / fftSize;
      fundamentals =
        inRange.length > 0
          ? inRange
          : fundamentals.filter(
              (f) =>
                f.frequencyHz >= LOWEST_HARMONICA_NOTE &&
                prominence(mag, f, binHz) >= MIN_OUT_OF_RANGE_PROMINENCE,
            );
    }

    // A note ending partway through the window can split into two peaks that round to the same
    // name. One note can't sound twice, so keep the louder peak.
    const loudestByName = new Map<string, Peak>();
    for (const f of fundamentals.sort((a, b) => a.frequencyHz - b.frequencyHz)) {
      const name = frequencyToNote(f.frequencyHz);
      const existing = loudestByName.get(name);
      if (!existing || f.magnitude > existing.magnitude) {
        loudestByName.set(name, f);
      }
    }
    return [...loudestByName].map(([name, f]) => ({ name, frequencyHz: f.frequencyHz }));
  }
}
