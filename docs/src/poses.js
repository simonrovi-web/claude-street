// Poses del luchador. Cada pose es un conjunto de ángulos (radianes) por articulación.
// Personaje mirando a +Z. Brazo/pierna apuntando hacia abajo en reposo:
//   rotación X negativa -> balancea hacia delante; Z positiva -> separa hacia +X (lado izquierdo).
export const KEYS = [
  'y', 'hx', 'hy', 'sx', 'sy', 'hd',
  'lsx', 'lsz', 'lex', 'rsx', 'rsz', 'rex',
  'lhx', 'lhz', 'lkx', 'rhx', 'rhz', 'rkx',
  'tilt', 'lift',
];

export function P(o = {}) {
  const p = {};
  for (const k of KEYS) p[k] = o[k] ?? 0;
  return p;
}
export function over(base, o) {
  const p = { ...base };
  for (const k in o) p[k] = o[k];
  return p;
}
export function lerpPose(a, b, t) {
  const p = {};
  for (const k of KEYS) p[k] = a[k] + (b[k] - a[k]) * t;
  return p;
}
const smooth = (t) => t * t * (3 - 2 * t);

// keys: [[frame, pose], ...] ordenados
export function samplePose(keys, f) {
  if (f <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [f0, p0] = keys[i], [f1, p1] = keys[i + 1];
    if (f <= f1) return lerpPose(p0, p1, smooth((f - f0) / Math.max(1e-6, f1 - f0)));
  }
  return keys[keys.length - 1][1];
}

// ---------- poses base ----------
export const STANCE = P({
  y: -0.06, hy: -0.4, sx: 0.06, sy: 0.25, hd: 0.05,
  lsx: -1.15, lsz: 0.12, lex: -1.75,
  rsx: -0.75, rsz: -0.25, rex: -2.1,
  lhx: -0.35, lhz: 0.06, lkx: 0.45,
  rhx: 0.28, rhz: -0.06, rkx: 0.35,
});
export const GUARD = over(STANCE, { lsx: -1.0, lex: -2.25, rsx: -0.9, rex: -2.35, sx: 0.14, hd: 0.2, y: -0.1, sy: 0.15 });
export const CROUCH = over(STANCE, {
  y: -0.36, sx: 0.35, hx: 0.08,
  lhx: -1.05, lkx: 1.85, lhz: 0.15,
  rhx: -0.75, rkx: 1.75, rhz: -0.15,
});
export const CROUCH_GUARD = over(CROUCH, { lsx: -0.9, lex: -2.25, rsx: -0.8, rex: -2.35, hd: 0.2 });
export const JUMP = over(STANCE, { y: 0, lhx: -1.2, lkx: 1.9, rhx: -0.6, rkx: 1.6, sx: 0.1 });
export const LAND = over(STANCE, { y: -0.16, lkx: 0.8, rkx: 0.7 });
export const SIDESTEP = over(STANCE, { y: -0.12, sx: 0.15, lsz: 0.3, rsz: -0.35 });

export const HIT_HIGH = over(STANCE, { hx: -0.3, sx: -0.35, hd: -0.5, lsz: 0.6, rsz: -0.6, lsx: -0.4, rsx: -0.4, lex: -0.6, rex: -0.6 });
export const HIT_MID = over(STANCE, { sx: 0.65, hd: 0.35, y: -0.14, lsx: -0.5, rsx: -0.5, lex: -1.0, rex: -1.0 });
export const HIT_CROUCH = over(CROUCH, { sx: -0.1, hd: -0.4, lsz: 0.5, rsz: -0.5, lsx: -0.3, rsx: -0.3 });
export const BLOCK = over(GUARD, { hx: -0.12, y: -0.13, hd: 0.3 });
export const BLOCK_CROUCH = over(CROUCH_GUARD, { hx: -0.1, hd: 0.3 });
export const KNOCK = P({
  tilt: -1.5, lift: 0.13, hd: 0.25,
  lsx: -0.4, lsz: 1.2, lex: -0.4, rsx: -0.5, rsz: -1.2, rex: -0.6,
  lhx: -0.2, lkx: 0.5, rhx: -0.45, rkx: 0.3, lhz: 0.15, rhz: -0.12,
});
export const VICTORY = over(STANCE, {
  hy: 0, sy: 0, y: 0, sx: -0.05, hd: -0.15,
  lsx: -2.9, lsz: 0.3, lex: -0.3, rsx: -0.2, rsz: -0.25, rex: -1.4,
  lhx: -0.1, rhx: 0.1, lkx: 0.1, rkx: 0.1,
});

// ---------- ataques ----------
// s = arranque, a = frames activos, r = recuperación (60 fps)
// level: high (se esquiva agachándose), mid (golpea agachado), low (hay que cubrirse agachado)
export const ATTACKS = {
  jab: {
    s: 6, a: 3, r: 10, dmg: 8, level: 'high', reach: 0.95, width: 0.4, hs: 14, bs: 9, push: 0.04,
    chain: { P: 'straight', K: 'highKick' },
    W: over(STANCE, { lsx: -1.1, lex: -2.0, sy: 0.35 }),
    S: over(STANCE, { lsx: -1.6, lsz: -0.05, lex: -0.05, sy: -0.1, hy: -0.55 }),
  },
  straight: {
    s: 7, a: 3, r: 14, dmg: 10, level: 'high', reach: 1.0, width: 0.4, hs: 16, bs: 10, push: 0.06,
    chain: { K: 'spinKick' },
    W: over(STANCE, { rsx: -0.9, rex: -2.2, sy: 0.2 }),
    S: over(STANCE, { rsx: -1.6, rsz: 0.1, rex: -0.05, sy: 0.75, hy: -0.1, lhx: -0.45 }),
  },
  highKick: {
    s: 12, a: 4, r: 20, dmg: 16, level: 'high', reach: 1.2, width: 0.5, hs: 20, bs: 12, push: 0.1,
    W: over(STANCE, { rhx: -0.6, rkx: 1.6, rhz: -0.3, sy: 0.1, hy: -0.1 }),
    S: over(STANCE, { rhx: -1.9, rhz: -0.6, rkx: 0.1, hx: -0.25, hy: 0.3, lkx: 0.15, sx: -0.1, lsx: -0.5, lsz: 0.6 }),
  },
  spinKick: {
    s: 14, a: 5, r: 26, dmg: 22, level: 'high', reach: 1.25, width: 0.85, bs: 14, push: 0.13, knockdown: true, heavy: true,
    spin: true,
    W: over(STANCE, { hy: 1.2, rhx: -0.6, rkx: 1.5, sy: 0 }),
    S: over(STANCE, { hy: 2.8, rhx: -1.75, rhz: -0.9, rkx: 0.1, hx: -0.3, lkx: 0.1, lsz: 0.8, rsz: -0.8, sy: 0 }),
    S2: over(STANCE, { hy: 3.8, rhx: -1.6, rhz: -0.8, rkx: 0.15, hx: -0.25, lkx: 0.1, lsz: 0.8, rsz: -0.8, sy: 0 }),
  },
  elbow: {
    s: 10, a: 3, r: 16, dmg: 14, level: 'mid', reach: 0.85, width: 0.45, hs: 18, bs: 12, push: 0.07, lunge: 0.03,
    W: over(STANCE, { rsx: -0.6, rex: -2.4, sy: 0.1 }),
    S: over(STANCE, { rsx: -1.3, rsz: 0.5, rex: -2.5, sy: 0.9, hy: 0.0, y: -0.12, lhx: -0.6, lkx: 0.7 }),
  },
  kick: {
    s: 11, a: 4, r: 18, dmg: 15, level: 'mid', reach: 1.15, width: 0.45, hs: 18, bs: 12, push: 0.08,
    W: over(STANCE, { rhx: -1.0, rkx: 1.7 }),
    S: over(STANCE, { rhx: -1.55, rkx: 0.15, hx: -0.15, lkx: 0.1 }),
  },
  pushKick: {
    s: 14, a: 4, r: 22, dmg: 14, level: 'mid', reach: 1.2, width: 0.45, hs: 20, bs: 14, push: 0.2, lunge: 0.02, heavy: true,
    W: over(STANCE, { lhx: -1.2, lkx: 1.9, y: 0.02 }),
    S: over(STANCE, { lhx: -1.6, lkx: 0.0, hx: -0.25, rkx: 0.1, hy: -0.6 }),
  },
  lowPunch: {
    s: 7, a: 3, r: 12, dmg: 6, level: 'low', reach: 0.9, width: 0.4, hs: 12, bs: 8, push: 0.03, crouch: true,
    W: over(CROUCH, { lsx: -0.8, lex: -2.0 }),
    S: over(CROUCH, { lsx: -1.3, lex: -0.1, sx: 0.55, sy: -0.2 }),
  },
  sweep: {
    s: 15, a: 5, r: 28, dmg: 16, level: 'low', reach: 1.2, width: 0.75, bs: 14, push: 0.06, knockdown: true, crouch: true,
    W: over(CROUCH, { hy: 0.4 }),
    S: over(CROUCH, { y: -0.5, rhx: -1.5, rkx: 0.05, rhz: -0.5, hy: 1.4, sx: 0.6, lsz: 0.6 }),
  },
  jumpKick: {
    s: 6, a: 10, r: 0, dmg: 16, level: 'mid', reach: 1.1, width: 0.5, hs: 20, bs: 12, push: 0.1, air: true,
    W: JUMP,
    S: over(JUMP, { rhx: -1.6, rkx: 0.1, hx: -0.2 }),
  },
  throwWhiff: {
    s: 5, a: 0, r: 22, dmg: 0, level: 'none', reach: 0, width: 0,
    W: over(STANCE, { lsx: -1.4, lex: -0.4, rsx: -1.4, rex: -0.4, lsz: -0.2, rsz: 0.2, sy: 0 }),
    S: over(STANCE, { lsx: -1.5, lex: -0.2, rsx: -1.5, rex: -0.2, lsz: -0.3, rsz: 0.3, sy: 0, y: -0.08 }),
  },
};

// ---------- golpes especiales (uno por luchador, cuestan media barra de energía) ----------
// Campos extra: hits = ventanas activas [desde, hasta]; move = [desde, hasta, velocidad];
// teleport = frame en el que aparece detrás del rival; projectile = { at, speed, life };
// slamAt = frame del golpe contra el suelo; launch = impulso vertical al derribar; keys = animación propia.
const DRAGON_W = over(CROUCH, { rsx: -0.4, rex: -2.2, lsx: -1.0, lex: -2.0, sy: 0.4 });
const DRAGON_S = over(STANCE, { y: 0.08, hy: 0.1, sy: 0.6, sx: -0.25, hd: -0.3, rsx: -3.0, rsz: 0.15, rex: -0.15, lsx: -0.6, lex: -1.6, lhx: -1.0, lkx: 1.3, rhx: 0.1, rkx: 0.1 });
const STORM_W = over(STANCE, { lhx: -0.9, lkx: 1.6, y: 0.0, hx: -0.05 });
const STORM_K1 = over(STANCE, { rhx: -1.7, rhz: -0.5, rkx: 0.1, hx: -0.25, hy: 0.4, lkx: 0.15, lsz: 0.6, rsz: -0.5 });
const STORM_K2 = over(STANCE, { lhx: -1.8, lhz: 0.5, lkx: 0.1, hx: -0.25, hy: -0.9, rkx: 0.15, lsz: 0.6, rsz: -0.6 });
const STORM_K3 = over(STANCE, { rhx: -2.1, rhz: -0.7, rkx: 0.05, hx: -0.35, hy: 0.6, lkx: 0.1, y: 0.04, lsz: 0.9, rsz: -0.9 });
const QUAKE_W = over(STANCE, { y: 0.02, hy: 0, sy: 0, sx: -0.3, hd: -0.3, lsx: -3.0, lsz: 0.2, lex: -0.5, rsx: -3.0, rsz: -0.2, rex: -0.5, lhx: -0.2, rhx: 0.2 });
const QUAKE_S = over(CROUCH, { y: -0.42, hy: 0, sy: 0, sx: 0.95, hd: 0.3, lsx: -1.1, lsz: 0.05, lex: -0.3, rsx: -1.1, rsz: -0.05, rex: -0.3 });
const SHADOW_W = over(CROUCH, { y: -0.45, sx: 0.6, lsx: 0.6, rsx: 0.6, lsz: 0.4, rsz: -0.4, lex: -0.3, rex: -0.3 });
const SHADOW_S = over(STANCE, { rsx: -1.55, rsz: 0.1, rex: -0.05, lsx: -0.3, lsz: 0.5, lex: -1.2, sy: 0.8, hy: -0.1, y: -0.1, lhx: -0.6, lkx: 0.7 });
const CHARGE_S = over(STANCE, { y: -0.12, sx: 0.55, hy: 0.6, sy: 0.4, hd: 0.2, lsx: -0.5, lsz: 0.3, lex: -2.2, rsx: -0.3, rsz: -0.2, rex: -2.0, lhx: -0.7, lkx: 0.9, rhx: 0.5, rkx: 0.3 });
const LOTUS_W = over(STANCE, { hy: -0.1, sy: -0.3, lsx: 0.3, lsz: 0.2, lex: -1.9, rsx: 0.3, rsz: -0.2, rex: -1.9, y: -0.1 });
const LOTUS_S = over(STANCE, { hy: -0.1, sy: 0.1, sx: 0.1, lsx: -1.5, lsz: -0.12, lex: -0.1, rsx: -1.5, rsz: 0.12, rex: -0.1, y: -0.14, lhx: -0.6, lkx: 0.7 });

Object.assign(ATTACKS, {
  sp_dragon: {
    special: true, s: 5, a: 8, r: 26, dmg: 24, level: 'mid', reach: 1.0, width: 0.55, bs: 18, push: 0.05,
    knockdown: true, launch: 0.17, heavy: true, move: [0, 6, 0.035], W: DRAGON_W, S: DRAGON_S,
  },
  sp_storm: {
    special: true, s: 8, a: 16, r: 22, dmg: 9, level: 'mid', reach: 1.15, width: 0.5, hs: 20, bs: 10, push: 0.04,
    hits: [[8, 11], [14, 17], [20, 24]], knockdownLast: true, heavy: true, move: [4, 24, 0.05],
    keys: [[0, STANCE], [6, STORM_W], [9, STORM_K1], [12, STORM_W], [15, STORM_K2], [18, STORM_W], [21, STORM_K3], [24, STORM_K3], [40, STANCE]],
  },
  sp_quake: {
    special: true, s: 22, a: 6, r: 26, dmg: 26, level: 'low', reach: 2.4, width: 1.2, bs: 16, push: 0.08,
    knockdown: true, heavy: true, slamAt: 22, W: QUAKE_W, S: QUAKE_S,
  },
  sp_shadow: {
    special: true, s: 13, a: 5, r: 20, dmg: 20, level: 'mid', reach: 1.05, width: 0.6, bs: 14, push: 0.07,
    knockdown: true, heavy: true, teleport: 9,
    keys: [[0, STANCE], [6, SHADOW_W], [10, SHADOW_W], [13, SHADOW_S], [18, SHADOW_S], [32, STANCE]],
  },
  sp_charge: {
    special: true, s: 10, a: 20, r: 22, dmg: 18, level: 'mid', reach: 0.95, width: 0.6, bs: 16, push: 0.34,
    knockdown: true, heavy: true, move: [10, 30, 0.11], stopOnHit: true,
    keys: [[0, STANCE], [8, over(CHARGE_S, { y: -0.2, sx: 0.7 })], [12, CHARGE_S], [30, CHARGE_S], [44, STANCE]],
  },
  sp_lotus: {
    special: true, s: 14, a: 0, r: 24, dmg: 18, level: 'mid', reach: 0, width: 0, hs: 22, bs: 14, push: 0.12,
    projectile: { at: 14, speed: 0.17, life: 55 },
    keys: [[0, STANCE], [8, LOTUS_W], [13, LOTUS_W], [15, LOTUS_S], [26, LOTUS_S], [38, STANCE]],
  },
});

const GRAB = over(STANCE, { lsx: -1.45, lex: -0.4, rsx: -1.45, rex: -0.4, lsz: -0.25, rsz: 0.25, sy: 0, hy: 0 });
export const THROW_KEYS = [
  [0, STANCE],
  [6, GRAB],
  [14, over(GRAB, { y: -0.15, sx: 0.2 })],
  [28, over(GRAB, { hy: 1.6, sx: -0.35, lsx: -2.6, rsx: -2.6, lex: -0.2, rex: -0.2 })],
  [40, over(STANCE, { hy: 2.2, sy: 0.2, sx: 0.4, y: -0.12 })],
  [50, over(STANCE, { hy: 2.4 })],
];
