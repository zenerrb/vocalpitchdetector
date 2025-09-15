/* McLeod Pitch Method AudioWorkletProcessor
 * Provides robust pitch detection with low latency.
 * Posts messages: { type: 'pitch', freq, confidence, rms, ts }
 */

class PitchProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = sampleRate; // global from AudioWorkletProcessor scope
    // Adaptive settings
    this.minFreq = 70;   // configurable via message
    this.maxFreq = 1000; // vocal upper bound
    this.lastPitch = null;
    this.bufferSize = 2048; // process in chunks
    this.frame = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.frameCount = 0;
    this.port.onmessage = (e) => this.handleMessage(e.data);
  }

  handleMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'config') {
      if (msg.minFreq) this.minFreq = msg.minFreq;
      if (msg.maxFreq) this.maxFreq = msg.maxFreq;
    }
  }

  // McLeod Pitch Method (MPM)
  mpmPitch(frame) {
    const N = frame.length;
    // Remove DC & apply Hann window
    let mean = 0;
    for (let i = 0; i < N; i++) mean += frame[i];
    mean /= N;
    let rms = 0;
    for (let i = 0; i < N; i++) {
      const w = 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
      const v = (frame[i] - mean) * w;
      frame[i] = v;
      rms += v * v;
    }
    rms = Math.sqrt(rms / N);
    if (rms < 0.005) return { freq: null, confidence: 0, rms };

    const maxTau = Math.min(Math.floor(this.sampleRate / this.minFreq), N - 1);
    const minTau = Math.max(2, Math.floor(this.sampleRate / this.maxFreq));

    // Autocorrelation & difference simultaneously (MPM uses normalized squared difference aka NSDF)
    const nsdf = new Float32Array(maxTau + 1);
    for (let tau = minTau; tau <= maxTau; tau++) {
      let ac = 0, m = 0;
      for (let i = 0; i < N - tau; i++) {
        const x = frame[i];
        const y = frame[i + tau];
        ac += x * y;
        m += x * x + y * y;
      }
      nsdf[tau] = m > 0 ? (2 * ac) / m : 0; // -1..1, peaks near 1 for strong periodicity
    }

    // Peak picking: find maxima above threshold, choose highest with parabolic interpolation
    let bestTau = -1;
    let bestVal = 0;
    let prev = 0;
    const threshold = 0.6; // periodicity threshold
    for (let tau = minTau + 1; tau < maxTau; tau++) {
      const v = nsdf[tau];
      if (v > prev && v > nsdf[tau + 1] && v > threshold) { // local max
        if (v > bestVal) { bestVal = v; bestTau = tau; }
      }
      prev = v;
    }
    if (bestTau === -1) {
      // fallback: choose absolute max
      for (let tau = minTau + 1; tau < maxTau; tau++) {
        if (nsdf[tau] > bestVal) { bestVal = nsdf[tau]; bestTau = tau; }
      }
      if (bestTau === -1) return { freq: null, confidence: 0, rms };
    }

    // Parabolic interpolation around bestTau
    const x0 = bestTau - 1 >= 0 ? nsdf[bestTau - 1] : nsdf[bestTau];
    const x1 = nsdf[bestTau];
    const x2 = bestTau + 1 <= maxTau ? nsdf[bestTau + 1] : nsdf[bestTau];
    const denom = (2 * x1 - x0 - x2);
    const shift = denom !== 0 ? 0.5 * (x0 - x2) / denom : 0;
    const refinedTau = bestTau + shift;

    const freq = this.sampleRate / refinedTau;
    if (freq < this.minFreq || freq > this.maxFreq) return { freq: null, confidence: 0, rms };

  // Confidence primarily from NSDF peak (periodicity). RMS just gates silence.
  const confidence = Math.max(0, Math.min(1, bestVal));

    return { freq, confidence, rms };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0];
    const needed = this.bufferSize - this.writeIndex;
    if (channel.length >= needed) {
      this.frame.set(channel.subarray(0, needed), this.writeIndex);
      // pitch process
      const result = this.mpmPitch(this.frame.slice());
      this.writeIndex = 0; // reset
      if (result.freq) {
        this.port.postMessage({ type: 'pitch', ...result, ts: currentTime });
      } else if (result.rms > 0.01) {
        // still send low-confidence frame occasionally (downsampled)
        if (this.frameCount % 4 === 0) {
          this.port.postMessage({ type: 'pitch', ...result, ts: currentTime });
        }
      }
      this.frameCount++;
      // Remainder for next frame
      const remain = channel.length - needed;
      if (remain > 0) {
        const slice = channel.subarray(needed);
        const copy = Math.min(slice.length, this.bufferSize);
        this.frame.set(slice.subarray(0, copy), 0);
        this.writeIndex = copy;
      }
    } else {
      this.frame.set(channel, this.writeIndex);
      this.writeIndex += channel.length;
    }
    return true; // keep alive
  }
}

registerProcessor('pitch-processor', PitchProcessor);
