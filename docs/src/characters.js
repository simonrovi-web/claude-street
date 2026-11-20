// Plantilla de luchadores (personajes originales) y construcción de sus modelos 3D.
// Todos comparten el mismo esqueleto (las poses de poses.js valen para todos);
// cambian la complexión, la ropa, los accesorios y los atributos de combate.
import * as THREE from 'three';
import { toonMat, addOutlines } from './toon.js';

// stats: power = daño, speed = velocidad al moverse, weight = resistencia al empuje
export const ROSTER = [
  {
    id: 'kaito', eyes: 0x7a4a1a, 
    style: {
      idle: 'steady',
      stance: {},
      intro: { hy: 0, sy: 0, y: 0, sx: 0.05, lsx: -1.25, lsz: -0.45, lex: -1.75, rsx: -1.25, rsz: 0.45, rex: -1.75, lhx: -0.15, rhx: 0.15, lkx: 0.1, rkx: 0.1 },
      victory: { hy: 0, sy: 0, y: 0, sx: 0.85, hd: 0.35, lsx: 0.1, lsz: 0.08, lex: -0.15, rsx: 0.1, rsz: -0.08, rex: -0.15, lhx: 0, rhx: 0, lkx: 0.05, rkx: 0.05, lhz: 0.04, rhz: -0.04 },
    },
    special: { move: 'sp_dragon', name: 'Puño del Dragón', desc: 'Gancho ascendente que lanza al rival por los aires' }, name: 'KAITO', title: 'El Puño Carmesí', origin: 'Karate tradicional',
    stats: { power: 1.0, speed: 1.0, weight: 1.0 },
    build: { g: 1.0, m: 0.7, scale: 1.0 }, skin: 0xd29a72,
    look: { top: 'gi', topColor: 0xe0281e, trim: 0x2a1418, pants: 0xc4221a, belt: 0x111111,
      hands: 'wraps', handColor: 0xe6dccb, feet: 'bare', hair: 'spiky', hairColor: 0x1c2340, accent: 0x111111,
      extras: ['headband', 'scar'] },
    alt: { topColor: 0xeee8dc, pants: 0xe2dccf, trim: 0x7a1510, accent: 0x9e1b15 },
  },
  {
    id: 'rina', eyes: 0x2f9a52, 
    style: {
      idle: 'bounce',
      stance: { y: -0.04, sx: 0.1, lsx: -1.3, lex: -2.1, rsx: -1.1, rex: -2.3 },
      intro: { hy: -0.2, y: -0.02, lsx: -1.6, lex: -0.1, lsz: 0.1, rsx: -1.0, rex: -2.3, sy: -0.2 },
      victory: null,
    },
    special: { move: 'sp_storm', name: 'Tormenta', desc: 'Avanza con tres patadas seguidas; la última derriba' }, name: 'RINA', title: 'Tormenta Azul', origin: 'Kickboxing callejero', female: true,
    stats: { power: 0.9, speed: 1.15, weight: 0.88 },
    build: { g: 0.86, m: 0.45, scale: 0.97 }, skin: 0xe9b995,
    look: { top: 'vest', topColor: 0x2f7bff, trim: 0xd8dde6, pants: 0x22408f, belt: 0xd8dde6,
      hands: 'gloves', handColor: 0xd8dde6, feet: 'boots', footColor: 0x20283a, hair: 'ponytail', hairColor: 0xa03c16,
      extras: ['armbands', 'kneepads'], accent: 0xd8dde6 },
    alt: { topColor: 0xc8901a, pants: 0x2e2210, trim: 0x1a1a1a, belt: 0x1a1a1a, handColor: 0x1a1a1a, accent: 0x1a1a1a },
  },
  {
    id: 'voss', eyes: 0x3d6aa8, 
    style: {
      idle: 'heavy',
      stance: { y: -0.12, sx: 0.12, lhz: 0.14, rhz: -0.14, lhx: -0.25, rhx: 0.2, lsx: -0.8, lsz: 0.3, lex: -1.5, rsx: -0.6, rsz: -0.35, rex: -1.7 },
      intro: { hy: 0, sy: 0, y: -0.08, sx: 0.2, lsx: -1.3, lsz: -0.35, lex: -1.6, rsx: -1.3, rsz: 0.35, rex: -1.6, lhz: 0.14, rhz: -0.14 },
      victory: { hy: 0, sy: 0, y: 0, sx: -0.08, hd: -0.2, lsx: -0.3, lsz: 1.4, lex: -2.1, rsx: -0.3, rsz: -1.4, rex: -2.1, lhz: 0.13, rhz: -0.13, lhx: 0, rhx: 0, lkx: 0.08, rkx: 0.08 },
    },
    special: { move: 'sp_quake', name: 'Martillo Sísmico', desc: 'Golpe al suelo con onda expansiva baja y de largo alcance' }, name: 'VOSS', title: 'El Martillo de Hierro', origin: 'Gladiador de las fosas',
    stats: { power: 1.25, speed: 0.85, weight: 1.35 },
    build: { g: 1.3, m: 1.0, scale: 1.07 }, skin: 0xc28766,
    look: { top: 'armor', topColor: 0x7a4422, pants: 0x3e3028, belt: 0x8a5a2a, metal: 0x8d9bb0,
      hands: 'gauntlets', feet: 'boots', footColor: 0x2a1a10, hair: 'bald', hairColor: 0xc0621c,
      extras: ['beard', 'pauldrons', 'bracers', 'greaves', 'scar'] },
    alt: { metal: 0xa8833a, topColor: 0x4a1612, pants: 0x1e1612 },
  },
  {
    id: 'nyx', eyes: 0x38e6d2, 
    style: {
      idle: 'sway',
      stance: { y: -0.16, sx: 0.28, lsx: -1.0, lex: -1.0, lsz: 0.2, rsx: -0.4, rex: -1.5, rsz: -0.3, lhx: -0.5, lkx: 0.8, rhx: 0.4, rkx: 0.6 },
      intro: { y: -0.42, sx: 0.55, hd: 0.2, lsx: 0.4, rsx: 0.4, lsz: 0.4, rsz: -0.4, lex: -0.4, rex: -0.4, lhx: -1.05, lkx: 1.8, rhx: -0.7, rkx: 1.7 },
      victory: { hy: 0, sy: 0, y: 0, sx: 0, hd: 0.15, lsx: -1.25, lsz: -0.55, lex: -1.9, rsx: -1.15, rsz: 0.55, rex: -1.9, lhx: 0, rhx: 0, lkx: 0.02, rkx: 0.02 },
    },
    special: { move: 'sp_shadow', name: 'Paso Sombra', desc: 'Desaparece y ataca por la espalda' }, name: 'NYX', title: 'Sombra sin Rostro', origin: 'Hermandad de la Ceniza',
    stats: { power: 0.95, speed: 1.2, weight: 0.9 },
    build: { g: 0.92, m: 0.55, scale: 1.0 }, skin: 0xa9806a,
    look: { top: 'wraps', topColor: 0x3a2260, trim: 0xb453ff, pants: 0x2a1a44, belt: 0xb453ff, metal: 0x5d646d,
      hands: 'wraps', handColor: 0x3a2a55, feet: 'wraps', footColor: 0x3a2a55, hair: 'none',
      extras: ['hood', 'mask', 'glowEyes', 'tabard', 'bracers'], glow: 0x38e6d2 },
    alt: { topColor: 0x262626, trim: 0x8e1414, belt: 0x8e1414, glow: 0xff5030 },
  },
  {
    id: 'torak', eyes: 0xd09a20, 
    style: {
      idle: 'heavy',
      stance: { y: -0.1, sx: 0.18, lsx: -0.9, lsz: 0.35, rsx: -0.7, rsz: -0.35 },
      intro: { hy: 0, sy: 0, sx: -0.1, hd: -0.2, lsx: -1.0, lsz: -0.2, lex: -2.4, rsx: -1.0, rsz: 0.2, rex: -2.4 },
      victory: { hy: 0, sy: 0, y: 0, sx: -0.25, hd: -0.5, lsx: -2.6, lsz: 0.7, lex: -0.6, rsx: -2.6, rsz: -0.7, rex: -0.6, lhz: 0.12, rhz: -0.12, lhx: 0, rhx: 0, lkx: 0.1, rkx: 0.1 },
    },
    special: { move: 'sp_charge', name: 'Embestida', desc: 'Carga con el hombro que arrastra al rival hacia el borde' }, name: 'TORAK', title: 'Furia de las Montañas', origin: 'Guerrero tribal',
    stats: { power: 1.15, speed: 1.0, weight: 1.15 },
    build: { g: 1.16, m: 1.0, scale: 1.04 }, skin: 0xb07048,
    look: { top: 'bare', pants: 0x3e2818, belt: 0x22160c, hands: 'wraps', handColor: 0x8a7858,
      feet: 'wraps', footColor: 0x5e4e36, hair: 'mohawk', hairColor: 0xff5a1a,
      extras: ['warpaint', 'necklace', 'loincloth', 'armbands'], paint: 0xff2d3d, fur: 0x8a5a30, accent: 0xb08a4a },
    alt: { paint: 0x1f6fd0, pants: 0x283624, fur: 0x9a9a92 },
  },
  {
    id: 'sera', eyes: 0x7a42c0, 
    style: {
      idle: 'flow',
      stance: { y: -0.08, sx: 0.05, lsx: -1.2, lex: -1.1, rsx: -0.6, rex: -1.6 },
      intro: { hy: 0, sy: 0, y: 0, lhx: -1.3, lkx: 1.9, rhx: 0, rkx: 0.05, lsx: -2.6, lsz: 0.5, lex: -0.5, rsx: -1.4, rsz: -0.2, rex: -0.2 },
      victory: { hy: 0, sy: 0, y: 0, sx: 0.15, hd: 0.2, lsx: -1.0, lsz: -0.35, lex: -2.0, rsx: -1.0, rsz: 0.35, rex: -2.0, lhx: 0, rhx: 0, lkx: 0.02, rkx: 0.02 },
    },
    special: { move: 'sp_lotus', name: 'Palma del Loto', desc: 'Lanza una esfera de energía a distancia' }, name: 'SERA', title: 'Loto Dorado', origin: 'Monasterio de la Cumbre', female: true,
    stats: { power: 1.0, speed: 1.08, weight: 0.95 },
    build: { g: 0.88, m: 0.4, scale: 0.98 }, skin: 0xdfa983,
    look: { top: 'robe', topColor: 0xfff7ea, trim: 0xffb21e, pants: 0xf0e4cf, belt: 0xffb21e,
      hands: 'wraps', handColor: 0xe9e1d0, feet: 'sandals', footColor: 0x5a3a1c, hair: 'bun', hairColor: 0x2b1b4a,
      extras: ['tabard', 'armbands'], accent: 0xc99a1e },
    alt: { topColor: 0x24242c, pants: 0x1c1c22, handColor: 0x24242c },
  },
];

const V2 = (x, y) => new THREE.Vector2(x, y);

// Extremidad con perfil muscular (torneada alrededor del eje Y, hacia abajo desde la articulación).
function limbGeo(len, r0, rMax, r1, peak = 0.35, segs = 14) {
  const pts = [V2(0.0001, r0 * 0.55), V2(r0 * 0.78, r0 * 0.38)];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const base = r0 + (r1 - r0) * t;
    const b = Math.exp(-(((t - peak) / 0.3) ** 2));
    pts.push(V2(base + (rMax - base) * b, -t * len));
  }
  pts.push(V2(r1 * 0.78, -len - r1 * 0.38), V2(0.0001, -len - r1 * 0.55));
  pts.reverse(); // LatheGeometry espera y creciente para que las normales miren hacia fuera
  return new THREE.LatheGeometry(pts, segs);
}

export function buildModel(def, alt = false) {
  const L = { ...def.look, ...(alt ? def.alt : {}) };
  const ex = new Set(L.extras || []);
  const g = def.build.g, m = def.build.m, fem = !!def.female;
  const sw = fem ? 0.88 : 1;          // anchura de hombros
  const heavy = g > 1.1;

  const mats = [];
  const M = (color, rough = 0.7, metal = 0) => {
    // sombreado por bandas; el metal se aclara un poco para que siga leyéndose como metal
    const c = new THREE.Color(color);
    if (metal > 0.5) c.offsetHSL(0, 0.05, -0.02);
    const mt = toonMat(c);
    mats.push(mt);
    return mt;
  };
  const skin = M(def.skin, 0.52);
  const top = M(L.topColor ?? def.skin, 0.78);
  const trim = M(L.trim ?? 0xdddddd, 0.6);
  const pants = M(L.pants ?? 0x222222, 0.82);
  const belt = M(L.belt ?? 0x222222, 0.55);
  const metal = M(L.metal ?? 0x8a8f96, 0.32, 0.9);
  const hair = M(L.hairColor ?? 0x111111, 0.62);
  const accent = M(L.accent ?? 0x222222, 0.55);
  const paint = M(L.paint ?? 0xaa1111, 0.6);
  const fur = M(L.fur ?? 0x5a3a20, 0.95);
  const handM = L.hands === 'gauntlets' ? metal : L.hands === 'gloves' ? M(L.handColor, 0.42) : L.hands === 'wraps' ? M(L.handColor, 0.85) : skin;
  const footM = L.feet === 'bare' ? skin : M(L.footColor ?? 0x222222, 0.72);
  const dark = new THREE.MeshBasicMaterial({ color: 0x0c0806 });
  const glow = new THREE.MeshBasicMaterial({ color: L.glow ?? 0x40e0d0 });
  glow.color.multiplyScalar(4); // más allá de 1: brilla con el bloom

  const part = (geo, mt, parent, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, mt);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const joint = (parent, x = 0, y = 0, z = 0) => {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    parent.add(j);
    return j;
  };
  const sphere = (r, sx = 1, sy = 1, sz = 1, w = 14, h = 10) => {
    const s = new THREE.SphereGeometry(r, w, h);
    s.scale(sx, sy, sz);
    return s;
  };
  const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);

  const root = new THREE.Group();
  const tilt = joint(root);
  const hips = joint(tilt, 0, 0.99, 0);
  const spine = joint(hips, 0, 0.08, 0);

  // ---------------- pelvis
  part(sphere(1, 0.165 * g * (fem ? 1.1 : 1), 0.12, 0.12 * g), pants, hips, 0, -0.03, 0);

  // ---------------- torso
  const tp = [
    [0.0001, -0.03], [0.15 * g * (fem ? 1.02 : 1), -0.02], [0.138 * g * (fem ? 0.86 : 1), 0.12],
    [0.158 * g, 0.26], [0.19 * g * sw, 0.38], [0.2 * g * sw, 0.45], [0.15 * g * sw, 0.52], [0.068, 0.565], [0.0001, 0.575],
  ].map(([x, y]) => V2(x, y));
  const torsoGeo = new THREE.LatheGeometry(tp, 18);
  torsoGeo.scale(1, 1, 0.62);
  const bare = L.top === 'bare';
  const torsoM = bare ? skin : top;
  part(torsoGeo, torsoM, spine);
  const front = (r, y) => r * 0.62 * g; // profundidad aproximada del torso

  if (bare || L.top === 'vest') {
    // pectorales y abdominales marcados
    const pz = front(0.18, 0.38) * 0.78;
    if (!fem) {
      for (const s of [-1, 1]) part(sphere(0.085 * g, 1.05, 0.66, 0.42), bare ? skin : top, spine, s * 0.075 * g, 0.385, pz);
    }
    if (bare) {
      for (let r = 0; r < 3; r++) for (const s of [-1, 1]) {
        part(sphere(0.034 * g, 1, 0.82, 0.42, 8, 6), skin, spine, s * 0.034 * g, 0.1 + r * 0.075, front(0.15, 0) * 0.9);
      }
      // trapecios y dorsales
      part(sphere(0.12 * g, 1.2, 0.5, 0.6), skin, spine, 0, 0.5, -0.02);
      for (const s of [-1, 1]) part(sphere(0.07 * g, 0.7, 1.6, 0.6), skin, spine, s * 0.15 * g, 0.3, -0.03);
    }
  }
  if (L.top === 'gi' || L.top === 'robe') {
    // solapas cruzadas y escote
    const z = front(0.17, 0.3) * 1.0;
    part(box(0.05, 0.44, 0.014), trim, spine, 0.03, 0.3, z, -0.12, 0, 0.42);
    part(box(0.05, 0.44, 0.014), trim, spine, -0.03, 0.3, z + 0.004, -0.12, 0, -0.42);
    part(box(0.07, 0.12, 0.01), skin, spine, 0, 0.47, z - 0.022, -0.3, 0, 0);
    if (!fem && L.top === 'gi') for (const s of [-1, 1]) part(sphere(0.07 * g, 1, 0.6, 0.35), skin, spine, s * 0.06, 0.43, z - 0.03);
  }
  if (L.top === 'vest') {
    part(box(0.09, 0.16, 0.012), skin, spine, 0, 0.47, front(0.17, 0) * 0.98, -0.25, 0, 0);
    for (const s of [-1, 1]) part(box(0.035, 0.3, 0.012), trim, spine, s * 0.07, 0.36, front(0.18, 0) * 0.95, -0.1, 0, s * 0.12);
  }
  if (L.top === 'armor') {
    const plate = new THREE.CylinderGeometry(0.205 * g, 0.165 * g, 0.32, 18, 1, true, -1.25, 2.5);
    plate.scale(1, 1, 0.68);
    const pm = part(plate, metal, spine, 0, 0.33, 0.005);
    pm.material.side = THREE.DoubleSide;
    for (let i = 0; i < 3; i++) part(box(0.2 * g, 0.045, 0.02), metal, spine, 0, 0.1 + i * 0.055, front(0.15, 0) * 1.02);
    part(box(0.05, 0.6, 0.02), belt, spine, 0.07, 0.28, front(0.19, 0) * 1.06, 0, 0, -0.55);
  }
  if (L.top === 'wraps') {
    for (let i = 0; i < 4; i++) part(box(0.36 * g, 0.022, 0.012), trim, spine, 0, 0.1 + i * 0.1, front(0.16 + i * 0.012, 0) * 1.01, 0, 0, (i % 2 ? 1 : -1) * 0.18);
    part(sphere(0.1 * g, 1.1, 0.7, 1), metal, spine, 0.17 * g, 0.49, 0); // hombrera de un lado
  }
  if (L.top === 'robe') {
    part(box(0.33 * g, 0.07, 0.25 * g), belt, spine, 0, 0.03, 0); // fajín
  }
  // cinturón
  const beltGeo = new THREE.CylinderGeometry(0.153 * g, 0.153 * g, 0.065, 18);
  beltGeo.scale(1, 1, 0.66);
  part(beltGeo, belt, spine, 0, 0.015, 0);
  if (L.top === 'gi') { // nudo y puntas
    part(box(0.07, 0.05, 0.03), belt, spine, 0, 0.015, front(0.15, 0) + 0.01);
    part(box(0.03, 0.17, 0.01), belt, spine, 0.025, -0.07, front(0.15, 0) + 0.015, 0, 0, 0.12);
    part(box(0.03, 0.15, 0.01), belt, spine, -0.025, -0.06, front(0.15, 0) + 0.015, 0, 0, -0.18);
  }
  if (ex.has('necklace')) {
    const n = part(new THREE.TorusGeometry(0.1 * g, 0.012, 6, 24), accent, spine, 0, 0.5, 0.01, Math.PI / 2 - 0.35, 0, 0);
    n.scale.set(1, 0.75, 1);
    for (let i = -2; i <= 2; i++) part(new THREE.ConeGeometry(0.012, 0.05, 5), M(0xe8e0c8, 0.5), spine, i * 0.03, 0.45 - Math.abs(i) * 0.006, front(0.19, 0) * 0.98 - Math.abs(i) * 0.008, Math.PI, 0, 0);
  }
  if (ex.has('warpaint') && bare) {
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      part(box(0.11 * g, 0.012, 0.01), paint, spine, s * 0.075 * g, 0.36 + i * 0.03, front(0.19, 0) * 0.98, 0, 0, s * 0.15);
    }
  }

  // ---------------- cuello y cabeza
  const neck = joint(spine, 0, 0.52, 0);
  part(new THREE.CylinderGeometry(0.052 * (heavy ? 1.3 : 1), 0.062 * (heavy ? 1.3 : 1), 0.11, 12), ex.has('hood') ? top : skin, neck, 0, 0.03, 0);
  const head = joint(neck, 0, 0.1, 0);
  head.scale.setScalar(1.13);
  const faceM = skin;
  part(sphere(0.116, 0.9, 1.04, 1.0, 18, 14), faceM, head, 0, 0.082, 0);
  part(sphere(1, 0.072 * (heavy ? 1.15 : 1), 0.05, 0.075), faceM, head, 0, 0.02, 0.03); // mandíbula
  part(new THREE.ConeGeometry(0.019, 0.045, 6), faceM, head, 0, 0.07, 0.118, Math.PI / 2, 0, 0); // nariz
  part(box(0.12, 0.016, 0.03), faceM, head, 0, 0.107, 0.093, 0.25, 0, 0); // arco de las cejas
  for (const s of [-1, 1]) part(sphere(0.026, 0.5, 1, 0.8, 8, 6), faceM, head, s * 0.103, 0.075, 0.005); // orejas
  const face = (geo, mt, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = part(geo, mt, head, x, y, z, rx, ry, rz);
    m.castShadow = false;
    m.userData.noOutline = true;
    return m;
  };
  if (ex.has('glowEyes')) {
    for (const s of [-1, 1]) face(sphere(0.018, 1.5, 0.6, 0.6, 10, 6), glow, s * 0.041, 0.088, 0.106);
  } else {
    const white = new THREE.MeshBasicMaterial({ color: 0xfafafa });
    const iris = new THREE.MeshBasicMaterial({ color: def.eyes ?? 0x6a4a2a });
    for (const s of [-1, 1]) {
      face(sphere(0.024, 1.0, 1.25, 0.45, 12, 8), white, s * 0.041, 0.086, 0.103);  // blanco del ojo
      face(sphere(0.015, 1.0, 1.25, 0.4, 10, 8), iris, s * 0.04, 0.085, 0.111);     // iris
      face(sphere(0.008, 1, 1.2, 0.4, 8, 6), dark, s * 0.04, 0.085, 0.115);         // pupila
      face(sphere(0.0045, 1, 1, 0.5, 6, 4), white, s * 0.04 + 0.005, 0.093, 0.118); // brillo
      // cejas con gesto decidido
      face(box(0.045, 0.011, 0.012), hair, s * 0.043, 0.118, 0.106, 0, 0, s * -0.28);
    }
  }
  face(box(0.032, 0.007, 0.006), M(0x5a2220, 0.6), 0, 0.034, 0.112); // boca
  if (ex.has('scar')) part(box(0.006, 0.05, 0.006), M(0x8a4a3a, 0.6), head, 0.045, 0.1, 0.103, 0, 0, 0.3);

  // pelo
  const cap = (sc = 1) => {
    // casquete inclinado: cubre la nuca pero deja libre la frente y los ojos
    const c = new THREE.SphereGeometry(0.122 * sc, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
    c.rotateX(-0.38);
    return c;
  };
  switch (L.hair) {
    case 'spiky':
      part(cap(1.04), hair, head, 0, 0.09, -0.008);
      // mechones grandes en punta, hacia arriba y hacia atrás
      for (let i = 0; i < 9; i++) {
        const a = (i - 4) / 4;
        part(new THREE.ConeGeometry(0.048, 0.2, 6), hair, head, a * 0.11, 0.2 - Math.abs(a) * 0.03, -0.02 - Math.abs(a) * 0.03, -0.75 + Math.abs(a) * 0.2, 0, a * -0.7);
      }
      for (let i = 0; i < 3; i++) part(new THREE.ConeGeometry(0.035, 0.12, 5), hair, head, (i - 1) * 0.05, 0.16, 0.08, 0.9, 0, (i - 1) * -0.4); // flequillo
      break;
    case 'ponytail': {
      part(cap(1.05), hair, head, 0, 0.088, -0.005);
      const tail = part(new THREE.CapsuleGeometry(0.042, 0.26, 4, 8), hair, head, 0, 0.03, -0.17, 0.45, 0, 0);
      tail.scale.set(1, 1, 0.8);
      part(new THREE.TorusGeometry(0.03, 0.012, 6, 12), accent, head, 0, 0.135, -0.115, 0.9, 0, 0);
      break;
    }
    case 'mohawk':
      part(cap(1.01), M(0x2a1e16, 0.9), head, 0, 0.085, 0); // cabeza rapada
      for (let i = 0; i < 8; i++) {
        part(box(0.03, 0.09 + Math.sin(i / 7 * Math.PI) * 0.05, 0.035), hair, head, 0, 0.2 + Math.sin(i / 7 * Math.PI) * 0.03, 0.09 - i * 0.03, -0.3 + i * 0.12, 0, 0);
      }
      break;
    case 'bun':
      part(cap(1.03), hair, head, 0, 0.088, -0.006);
      part(sphere(0.055), hair, head, 0, 0.19, -0.07);
      part(new THREE.TorusGeometry(0.035, 0.008, 6, 14), accent, head, 0, 0.18, -0.06, 0.6, 0, 0);
      break;
    default: break; // calvo o cubierto
  }
  if (ex.has('beard')) {
    part(new THREE.SphereGeometry(0.088, 14, 8, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.5), hair, head, 0, 0.055, 0.025);
    part(box(0.07, 0.016, 0.02), hair, head, 0, 0.045, 0.108); // bigote
  }
  if (ex.has('headband')) {
    part(new THREE.TorusGeometry(0.121, 0.016, 6, 22), accent, head, 0, 0.13, -0.005, Math.PI / 2 - 0.2, 0, 0);
    part(box(0.03, 0.16, 0.008), accent, head, 0.03, 0.05, -0.13, 0.4, 0, 0.25);
    part(box(0.03, 0.14, 0.008), accent, head, -0.025, 0.06, -0.13, 0.5, 0, -0.2);
  }
  if (ex.has('hood')) {
    const hood = new THREE.SphereGeometry(0.148, 18, 12, Math.PI * 0.85, Math.PI * 1.3, 0, Math.PI * 0.72);
    const hm = part(hood, top, head, 0, 0.09, -0.012, -0.12, 0, 0);
    hm.material = hm.material.clone(); mats.push(hm.material); hm.material.side = THREE.DoubleSide;
    part(new THREE.ConeGeometry(0.16, 0.3, 14, 1, true), hm.material, neck, 0, -0.02, -0.06, 0.25, 0, 0); // capa sobre los hombros
  }
  if (ex.has('mask')) {
    const mk = new THREE.CylinderGeometry(0.108, 0.098, 0.085, 18, 1, true, -1.45, 2.9);
    const mm = part(mk, metal, head, 0, 0.035, 0.008);
    mm.material = metal.clone(); mats.push(mm.material); mm.material.side = THREE.DoubleSide;
    for (let i = -1; i <= 1; i++) part(box(0.005, 0.06, 0.006), dark, head, i * 0.03, 0.035, 0.112);
  }

  // ---------------- brazos
  const armUpperM = (L.top === 'gi' || L.top === 'robe') ? top : skin;
  const sleeve = (L.top === 'gi' || L.top === 'robe') ? 1.28 : 1;
  const arm = (side) => {
    const sh = joint(spine, side * (0.17 * g * sw + 0.07), 0.46, 0);
    part(sphere(0.074 * g * (bare ? 1.08 : 1), 1, 0.9, 1), L.top === 'armor' || L.top === 'vest' || bare || L.top === 'wraps' ? skin : armUpperM, sh); // deltoide
    part(limbGeo(0.29, 0.064 * g * sleeve, 0.074 * g * (1 + 0.28 * m) * (sleeve > 1 ? 1.15 : 1), 0.05 * g * sleeve, 0.42), armUpperM, sh, 0, -0.01, 0);
    if (ex.has('pauldrons')) {
      const pd = part(new THREE.SphereGeometry(0.125 * g, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal, sh, side * 0.015, 0.03, 0, 0, 0, side * -0.4);
      pd.scale.set(1.12, 0.72, 1.05);
      const pd2 = part(new THREE.SphereGeometry(0.11 * g, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), metal, sh, side * 0.03, -0.035, 0, 0, 0, side * -0.55);
      pd2.scale.set(1.12, 0.6, 1.02);
      part(new THREE.ConeGeometry(0.025, 0.07, 6), metal, sh, side * 0.04, 0.115, 0, 0, 0, side * -0.4);
    }
    if (ex.has('armbands')) part(new THREE.TorusGeometry(0.07 * g, 0.012, 6, 16), accent, sh, 0, -0.08, 0, Math.PI / 2, 0, 0);
    const el = joint(sh, 0, -0.29, 0);
    part(limbGeo(0.25, 0.054 * g, 0.061 * g * (1 + 0.22 * m), 0.039 * g, 0.22), skin, el);
    if (ex.has('bracers')) part(new THREE.CylinderGeometry(0.058 * g, 0.05 * g, 0.15, 12), metal, el, 0, -0.17, 0);
    else if (L.hands === 'wraps') part(new THREE.CylinderGeometry(0.047 * g, 0.043 * g, 0.1, 12), handM, el, 0, -0.2, 0);
    else if (L.hands === 'gloves') part(new THREE.CylinderGeometry(0.055 * g, 0.05 * g, 0.06, 12), handM, el, 0, -0.23, 0);
    // puño
    const fs = L.hands === 'gloves' ? 1.25 : L.hands === 'gauntlets' ? 1.18 : 1;
    const k = Math.sqrt(g) * fs;
    part(sphere(0.05 * k, 1.0, 1.05, 1.1, 14, 10), handM, el, 0, -0.29, 0.008);
    part(new THREE.CylinderGeometry(0.03 * k, 0.03 * k, 0.085 * k, 8), handM, el, 0, -0.33 * (fs > 1 ? 1.02 : 1), 0.025, 0, 0, Math.PI / 2); // nudillos
    part(sphere(0.02 * k, 1, 1.4, 1, 6, 6), handM, el, side * -0.035 * k, -0.28, 0.04); // pulgar
    return [sh, el, joint(el, 0, -0.3, 0.02)]; // el último: punto del puño (para las estelas)
  };
  const [lSh, lEl, lFist] = arm(1);
  const [rSh, rEl, rFist] = arm(-1);

  // ---------------- piernas
  const wide = (L.top === 'gi' || L.top === 'robe') ? 1.18 : 1;
  const leg = (side) => {
    const hp = joint(hips, side * 0.095 * g * (fem ? 1.08 : 1), -0.05, 0);
    part(limbGeo(0.45, 0.098 * g * wide, 0.104 * g * (1 + 0.12 * m) * wide, 0.062 * g * wide, 0.25), pants, hp);
    const kn = joint(hp, 0, -0.45, 0);
    part(limbGeo(0.42, 0.064 * g * wide, 0.071 * g * (1 + 0.18 * m) * wide, 0.044 * g * wide, 0.3), pants, kn);
    if (ex.has('kneepads')) part(sphere(0.06 * g, 1, 1, 0.7), accent, kn, 0, -0.02, 0.05);
    if (ex.has('greaves')) {
      const gv = new THREE.CylinderGeometry(0.07 * g, 0.055 * g, 0.3, 12, 1, true, -1.3, 2.6);
      const gm = part(gv, metal, kn, 0, -0.22, 0.008);
      gm.material = metal.clone(); mats.push(gm.material); gm.material.side = THREE.DoubleSide;
    }
    // pies
    if (L.feet === 'boots') {
      part(new THREE.CylinderGeometry(0.068 * g, 0.062 * g, 0.2, 12), footM, kn, 0, -0.34, 0);
      part(box(0.11 * Math.sqrt(g), 0.095, 0.23), footM, kn, 0, -0.44, 0.04);
    } else {
      const fm = L.feet === 'bare' || L.feet === 'sandals' ? skin : footM;
      part(box(0.09 * Math.sqrt(g), 0.07, 0.21), fm, kn, 0, -0.45, 0.045);
      part(sphere(0.045, 1, 0.7, 1), fm, kn, 0, -0.455, 0.13);
      if (L.feet === 'wraps') part(new THREE.CylinderGeometry(0.05 * g, 0.05 * g, 0.1, 10), footM, kn, 0, -0.38, 0);
      if (L.feet === 'sandals') {
        part(box(0.1, 0.02, 0.24), footM, kn, 0, -0.485, 0.05);
        part(box(0.1, 0.012, 0.02), footM, kn, 0, -0.43, 0.06);
      }
    }
    return [hp, kn, joint(kn, 0, -0.45, 0.1)];
  };
  const [lHip, lKn, lFoot] = leg(1);
  const [rHip, rKn, rFoot] = leg(-1);

  // ---------------- telas que cuelgan de la cintura
  const cloth = [];
  if (ex.has('loincloth') || ex.has('tabard')) {
    const cm = ex.has('loincloth') ? fur : trim;
    const len = ex.has('tabard') ? 0.42 : 0.32;
    for (const s of [1, -1]) {
      const pivot = joint(hips, 0, 0.0, s * 0.115 * g);
      part(box(0.19 * g, len, 0.014), cm, pivot, 0, -len / 2, 0);
      if (ex.has('tabard')) part(box(0.19 * g, 0.03, 0.016), belt, pivot, 0, -len + 0.02, 0);
      cloth.push({ pivot, side: s });
    }
  }

  addOutlines(root, 0.011 * Math.max(1, g * 0.95));
  return { root, tilt, hips, spine, head, lSh, lEl, rSh, rEl, lHip, lKn, rHip, rKn, mats, cloth, lFist, rFist, lFoot, rFoot };
}
