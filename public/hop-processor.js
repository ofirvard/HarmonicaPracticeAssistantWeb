// Runs on the audio thread. Collects the browser's 128-sample blocks into fixed-size hops of raw
// samples and posts them to the page. Plain JS in public/ because a worklet is loaded by URL.
class HopProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.hopSize = options.processorOptions.hopSize;
    this.hop = new Float32Array(this.hopSize);
    this.filled = 0;
  }

  process(inputs) {
    // The node is configured to downmix to one channel. There's no channel at all while the
    // source has nothing to deliver.
    const samples = inputs[0][0];
    if (!samples) {
      return true;
    }
    let offset = 0;
    while (offset < samples.length) {
      const count = Math.min(samples.length - offset, this.hopSize - this.filled);
      this.hop.set(samples.subarray(offset, offset + count), this.filled);
      this.filled += count;
      offset += count;
      if (this.filled === this.hopSize) {
        this.port.postMessage(this.hop, [this.hop.buffer]);
        this.hop = new Float32Array(this.hopSize);
        this.filled = 0;
      }
    }
    return true;
  }
}

registerProcessor('hop-processor', HopProcessor);
