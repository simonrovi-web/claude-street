// Efectos de sonido sintetizados con Web Audio (sin archivos externos).
export class Sfx {
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startCrowd();
  }

  noise(dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.4, freqEnd = null, attack = 0.003 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }

  tone(f0, f1, dur, { type = 'sine', gain = 0.4 } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  hit(heavy) {
    this.noise(heavy ? 0.22 : 0.12, { type: 'highpass', freq: 900, gain: heavy ? 0.7 : 0.5 });
    this.tone(heavy ? 160 : 220, 45, heavy ? 0.25 : 0.14, { type: 'triangle', gain: heavy ? 0.9 : 0.6 });
  }
  block() {
    this.tone(1300, 700, 0.07, { type: 'square', gain: 0.12 });
    this.noise(0.08, { type: 'bandpass', freq: 2500, q: 3, gain: 0.35 });
  }
  whoosh(heavy) { this.noise(heavy ? 0.22 : 0.13, { type: 'bandpass', freq: 500, freqEnd: 1800, q: 1.5, gain: heavy ? 0.22 : 0.13, attack: 0.03 }); }
  step() { this.noise(0.06, { type: 'lowpass', freq: 600, gain: 0.25 }); }
  grab() { this.noise(0.1, { type: 'bandpass', freq: 800, q: 2, gain: 0.4 }); }
  thud() {
    this.tone(90, 35, 0.3, { type: 'sine', gain: 0.9 });
    this.noise(0.2, { type: 'lowpass', freq: 400, gain: 0.5 });
  }
  splash() {
    this.noise(1.2, { type: 'lowpass', freq: 3000, freqEnd: 300, gain: 0.8, attack: 0.01 });
    this.tone(120, 40, 0.4, { gain: 0.6 });
  }
  bell() {
    [0, 0.25].forEach((d) => setTimeout(() => {
      this.tone(1250, 1240, 0.9, { type: 'sine', gain: 0.25 });
      this.tone(2510, 2500, 0.6, { type: 'sine', gain: 0.1 });
    }, d * 1000));
  }

  startCrowd() {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.value = 0.04;
    src.connect(f).connect(this.crowdGain).connect(this.master);
    src.start();
  }
  crowd(level) {
    if (!this.crowdGain) return;
    this.crowdGain.gain.setTargetAtTime(0.03 + level * 0.22, this.ctx.currentTime, 0.25);
  }
}
