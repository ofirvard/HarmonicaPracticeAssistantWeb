interface Plan {
  reversed: Uint32Array;
  cos: Float64Array;
  sin: Float64Array;
}

// Twiddle factors and the bit-reversal order depend only on size, and the detector transforms
// the same size for every audio frame.
const plans = new Map<number, Plan>();

function planFor(n: number): Plan {
  let plan = plans.get(n);
  if (!plan) {
    const bits = Math.log2(n);
    const reversed = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      let r = 0;
      for (let b = 0; b < bits; b++) {
        r = (r << 1) | ((i >> b) & 1);
      }
      reversed[i] = r;
    }
    const cos = new Float64Array(n / 2);
    const sin = new Float64Array(n / 2);
    for (let i = 0; i < n / 2; i++) {
      cos[i] = Math.cos((2 * Math.PI * i) / n);
      sin[i] = -Math.sin((2 * Math.PI * i) / n);
    }
    plan = { reversed, cos, sin };
    plans.set(n, plan);
  }
  return plan;
}

/** In-place forward complex FFT (radix-2). Array length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || n === 0 || (n & (n - 1)) !== 0) {
    throw new Error('Array length must be a power of two');
  }
  const { reversed, cos, sin } = planFor(n);

  for (let i = 0; i < n; i++) {
    const j = reversed[i]!;
    if (j > i) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }

  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2;
    const step = n / size;
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        const wr = cos[k * step]!;
        const wi = sin[k * step]!;
        const a = start + k;
        const b = a + half;
        const tr = re[b]! * wr - im[b]! * wi;
        const ti = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
      }
    }
  }
}
