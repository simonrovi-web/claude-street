import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RING_TOP } from './fighter.js';
import { toonMat, vivid, gradientMap } from './toon.js';

// ---------------------------------------------------------------- cielo y luces
export function setupEnvironment(scene, shadowSize = 2048, renderer = null) {
  // reflejos suaves para metales y piel
  if (renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.35;
    pmrem.dispose();
  }
  const skyGeo = new THREE.SphereGeometry(400, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x3d8bff) }, mid: { value: new THREE.Color(0xffb38a) }, bottom: { value: new THREE.Color(0x7a4a8a) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h*1.6,0.0,1.0), 0.7)) : mix(mid, bottom, clamp(-h*6.0,0.0,1.0));
      gl_FragColor = vec4(c,1.0); }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  const clouds = makeClouds(scene);
  scene.fog = new THREE.Fog(0xffb995, 60, 170);

  const hemi = new THREE.HemisphereLight(0xfff0e0, 0x8a6a9a, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.position.set(9, 15, 11);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  const s = sun.shadow.camera;
  s.left = -9; s.right = 9; s.top = 9; s.bottom = -9; s.near = 1; s.far = 50;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const torches = [];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const l = new THREE.PointLight(0xff8a3d, 8, 14, 1.8);
    l.position.set(x * 5.6, 3.4, z * 5.6);
    scene.add(l);
    torches.push(l);
  }
  // luz de contorno detrás de los luchadores (la mueve la cámara) para separarlos del fondo
  const rim = new THREE.DirectionalLight(0x9fe8ff, 2.0);
  scene.add(rim, rim.target);
  // cielo nocturno: estrellas y luna (ocultas salvo en el escenario de noche)
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 700; i++) {
    const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI * 0.42;
    sp.push(Math.cos(th) * Math.sin(ph) * 380, Math.cos(ph) * 380 * 0.9 + 10, Math.sin(th) * Math.sin(ph) * 380);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9 }));
  stars.visible = false;
  scene.add(stars);
  const moonMat = new THREE.SpriteMaterial({ map: moonTexture(), fog: false, transparent: true, depthWrite: false });
  moonMat.color.multiplyScalar(2.5);
  const moon = new THREE.Sprite(moonMat);
  moon.position.set(-80, 120, -260);
  moon.scale.setScalar(38);
  moon.visible = false;
  scene.add(moon);
  return { torches, rim, clouds, sky: skyMat, hemi, sun, stars, moon, stage: 'atardecer' };
}

function moonTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 20, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,250,230,1)');
  gr.addColorStop(0.45, 'rgba(255,248,225,1)');
  gr.addColorStop(0.5, 'rgba(200,220,255,0.35)');
  gr.addColorStop(1, 'rgba(160,190,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(210,200,180,0.5)';
  for (const [x, y, r] of [[52, 54, 7], [72, 70, 9], [60, 78, 5], [76, 50, 4]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------- escenarios (hora del día)
export const STAGES = {
  atardecer: {
    name: 'Atardecer', sky: [0x3d8bff, 0xffb38a, 0x7a4a8a], fog: [0xffb995, 60, 170],
    hemi: [0xfff0e0, 0x8a6a9a, 1.1], sun: [0xfff0d8, 2.6, [9, 15, 11]], rim: 0x9fe8ff, torch: 7,
    water: 0x18a8c8, cloud: 0xfff2ee, night: false, exposure: 1.0,
  },
  dia: {
    name: 'Mediodía', sky: [0x1f7bff, 0xbfe8ff, 0x9ec8e8], fog: [0xcfeaff, 70, 190],
    hemi: [0xffffff, 0x9ab07a, 1.25], sun: [0xffffff, 3.0, [4, 22, 6]], rim: 0xffffff, torch: 3,
    water: 0x22c4e0, cloud: 0xffffff, night: false, exposure: 1.02,
  },
  noche: {
    name: 'Noche', sky: [0x040822, 0x1c2c72, 0x2a1a48], fog: [0x1a2256, 40, 150],
    hemi: [0x7a8aff, 0x2a1a3a, 0.6], sun: [0x9ab8ff, 1.3, [-8, 14, -10]], rim: 0x6fa8ff, torch: 16,
    water: 0x0e3e78, cloud: 0x5a6aa8, night: true, exposure: 1.0,
  },
};
export const STAGE_KEYS = Object.keys(STAGES);

export function setStage(env, arena, scene, renderer, key) {
  const S = STAGES[key] || STAGES.atardecer;
  env.stage = key in STAGES ? key : 'atardecer';
  env.sky.uniforms.top.value.setHex(S.sky[0]);
  env.sky.uniforms.mid.value.setHex(S.sky[1]);
  env.sky.uniforms.bottom.value.setHex(S.sky[2]);
  scene.fog.color.setHex(S.fog[0]); scene.fog.near = S.fog[1]; scene.fog.far = S.fog[2];
  env.hemi.color.setHex(S.hemi[0]); env.hemi.groundColor.setHex(S.hemi[1]); env.hemi.intensity = S.hemi[2];
  env.sun.color.setHex(S.sun[0]); env.sun.intensity = S.sun[1]; env.sun.position.set(...S.sun[2]);
  env.rim.color.setHex(S.rim);
  env.torchBase = S.torch;
  env.stars.visible = S.night;
  env.moon.visible = S.night;
  env.night = S.night;
  for (const c of env.clouds) c.material.color.setHex(S.cloud);
  if (arena && arena.waterMat) arena.waterMat.color.setHex(S.water);
  renderer.toneMappingExposure = S.exposure;
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const x = 40 + Math.random() * 176, y = 60 + Math.random() * 30, r = 26 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)');
    gr.addColorStop(0.7, 'rgba(255,240,235,0.8)');
    gr.addColorStop(1, 'rgba(255,230,230,0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function makeClouds(scene) {
  const list = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.SpriteMaterial({ map: cloudTexture(), fog: false, transparent: true, depthWrite: false, color: 0xfff2ee });
    const sp = new THREE.Sprite(m);
    const a = Math.random() * Math.PI * 2, r = 150 + Math.random() * 60;
    sp.position.set(Math.cos(a) * r, 38 + Math.random() * 40, Math.sin(a) * r);
    const sc = 50 + Math.random() * 40;
    sp.scale.set(sc, sc * 0.45, 1);
    sp.userData.a = a; sp.userData.r = r; sp.userData.sp = 0.004 + Math.random() * 0.004;
    scene.add(sp);
    list.push(sp);
  }
  return list;
}
export function animateSky(env, dt) {
  for (const c of env.clouds) {
    c.userData.a += c.userData.sp * dt;
    c.position.x = Math.cos(c.userData.a) * c.userData.r;
    c.position.z = Math.sin(c.userData.a) * c.userData.r;
  }
}

// ---------------------------------------------------------------- texturas
function tileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const n = 4, sz = 512 / n;
  g.fillStyle = '#6a4a3a';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 175 + Math.random() * 30;
    g.fillStyle = `rgb(${v + 30},${v + 12},${v - 20})`;
    g.fillRect(i * sz + 3, j * sz + 3, sz - 6, sz - 6);
    for (let k = 0; k < 140; k++) {
      const a = Math.random() * 0.12;
      g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,240,220,${a})`;
      const r = 2 + Math.random() * 10;
      g.beginPath();
      g.arc(i * sz + 3 + Math.random() * (sz - 6), j * sz + 3 + Math.random() * (sz - 6), r, 0, 7);
      g.fill();
    }
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.strokeRect(i * sz + 4, j * sz + 4, sz - 8, sz - 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function waterNormal() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const a = Math.sin(x / 256 * Math.PI * 8 + Math.sin(y / 256 * Math.PI * 4) * 2);
    const b = Math.sin(y / 256 * Math.PI * 6 + Math.cos(x / 256 * Math.PI * 6) * 1.5);
    const i = (y * 256 + x) * 4;
    img.data[i] = 128 + a * 40; img.data[i + 1] = 128 + b * 40; img.data[i + 2] = 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 10);
  return t;
}

// ---------------------------------------------------------------- arena (desde Blender)
export async function loadArena(scene, base = 'assets/') {
  const gltf = await new GLTFLoader().loadAsync(base + 'arena.glb');
  const root = gltf.scene;
  let water = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.receiveShadow = true;
    o.castShadow = !/Agua|Suelo|Grada_|Muro/.test(o.name);
    if (/Agua/.test(o.name)) water = o;
    if (o.material && o.material.name === 'M_Fuego') {
      o.material = new THREE.MeshBasicMaterial({ color: 0xffb040 });
      o.material.color.multiplyScalar(5);
      o.userData.fire = true;
    } else if (o.material && o.material.isMeshStandardMaterial && !/Agua/.test(o.name)) {
      const m = o.material;
      o.material = toonMat(vivid(m.color, 0.2, 0.1), { map: m.map || null });
    }
  });
  scene.add(root);

  // superficie de losas (1 losa = 1 m)
  const tiles = tileTexture();
  tiles.repeat.set(9.4 / 4, 9.4 / 4);
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(9.4, 9.4),
    new THREE.MeshToonMaterial({ map: tiles, gradientMap, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  );
  top.rotation.x = -Math.PI / 2;
  top.position.y = RING_TOP + 0.0008;
  top.receiveShadow = true;
  scene.add(top);

  // agua
  let waterTex = null;
  if (water) {
    waterTex = waterNormal();
    water.material = new THREE.MeshStandardMaterial({
      color: 0x18a8c8, roughness: 0.1, metalness: 0.1, normalMap: waterTex, normalScale: new THREE.Vector2(0.35, 0.35),
      transparent: true, opacity: 0.93,
    });
  }
  const fires = [];
  root.traverse((o) => { if (o.userData.fire) fires.push(o); });
  const banners = makeBanners(scene);
  return { root, waterTex, fires, banners, waterMat: water ? water.material : null };
}

// ---------------------------------------------------------------- estandartes
const BANNERS = [[0xe0281e, 0xffd21f], [0x2f7bff, 0xffffff], [0xb453ff, 0x7dffea], [0xff8a1f, 0x2a1a44]];
function bannerTexture(c1, c2) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  g.fillStyle = hex(c1); g.fillRect(0, 0, 128, 256);
  g.fillStyle = hex(c2); g.fillRect(0, 0, 128, 14); g.fillRect(10, 0, 8, 256); g.fillRect(110, 0, 8, 256);
  // emblema: estrella dentro de un círculo
  g.beginPath(); g.arc(64, 110, 36, 0, Math.PI * 2); g.fillStyle = hex(c2); g.fill();
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 12 : 28, a = -Math.PI / 2 + i * Math.PI / 5;
    g.lineTo(64 + Math.cos(a) * r, 110 + Math.sin(a) * r);
  }
  g.closePath(); g.fillStyle = hex(c1); g.fill();
  // punta inferior en forma de cola de golondrina
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.moveTo(0, 256); g.lineTo(64, 214); g.lineTo(128, 256); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function makeBanners(scene) {
  const list = [];
  [-14, -6, 6, 14].forEach((x, i) => {
    const geo = new THREE.PlaneGeometry(1.5, 3.0, 6, 14);
    geo.translate(0, -1.5, 0); // el origen arriba: cuelga del dintel
    const [c1, c2] = BANNERS[i % BANNERS.length];
    const m = toonMat(0xffffff, { map: bannerTexture(c1, c2), side: THREE.DoubleSide, alphaTest: 0.5 });
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, 9.15, -26.55);
    mesh.castShadow = true;
    mesh.userData.base = Float32Array.from(geo.attributes.position.array);
    mesh.userData.ph = i * 1.7;
    scene.add(mesh);
    list.push(mesh);
  });
  return list;
}
export function animateBanners(list, t) {
  for (const b of list) {
    const pos = b.geometry.attributes.position, base = b.userData.base;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1];
      const amp = (-y / 3.0) * 0.22; // ondea más abajo que arriba
      pos.array[i * 3 + 2] = Math.sin(t * 2.2 + y * 1.8 + x * 1.5 + b.userData.ph) * amp;
    }
    pos.needsUpdate = true;
    b.geometry.computeVertexNormals();
  }
}

// ---------------------------------------------------------------- público
const CLOTHES = [0xff3b3b, 0x2f7bff, 0xffd21f, 0x2ecc5a, 0xffffff, 0x2a2a3a, 0xb04fff, 0xff8a1f, 0x1fd0e0, 0xff5fa8, 0x9be22f, 0x6a5aff];
const SKIN = [0xf2c4a0, 0xd9a07a, 0xa8714a, 0x7a4a2c, 0x4a2c1a];

export async function loadCrowd(scene, base = 'assets/', density = 1) {
  const data = await fetch(base + 'asientos.json').then((r) => r.json());
  const seats = data.seats;
  const N = seats.length;
  const body = new THREE.CapsuleGeometry(0.19, 0.38, 3, 8); body.translate(0, 0.4, 0);
  const head = new THREE.SphereGeometry(0.12, 10, 8); head.translate(0, 0.86, 0);
  const a1 = new THREE.BoxGeometry(0.08, 0.5, 0.08); a1.rotateZ(-0.3); a1.translate(0.27, 0.95, 0);
  const a2 = new THREE.BoxGeometry(0.08, 0.5, 0.08); a2.rotateZ(0.3); a2.translate(-0.27, 0.95, 0);
  const arms = mergeGeometries([a1, a2]);
  const mat = toonMat(0xffffff);
  const mBody = new THREE.InstancedMesh(body, mat, N);
  const mHead = new THREE.InstancedMesh(head, mat, N);
  const mArms = new THREE.InstancedMesh(arms, mat, N);
  const col = new THREE.Color();
  const people = [];
  for (let i = 0; i < N; i++) {
    const [bx, by, bz, yaw] = seats[i];
    const seated = Math.random() > 0.2;
    people.push({
      x: bx, y: bz + (seated ? 0 : 0.3), z: -by,
      r: Math.atan2(Math.cos(yaw), -Math.sin(yaw)) + (Math.random() - 0.5) * 0.5,
      s: 0.9 + Math.random() * 0.22,
      ph: Math.random() * Math.PI * 2, sp: 0.08 + Math.random() * 0.08,
      fan: Math.random(), // umbral de emoción para levantar los brazos
      hidden: Math.random() > 0.88 * density, // asientos vacíos (menos público en móvil)
    });
    const clothes = CLOTHES[(Math.random() * CLOTHES.length) | 0];
    mBody.setColorAt(i, col.setHex(clothes));
    mArms.setColorAt(i, col.setHex(clothes));
    mHead.setColorAt(i, col.setHex(SKIN[(Math.random() * SKIN.length) | 0]));
  }
  for (const m of [mBody, mHead, mArms]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    scene.add(m);
  }
  const crowd = { people, mBody, mHead, mArms, excite: 0.2, t: 0 };
  updateCrowd(crowd, 0);
  return crowd;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export function updateCrowd(c, dt) {
  c.t += dt * 60;
  const ex = c.excite;
  for (let i = 0; i < c.people.length; i++) {
    const p = c.people[i];
    if (p.hidden) { c.mBody.setMatrixAt(i, ZERO); c.mHead.setMatrixAt(i, ZERO); c.mArms.setMatrixAt(i, ZERO); continue; }
    const bounce = Math.max(0, Math.sin(c.t * p.sp * (1 + ex) + p.ph)) * (0.02 + ex * 0.16);
    _p.set(p.x, p.y + bounce, p.z);
    _q.setFromEuler(_e.set(0, p.r, 0));
    _s.setScalar(p.s);
    _m.compose(_p, _q, _s);
    c.mBody.setMatrixAt(i, _m);
    c.mHead.setMatrixAt(i, _m);
    c.mArms.setMatrixAt(i, ex > p.fan * 0.9 + 0.1 ? _m : ZERO);
  }
  c.mBody.instanceMatrix.needsUpdate = true;
  c.mHead.instanceMatrix.needsUpdate = true;
  c.mArms.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- partículas
function sparkTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.8)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function ringTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 34, 64, 64, 62);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.55, 'rgba(255,255,255,1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.tex = sparkTexture();
    this.pool = [];
    for (let i = 0; i < 160; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.visible = false;
      scene.add(s);
      this.pool.push({ s, life: 0, max: 1, v: new THREE.Vector3(), g: 0, size: 0.2 });
    }
    this.i = 0;
    // anillos de onda de choque
    this.ringTex = ringTexture();
    this.rings = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.ringTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.visible = false;
      scene.add(s);
      this.rings.push({ s, life: 0, max: 1, size: 1 });
    }
    this.ri = 0;
  }
  ring(pos, color, size = 1.4, life = 14) {
    const r = this.rings[this.ri++ % this.rings.length];
    r.s.position.copy(pos);
    r.s.material.color.set(color).multiplyScalar(3.5);
    r.life = r.max = life; r.size = size;
    r.s.visible = true;
  }
  firefly(pos) {
    this.emit(pos, 0xd8ff6a, 1, 0.006, 0.08, 120, -0.0001);
  }
  ember(pos) {
    this.emit(pos, 0xff9a30, 1, 0.012, 0.07, 70, -0.0006);
  }
  emit(pos, color, n, speed, size, life, grav = 0.004, additive = true) {
    for (let k = 0; k < n; k++) {
      const p = this.pool[this.i++ % this.pool.length];
      p.s.position.copy(pos);
      p.v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      p.life = p.max = life * (0.6 + Math.random() * 0.6);
      p.g = grav; p.size = size;
      p.s.material.color.set(color);
      if (additive) p.s.material.color.multiplyScalar(3.5); // brillan con el bloom
      p.s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      p.s.visible = true;
    }
  }
  hit(pos, heavy, blocked) {
    const c = blocked ? 0x66aaff : heavy ? 0xffcc55 : 0xfff2c0;
    this.emit(pos, c, heavy ? 22 : 12, heavy ? 0.09 : 0.06, heavy ? 0.22 : 0.15, 18, 0.002);
    this.emit(pos, 0xffffff, 1, 0, heavy ? 1.1 : 0.7, 6, 0);
    if (heavy || blocked) this.ring(pos, c, heavy ? 1.8 : 1.0, heavy ? 16 : 10);
  }
  smoke(pos) {
    const p = pos.clone(); p.y += 0.9;
    this.emit(p, 0x3a1a4a, 18, 0.05, 0.55, 34, -0.001, false);
    this.emit(p, 0x9a6ad0, 10, 0.07, 0.25, 20, 0, true);
  }
  burst(pos, color = 0xffd060) {
    const p = pos.clone(); p.y += 1.1;
    this.emit(p, color, 26, 0.08, 0.2, 26, -0.001);
    this.emit(p, 0xffffff, 1, 0, 1.6, 10, 0);
  }
  shock(pos, dir) {
    for (let i = 0; i < 6; i++) {
      const p = pos.clone().addScaledVector(dir, 0.5 + i * 0.35);
      p.y += 0.05;
      this.emit(p, 0xb8a890, 6, 0.05, 0.4, 30, -0.0008, false);
      this.emit(p, 0xffc070, 3, 0.04, 0.15, 14, 0.002);
    }
  }
  dust(pos) { this.emit(pos.clone().setY(pos.y + 0.1), 0xb8a890, 14, 0.04, 0.35, 30, -0.0005, false); }
  splash(pos) {
    const p = pos.clone(); p.y = 0.1;
    this.emit(p, 0xd8f0ff, 40, 0.14, 0.3, 50, 0.006, false);
    this.emit(p, 0xffffff, 20, 0.08, 0.5, 40, 0.004, false);
  }
  update(dt) {
    const k = dt * 60;
    for (const r of this.rings) {
      if (!r.s.visible) continue;
      r.life -= k;
      if (r.life <= 0) { r.s.visible = false; continue; }
      const t = 1 - r.life / r.max;
      r.s.scale.setScalar(0.2 + t * r.size);
      r.s.material.opacity = 1 - t;
    }
    for (const p of this.pool) {
      if (!p.s.visible) continue;
      p.life -= k;
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.v.y -= p.g * k;
      p.s.position.addScaledVector(p.v, k);
      const t = p.life / p.max;
      p.s.material.opacity = Math.min(1, t * 1.5);
      p.s.scale.setScalar(p.size * (0.5 + t * 0.8));
    }
  }
}
