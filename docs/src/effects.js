// Efectos visuales extra: estelas de golpes y confeti.
import * as THREE from 'three';

// Qué extremidad deja estela en cada ataque.
const LIMB = {
  jab: 'lFist', straight: 'rFist', elbow: 'rFist', lowPunch: 'lFist',
  kick: 'rFoot', highKick: 'rFoot', spinKick: 'rFoot', pushKick: 'lFoot', sweep: 'rFoot', jumpKick: 'rFoot',
  sp_dragon: 'rFist', sp_storm: 'feet', sp_quake: 'rFist', sp_shadow: 'rFist',
};

const N = 12; // puntos de la estela

// Estela tipo "cinta": se dibuja con mezcla aditiva para que brille con el bloom.
export class Trail {
  constructor(scene, color) {
    this.pts = [];
    const pos = new Float32Array(N * 2 * 3);
    const col = new Float32Array(N * 2 * 3);
    const idx = [];
    for (let i = 0; i < N - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.geo.setIndex(idx);
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.color = new THREE.Color(color);
    this.tmp = new THREE.Vector3();
  }

  setColor(c) { this.color.set(c); }

  // f: luchador; cam: cámara (para orientar la cinta hacia ella)
  update(f, cam) {
    let limb = null;
    if (f.state === 'attack' && f.attack && LIMB[f.attackName]) {
      const A = f.attack;
      const end = (A.hits ? A.hits[A.hits.length - 1][1] : A.s + A.a) + 4;
      if (f.f >= A.s - 3 && f.f <= end) limb = LIMB[f.attackName];
      if (limb === 'feet') limb = (f.f % 12) < 6 ? 'rFoot' : 'lFoot';
    }
    if (limb && f[limb]) {
      f[limb].getWorldPosition(this.tmp);
      if (this.limb !== limb) { this.pts.length = 0; this.limb = limb; }
      this.pts.unshift(this.tmp.clone());
      if (this.pts.length > N) this.pts.length = N;
    } else if (this.pts.length) {
      this.pts.pop(); // la estela se recoge sola
      this.limb = null;
    }
    this.build(cam);
  }

  build(cam) {
    const pos = this.geo.attributes.position.array, col = this.geo.attributes.color.array;
    const n = this.pts.length;
    this.mesh.visible = n > 1;
    if (n < 2) return;
    const toCam = new THREE.Vector3(), dir = new THREE.Vector3(), side = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const p = this.pts[Math.min(i, n - 1)];
      const q = this.pts[Math.min(i + 1, n - 1)] || p;
      dir.subVectors(p, q);
      if (dir.lengthSq() < 1e-8) dir.set(0, 1, 0);
      toCam.subVectors(cam.position, p);
      side.crossVectors(dir, toCam).normalize();
      const t = i / (N - 1);
      const w = 0.09 * (1 - t);
      const k = i < n ? (1 - t) * 3.2 : 0; // intensidad (aditiva: negro = invisible)
      for (let s = 0; s < 2; s++) {
        const j = (i * 2 + s) * 3;
        const sg = s ? -1 : 1;
        pos[j] = p.x + side.x * w * sg; pos[j + 1] = p.y + side.y * w * sg; pos[j + 2] = p.z + side.z * w * sg;
        col[j] = this.color.r * k; col[j + 1] = this.color.g * k; col[j + 2] = this.color.b * k;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

// Confeti que cae revoloteando al ganar el combate.
const CONF_COLORS = [0xff3d6e, 0xffd21f, 0x29d3ff, 0x9bea2f, 0xb453ff, 0xff8a1f, 0xffffff];
export class Confetti {
  constructor(scene, count = 260) {
    const geo = new THREE.PlaneGeometry(0.09, 0.14);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), count);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.parts = [];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      this.mesh.setColorAt(i, c.setHex(CONF_COLORS[i % CONF_COLORS.length]));
      this.parts.push({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 });
    }
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.one = new THREE.Vector3(1, 1, 1);
    this.active = false;
  }

  burst(center) {
    this.active = true;
    this.mesh.count = this.parts.length;
    for (const p of this.parts) {
      p.p.set(center.x + (Math.random() - 0.5) * 6, center.y + 4 + Math.random() * 3, center.z + (Math.random() - 0.5) * 4);
      p.v.set((Math.random() - 0.5) * 0.02, -0.01 - Math.random() * 0.015, (Math.random() - 0.5) * 0.02);
      p.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      p.w.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
      p.life = 260 + Math.random() * 120;
    }
  }

  update(dt) {
    if (!this.active) return;
    const k = dt * 60;
    let alive = 0;
    this.parts.forEach((p, i) => {
      if (p.life > 0) {
        p.life -= k;
        alive++;
        p.p.addScaledVector(p.v, k);
        p.p.x += Math.sin(p.life * 0.05 + i) * 0.006 * k; // revoloteo
        p.r.x += p.w.x * k; p.r.y += p.w.y * k; p.r.z += p.w.z * k;
        if (p.p.y < 0.82 && Math.abs(p.p.x) < 5 && Math.abs(p.p.z) < 5) { p.p.y = 0.82; p.v.set(0, 0, 0); p.w.set(0, 0, 0); }
      }
      this.q.setFromEuler(p.r);
      this.m.compose(p.p, this.q, p.life > 0 ? this.one : new THREE.Vector3(0, 0, 0));
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    if (!alive) { this.active = false; this.mesh.count = 0; }
  }
}
