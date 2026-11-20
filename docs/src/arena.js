import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RING_TOP } from './fighter.js';

// ---------------------------------------------------------------- cielo y luces
export function setupEnvironment(scene, shadowSize = 2048) {
  const skyGeo = new THREE.SphereGeometry(400, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(0x24366e) }, mid: { value: new THREE.Color(0xd9825a) }, bottom: { value: new THREE.Color(0x3a2a24) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h*1.6,0.0,1.0), 0.7)) : mix(mid, bottom, clamp(-h*6.0,0.0,1.0));
      gl_FragColor = vec4(c,1.0); }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  scene.fog = new THREE.Fog(0xb7735a, 45, 140);

  scene.add(new THREE.HemisphereLight(0xffd7b8, 0x3b3029, 0.9));
  const sun = new THREE.DirectionalLight(0xffe2c4, 2.4);
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
  return { torches };
}

// ---------------------------------------------------------------- texturas
function tileTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const n = 4, sz = 512 / n;
  g.fillStyle = '#2a2622';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = 120 + Math.random() * 30;
    g.fillStyle = `rgb(${v + 20},${v + 10},${v - 8})`;
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
      o.material = new THREE.MeshBasicMaterial({ color: 0xffa040 });
      o.userData.fire = true;
    }
  });
  scene.add(root);

  // superficie de losas (1 losa = 1 m)
  const tiles = tileTexture();
  tiles.repeat.set(9.4 / 4, 9.4 / 4);
  const top = new THREE.Mesh(
    new THREE.PlaneGeometry(9.4, 9.4),
    new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.75, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
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
      color: 0x0d3446, roughness: 0.12, metalness: 0.2, normalMap: waterTex, normalScale: new THREE.Vector2(0.35, 0.35),
      transparent: true, opacity: 0.93,
    });
  }
  const fires = [];
  root.traverse((o) => { if (o.userData.fire) fires.push(o); });
  return { root, waterTex, fires };
}

// ---------------------------------------------------------------- público
const CLOTHES = [0xb3141a, 0x1d3f9a, 0xe6bf1a, 0x1f7a33, 0xe8e6dc, 0x1a1a1a, 0x7c1c86, 0xf06a10, 0x2aa0b4, 0x5a3b22, 0xd94f8a, 0x8fbf3a];
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
  const mat = new THREE.MeshLambertMaterial();
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
  }
  emit(pos, color, n, speed, size, life, grav = 0.004, additive = true) {
    for (let k = 0; k < n; k++) {
      const p = this.pool[this.i++ % this.pool.length];
      p.s.position.copy(pos);
      p.v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random()));
      p.life = p.max = life * (0.6 + Math.random() * 0.6);
      p.g = grav; p.size = size;
      p.s.material.color.set(color);
      p.s.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      p.s.visible = true;
    }
  }
  hit(pos, heavy, blocked) {
    const c = blocked ? 0x66aaff : heavy ? 0xffcc55 : 0xfff2c0;
    this.emit(pos, c, heavy ? 22 : 12, heavy ? 0.09 : 0.06, heavy ? 0.22 : 0.15, 18, 0.002);
    this.emit(pos, 0xffffff, 1, 0, heavy ? 1.1 : 0.7, 6, 0);
  }
  dust(pos) { this.emit(pos.clone().setY(pos.y + 0.1), 0xb8a890, 14, 0.04, 0.35, 30, -0.0005, false); }
  splash(pos) {
    const p = pos.clone(); p.y = 0.1;
    this.emit(p, 0xd8f0ff, 40, 0.14, 0.3, 50, 0.006, false);
    this.emit(p, 0xffffff, 20, 0.08, 0.5, 40, 0.004, false);
  }
  update(dt) {
    const k = dt * 60;
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
