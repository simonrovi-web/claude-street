// Plantilla de luchadores (personajes originales) y construcción de sus modelos 3D.
// Todos comparten el mismo esqueleto (las poses de poses.js valen para todos);
// cambian la complexión, la ropa, los accesorios y los atributos de combate.
import * as THREE from 'three';

// stats: power = daño, speed = velocidad al moverse, weight = resistencia al empuje
export const ROSTER = [
  {
    id: 'kaito', name: 'KAITO', title: 'El Puño Carmesí', origin: 'Karate tradicional',
    stats: { power: 1.0, speed: 1.0, weight: 1.0 },
    build: { g: 1.0, m: 0.7, scale: 1.0 }, skin: 0xd29a72,
    look: { top: 'gi', topColor: 0x9e1b15, trim: 0x1a1210, pants: 0x8c1812, belt: 0x111111,
      hands: 'wraps', handColor: 0xe6dccb, feet: 'bare', hair: 'spiky', hairColor: 0x15100c, accent: 0x111111,
      extras: ['headband', 'scar'] },
    alt: { topColor: 0xeee8dc, pants: 0xe2dccf, trim: 0x7a1510, accent: 0x9e1b15 },
  },
  {
    id: 'rina', name: 'RINA', title: 'Tormenta Azul', origin: 'Kickboxing callejero', female: true,
    stats: { power: 0.9, speed: 1.15, weight: 0.88 },
    build: { g: 0.86, m: 0.45, scale: 0.97 }, skin: 0xe9b995,
    look: { top: 'vest', topColor: 0x1f4fb8, trim: 0xd8dde6, pants: 0x14234f, belt: 0xd8dde6,
      hands: 'gloves', handColor: 0xd8dde6, feet: 'boots', footColor: 0x20283a, hair: 'ponytail', hairColor: 0x3d1d0e,
      extras: ['armbands', 'kneepads'], accent: 0xd8dde6 },
    alt: { topColor: 0xc8901a, pants: 0x2e2210, trim: 0x1a1a1a, belt: 0x1a1a1a, handColor: 0x1a1a1a, accent: 0x1a1a1a },
  },
  {
    id: 'voss', name: 'VOSS', title: 'El Martillo de Hierro', origin: 'Gladiador de las fosas',
    stats: { power: 1.25, speed: 0.85, weight: 1.35 },
    build: { g: 1.3, m: 1.0, scale: 1.07 }, skin: 0xc28766,
    look: { top: 'armor', topColor: 0x3b2618, pants: 0x2a221c, belt: 0x4e3018, metal: 0x7d838b,
      hands: 'gauntlets', feet: 'boots', footColor: 0x2a1a10, hair: 'bald', hairColor: 0x4a2a14,
      extras: ['beard', 'pauldrons', 'bracers', 'greaves', 'scar'] },
    alt: { metal: 0xa8833a, topColor: 0x4a1612, pants: 0x1e1612 },
  },
  {
    id: 'nyx', name: 'NYX', title: 'Sombra sin Rostro', origin: 'Hermandad de la Ceniza',
    stats: { power: 0.95, speed: 1.2, weight: 0.9 },
    build: { g: 0.92, m: 0.55, scale: 1.0 }, skin: 0xa9806a,
    look: { top: 'wraps', topColor: 0x1d1622, trim: 0x5d2a78, pants: 0x18121e, belt: 0x5d2a78, metal: 0x5d646d,
      hands: 'wraps', handColor: 0x2a2030, feet: 'wraps', footColor: 0x2a2030, hair: 'none',
      extras: ['hood', 'mask', 'glowEyes', 'tabard', 'bracers'], glow: 0x38e6d2 },
    alt: { topColor: 0x262626, trim: 0x8e1414, belt: 0x8e1414, glow: 0xff5030 },
  },
  {
    id: 'torak', name: 'TORAK', title: 'Furia de las Montañas', origin: 'Guerrero tribal',
    stats: { power: 1.15, speed: 1.0, weight: 1.15 },
    build: { g: 1.16, m: 1.0, scale: 1.04 }, skin: 0x8e5a3c,
    look: { top: 'bare', pants: 0x3e2818, belt: 0x22160c, hands: 'wraps', handColor: 0x8a7858,
      feet: 'wraps', footColor: 0x5e4e36, hair: 'mohawk', hairColor: 0x0e0e0e,
      extras: ['warpaint', 'necklace', 'loincloth', 'armbands'], paint: 0xb3140f, fur: 0x5e4024, accent: 0xb08a4a },
    alt: { paint: 0x1f6fd0, pants: 0x283624, fur: 0x9a9a92 },
  },
  {
    id: 'sera', name: 'SERA', title: 'Loto Dorado', origin: 'Monasterio de la Cumbre', female: true,
    stats: { power: 1.0, speed: 1.08, weight: 0.95 },
    build: { g: 0.88, m: 0.4, scale: 0.98 }, skin: 0xdfa983,
    look: { top: 'robe', topColor: 0xe9e1d0, trim: 0xc99a1e, pants: 0xd2c9b6, belt: 0xc99a1e,
      hands: 'wraps', handColor: 0xe9e1d0, feet: 'sandals', footColor: 0x5a3a1c, hair: 'bun', hairColor: 0x101010,
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
    const mt = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
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
  const faceM = skin;
  part(sphere(0.116, 0.9, 1.04, 1.0, 18, 14), faceM, head, 0, 0.082, 0);
  part(sphere(1, 0.072 * (heavy ? 1.15 : 1), 0.05, 0.075), faceM, head, 0, 0.02, 0.03); // mandíbula
  part(new THREE.ConeGeometry(0.019, 0.045, 6), faceM, head, 0, 0.07, 0.118, Math.PI / 2, 0, 0); // nariz
  part(box(0.13, 0.022, 0.035), faceM, head, 0, 0.107, 0.093, 0.25, 0, 0); // ceja
  for (const s of [-1, 1]) part(sphere(0.026, 0.5, 1, 0.8, 8, 6), faceM, head, s * 0.103, 0.075, 0.005); // orejas
  const eyeM = ex.has('glowEyes') ? glow : dark;
  for (const s of [-1, 1]) part(sphere(0.016, 1.4, 0.7, 0.6, 8, 6), eyeM, head, s * 0.04, 0.088, 0.104);
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
      for (let i = 0; i < 7; i++) {
        part(new THREE.ConeGeometry(0.04, 0.15, 5), hair, head, (i - 3) * 0.033, 0.19, -0.04 - Math.abs(i - 3) * 0.01, -0.6, 0, (i - 3) * -0.22);
      }
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
    const fist = part(box(0.08 * k, 0.09 * k, 0.095 * k), handM, el, 0, -0.29, 0.005);
    fist.geometry.translate(0, 0, 0);
    part(new THREE.CylinderGeometry(0.03 * k, 0.03 * k, 0.085 * k, 8), handM, el, 0, -0.33 * (fs > 1 ? 1.02 : 1), 0.025, 0, 0, Math.PI / 2); // nudillos
    part(sphere(0.02 * k, 1, 1.4, 1, 6, 6), handM, el, side * -0.035 * k, -0.28, 0.04); // pulgar
    return [sh, el];
  };
  const [lSh, lEl] = arm(1);
  const [rSh, rEl] = arm(-1);

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
    return [hp, kn];
  };
  const [lHip, lKn] = leg(1);
  const [rHip, rKn] = leg(-1);

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

  return { root, tilt, hips, spine, head, lSh, lEl, rSh, rEl, lHip, lKn, rHip, rKn, mats, cloth };
}
