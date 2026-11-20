// Música del juego: toca las notas compuestas en Ableton (assets/musica.json)
// con sintetizadores de Web Audio. Cada tema tiene 4 pistas: lead, bass, pad y drums.
const LOOKAHEAD = 0.3;   // segundos que se programan por adelantado
const TICK = 60;         // ms entre pasadas del programador

const mtof = (p) => 440 * Math.pow(2, (p - 69) / 12);

export class Music {
  constructor(sfx) {
    this.sfx = sfx;
    this.data = null;
    this.name = null;
    this.timer = null;
    let on = true;
    try { on = localStorage.getItem('cs-music') !== 'off'; } catch (e) { /* sin almacenamiento */ }
    this.enabled = on;
    this.level = 1;
  }

  async load(url) {
    this.data = await fetch(url).then((r) => r.json());
    // aplanar y ordenar las notas de cada tema
    for (const th of Object.values(this.data.themes)) {
      th.flat = [];
      for (const [tr, notes] of Object.entries(th.parts)) {
        for (const n of notes) th.flat.push({ tr, p: n.pitch, t: n.start_time, d: n.duration, v: n.velocity / 127 });
      }
      th.flat.sort((a, b) => a.t - b.t);
    }
  }

  ready() {
    const ctx = this.sfx.ctx;
    if (!ctx || !this.data) return false;
    if (!this.master) {
      this.ctx = ctx;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -16; this.comp.ratio.value = 4;
      this.master = ctx.createGain();
      this.master.gain.value = this.target();
      this.master.connect(this.comp).connect(this.sfx.master);
    }
    return true;
  }

  target() { return this.enabled ? 0.55 * this.level : 0; }
  setLevel(l) {
    if (this.level === l) return;
    this.level = l;
    if (this.master) this.master.gain.setTargetAtTime(this.target(), this.ctx.currentTime, 0.25);
  }
  toggle() {
    this.enabled = !this.enabled;
    try { localStorage.setItem('cs-music', this.enabled ? 'on' : 'off'); } catch (e) { /* sin almacenamiento */ }
    if (this.master) this.master.gain.setTargetAtTime(this.target(), this.ctx.currentTime, 0.1);
    return this.enabled;
  }

  // Cambia de tema con un fundido corto. Si ya suena ese tema, no hace nada.
  play(name) {
    if (name === this.name) return;
    if (!this.ready()) return;
    const ctx = this.ctx;
    if (this.bus) {
      const old = this.bus;
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      setTimeout(() => old.disconnect(), 800);
    }
    this.name = name;
    this.theme = name ? this.data.themes[name] : null;
    if (!this.theme) { this.bus = null; return; }
    this.bus = ctx.createGain();
    this.bus.connect(this.master);
    this.spb = 60 / this.data.tempo;
    this.start = ctx.currentTime + 0.1;
    this.idx = 0;
    this.loopN = 0;
    if (!this.timer) this.timer = setInterval(() => this.schedule(), TICK);
    this.schedule();
  }

  schedule() {
    const th = this.theme;
    if (!th || !this.bus) return;
    const now = this.ctx.currentTime;
    const list = th.flat;
    for (;;) {
      if (this.idx >= list.length) {
        if (!th.loop) return;
        this.idx = 0;
        this.loopN++;
      }
      const n = list[this.idx];
      const time = this.start + (this.loopN * th.length + n.t) * this.spb;
      if (time > now + LOOKAHEAD) return;
      this.idx++;
      if (time < now - 0.05) continue; // la pestaña estuvo en segundo plano: saltamos lo atrasado
      this.note(n, time);
    }
  }

  note(n, t) {
    const dur = n.d * this.spb;
    switch (n.tr) {
      case 'lead': return this.lead(n.p, t, dur, n.v);
      case 'bass': return this.bass(n.p, t, dur, n.v);
      case 'pad': return this.pad(n.p, t, dur, n.v);
      default: return this.drum(n.p, t, n.v);
    }
  }

  // ---------------------------------------------------------------- instrumentos
  env(g, t, a, peak, dur, rel, sus = 0.7) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, 0.08);
    g.gain.setValueAtTime(peak * sus, t + Math.max(a, dur));
    g.gain.linearRampToValueAtTime(0, t + Math.max(a, dur) + rel);
  }
  osc(type, f, detune = 0) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    return o;
  }

  lead(p, t, dur, v) {
    const ctx = this.ctx, f = mtof(p);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(4200, t + 0.03);
    lp.frequency.exponentialRampToValueAtTime(1800, t + 0.3);
    const a = this.osc('sawtooth', f, -6), b = this.osc('square', f, 7);
    const vib = this.osc('sine', 5.5), vg = ctx.createGain();
    vg.gain.value = dur > 0.4 ? 6 : 0; // vibrato en notas largas
    vib.connect(vg); vg.connect(a.detune); vg.connect(b.detune);
    const mix = ctx.createGain(); mix.gain.value = 0.5;
    a.connect(mix); b.connect(mix);
    mix.connect(lp).connect(g).connect(this.bus);
    this.env(g, t, 0.01, 0.16 * v, dur, 0.09, 0.75);
    const end = t + dur + 0.15;
    for (const o of [a, b, vib]) { o.start(t); o.stop(end); }
  }

  bass(p, t, dur, v) {
    const ctx = this.ctx, f = mtof(p);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(1600, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + 0.18);
    const a = this.osc('sawtooth', f), sub = this.osc('sine', f / 2);
    const sg = ctx.createGain(); sg.gain.value = 0.6;
    a.connect(lp); sub.connect(sg).connect(lp);
    lp.connect(g).connect(this.bus);
    this.env(g, t, 0.005, 0.32 * v, dur, 0.05, 0.6);
    for (const o of [a, sub]) { o.start(t); o.stop(t + dur + 0.1); }
  }

  pad(p, t, dur, v) {
    const ctx = this.ctx, f = mtof(p);
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 0.7;
    const a = this.osc('sawtooth', f, -11), b = this.osc('sawtooth', f, 11), c = this.osc('triangle', f * 2);
    const cg = ctx.createGain(); cg.gain.value = 0.4;
    a.connect(lp); b.connect(lp); c.connect(cg).connect(lp);
    lp.connect(g).connect(this.bus);
    this.env(g, t, Math.min(0.35, dur * 0.3), 0.05 * v, dur, 0.5, 0.85);
    for (const o of [a, b, c]) { o.start(t); o.stop(t + dur + 0.6); }
  }

  noise(t, dur, type, freq, q, peak) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.sfx.noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = type; fl.frequency.value = freq; fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.bus);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.02);
  }
  thump(t, f0, f1, dur, peak, type = 'sine') {
    const o = this.osc(type, f0), g = this.ctx.createGain();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.5);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  drum(p, t, v) {
    switch (p) {
      case 36: this.thump(t, 155, 42, 0.32, 0.95 * v); this.noise(t, 0.02, 'lowpass', 3000, 1, 0.3 * v); break; // bombo
      case 38: this.noise(t, 0.17, 'bandpass', 1900, 0.8, 0.55 * v); this.thump(t, 220, 160, 0.1, 0.35 * v, 'triangle'); break; // caja
      case 39: for (let i = 0; i < 3; i++) this.noise(t + i * 0.011, 0.09 + i * 0.03, 'bandpass', 1200, 1.5, 0.45 * v); break; // palmas
      case 42: this.noise(t, 0.045, 'highpass', 7500, 0.8, 0.22 * v); break; // charles cerrado
      case 46: this.noise(t, 0.22, 'highpass', 6500, 0.8, 0.2 * v); break; // charles abierto
      case 49: this.noise(t, 1.4, 'highpass', 4800, 0.5, 0.22 * v); break; // plato
      case 45: case 47: case 50: {
        const f = { 45: 110, 47: 140, 50: 180 }[p];
        this.thump(t, f * 1.4, f, 0.3, 0.6 * v);
        break;
      }
      default: this.noise(t, 0.05, 'highpass', 5000, 1, 0.1 * v);
    }
  }
}

// Qué tema corresponde a cada fase del juego.
export function themeFor(phase) {
  switch (phase) {
    case 'select': return 'seleccion';
    case 'intro': case 'fight': case 'ko': case 'roundEnd': case 'paused': case 'finishWait': case 'finish': return 'combate';
    case 'matchEnd': return 'victoria';
    default: return 'menu';
  }
}
