import * as THREE from 'three';
import {
  P, over, lerpPose, samplePose, KEYS,
  STANCE, GUARD, CROUCH, CROUCH_GUARD, JUMP, LAND, SIDESTEP,
  HIT_HIGH, HIT_MID, HIT_CROUCH, BLOCK, BLOCK_CROUCH, KNOCK, VICTORY,
  ATTACKS, THROW_KEYS,
} from './poses.js';

export const RING_TOP = 0.8;     // altura de la superficie del ring
export const RING_HALF = 5.0;    // medio lado del ring (10 x 10 m)
const WALL = 4.8;                // límite al caminar (no te caes andando)
const WATER = 0.02;
const GRAV = 0.0095;
const WALK_F = 0.042, WALK_B = 0.032;
export const MAX_HP = 200;

const ACTIONABLE = new Set(['idle', 'walk', 'crouch', 'guard', 'crouchGuard']);
const INVULN = new Set(['knockdown', 'ko', 'getup', 'ringout', 'thrown', 'victory']);
const KNOCKBACK = new Set(['hitstun', 'blockstun', 'knockdown', 'ko']);

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Fighter {
  constructor(scene, cfg, index) {
    this.cfg = cfg;
    this.index = index;
    this.name = cfg.name;
    this.mats = [];
    this.build(cfg);
    scene.add(this.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.time = Math.random() * 100;
    this.wins = 0;
    this.reset(0, 0);
  }

  // ------------------------------------------------------------ modelo
  build(c) {
    const mat = (color, rough = 0.7) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
      this.mats.push(m);
      return m;
    };
    const gi = mat(c.gi), pants = mat(c.pants), skin = mat(c.skin, 0.55), hair = mat(c.hair, 0.6),
      belt = mat(c.belt, 0.5), glove = mat(c.glove, 0.4), shoe = mat(c.shoe, 0.6);

    const part = (geo, m, parent, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const joint = (parent, x = 0, y = 0, z = 0) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      parent.add(g);
      return g;
    };
    const cap = (r, len) => new THREE.CapsuleGeometry(r, len, 4, 10);

    this.root = new THREE.Group();
    this.tilt = joint(this.root);
    const hips = this.hips = joint(this.tilt, 0, 0.99, 0);
    part(new THREE.BoxGeometry(0.34, 0.2, 0.22), pants, hips, 0, -0.02, 0);
    const spine = this.spine = joint(hips, 0, 0.08, 0);
    // torso (gi) más ancho arriba
    const torsoGeo = new THREE.CylinderGeometry(0.22, 0.17, 0.52, 10);
    torsoGeo.scale(1, 1, 0.62);
    part(torsoGeo, gi, spine, 0, 0.26, 0);
    part(new THREE.BoxGeometry(0.36, 0.06, 0.24), belt, spine, 0, 0.02, 0);
    // escote (piel)
    const v = part(new THREE.BoxGeometry(0.1, 0.14, 0.02), skin, spine, 0, 0.44, 0.12);
    v.rotation.x = -0.15;
    const neck = joint(spine, 0, 0.52, 0);
    part(cap(0.055, 0.06), skin, neck, 0, 0.04, 0);
    const head = this.head = joint(neck, 0, 0.1, 0);
    const headGeo = new THREE.SphereGeometry(0.125, 16, 12);
    headGeo.scale(0.92, 1.08, 1);
    part(headGeo, skin, head, 0, 0.07, 0.01);
    // pelo
    if (c.hairStyle === 'ponytail') {
      const h = new THREE.SphereGeometry(0.132, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
      part(h, hair, head, 0, 0.085, -0.005);
      const tail = part(cap(0.045, 0.22), hair, head, 0, 0.05, -0.16);
      tail.rotation.x = 0.5;
      part(new THREE.SphereGeometry(0.05, 8, 6), hair, head, 0, 0.15, -0.11);
    } else {
      const h = new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
      part(h, hair, head, 0, 0.09, -0.01);
      for (let i = 0; i < 6; i++) {
        const sp = part(new THREE.ConeGeometry(0.045, 0.14, 5), hair, head, (i - 2.5) * 0.04, 0.19, -0.04 - Math.abs(i - 2.5) * 0.01);
        sp.rotation.set(-0.5, 0, (i - 2.5) * -0.25);
      }
      // cinta en la frente
      part(new THREE.TorusGeometry(0.128, 0.018, 6, 20), belt, head, 0, 0.11, 0.0).rotation.x = Math.PI / 2 + 0.15;
    }
    // ojos
    const eye = new THREE.MeshBasicMaterial({ color: 0x111111 });
    part(new THREE.SphereGeometry(0.014, 6, 4), eye, head, 0.045, 0.085, 0.115);
    part(new THREE.SphereGeometry(0.014, 6, 4), eye, head, -0.045, 0.085, 0.115);

    // brazos
    const arm = (side) => {
      const sh = joint(spine, side * 0.25, 0.46, 0);
      part(new THREE.SphereGeometry(0.075, 10, 8), gi, sh);
      part(cap(0.062, 0.2), gi, sh, 0, -0.14, 0);
      const el = joint(sh, 0, -0.29, 0);
      part(cap(0.05, 0.18), skin, el, 0, -0.12, 0);
      part(new THREE.SphereGeometry(0.07, 10, 8), glove, el, 0, -0.27, 0);
      return [sh, el];
    };
    [this.lSh, this.lEl] = arm(1);
    [this.rSh, this.rEl] = arm(-1);
    // piernas
    const leg = (side) => {
      const hp = joint(hips, side * 0.1, -0.05, 0);
      part(cap(0.08, 0.3), pants, hp, 0, -0.22, 0);
      const kn = joint(hp, 0, -0.45, 0);
      part(cap(0.068, 0.3), pants, kn, 0, -0.21, 0);
      part(new THREE.BoxGeometry(0.11, 0.08, 0.24), shoe, kn, 0, -0.45, 0.05);
      return [hp, kn];
    };
    [this.lHip, this.lKn] = leg(1);
    [this.rHip, this.rKn] = leg(-1);

    // sombra de contacto (siempre visible, ayuda a leer la profundidad)
    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    blob.rotation.x = -Math.PI / 2;
    this.blob = blob;
  }

  applyPose(p) {
    this.hips.position.y = 0.99 + p.y;
    this.hips.rotation.set(p.hx, p.hy, 0);
    this.spine.rotation.set(p.sx, p.sy, 0);
    this.head.rotation.x = p.hd;
    this.lSh.rotation.set(p.lsx, 0, p.lsz);
    this.lEl.rotation.x = p.lex;
    this.rSh.rotation.set(p.rsx, 0, p.rsz);
    this.rEl.rotation.x = p.rex;
    this.lHip.rotation.set(p.lhx, 0, p.lhz);
    this.lKn.rotation.x = p.lkx;
    this.rHip.rotation.set(p.rhx, 0, p.rhz);
    this.rKn.rotation.x = p.rkx;
    this.tilt.rotation.x = p.tilt;
    this.tilt.position.y = p.lift;
  }

  // ------------------------------------------------------------ estado
  reset(x, facing) {
    this.pos.set(x, RING_TOP, 0);
    this.vel.set(0, 0, 0);
    this.hp = MAX_HP;
    this.state = 'idle';
    this.f = 0;
    this.facing = facing;
    this.pose = P(STANCE);
    this.attack = null;
    this.flash = 0;
    this.outOfRing = false;
    this.dead = false;
    this.stun = 0;
    this.thrower = null;
    this.root.visible = true;
  }

  fwd() { return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing)); }
  groundY() {
    return (Math.abs(this.pos.x) <= RING_HALF && Math.abs(this.pos.z) <= RING_HALF) ? RING_TOP : WATER;
  }
  isAirborne() { return this.pos.y > this.groundY() + 0.001 || this.vel.y > 0; }
  isCrouching() {
    return this.state === 'crouch' || this.state === 'crouchGuard' ||
      (this.state === 'attack' && this.attack && this.attack.crouch) ||
      (this.state === 'blockstun' && this.blockCrouch) ||
      (this.state === 'hitstun' && this.hitLevel === 'crouch');
  }
  isGuarding() {
    return this.state === 'guard' || this.state === 'crouchGuard' || this.state === 'blockstun';
  }
  invulnerable() { return INVULN.has(this.state) || (this.state === 'getup' && this.f < 20); }
  setState(s) { this.state = s; this.f = 0; }
  toIdle() {
    if (this.pose.hy > Math.PI) this.pose.hy -= Math.PI * 2;
    this.attack = null;
    this.setState('idle');
  }

  turnTo(opp, k) {
    const target = Math.atan2(opp.pos.x - this.pos.x, opp.pos.z - this.pos.z);
    this.facing += wrap(target - this.facing) * k;
  }

  // dir: +1 hacia la cámara, -1 alejándose
  lateral(dir, camN) {
    const f = this.fwd();
    const L = new THREE.Vector3(f.z, 0, -f.x);
    if (L.dot(camN) < 0) L.negate();
    return L.multiplyScalar(dir);
  }

  startAttack(name, G) {
    this.attack = ATTACKS[name];
    this.attackName = name;
    this.attackFwd = this.fwd();
    this.hasHit = false;
    this.buf = null;
    this.setState('attack');
    G.sfx.whoosh(this.attack.heavy);
  }

  startJump(inp) {
    const f = this.fwd();
    const h = inp.held.fwd ? 0.045 : inp.held.back ? -0.035 : 0;
    this.vel.set(f.x * h, 0.155, f.z * h);
    this.pos.y += 0.01;
    this.airAttack = false;
    this.setState('jump');
  }

  tryThrow(opp, G) {
    const rx = opp.pos.x - this.pos.x, rz = opp.pos.z - this.pos.z;
    const dist = Math.hypot(rx, rz);
    const f = this.fwd();
    const along = rx * f.x + rz * f.z;
    const canBeThrown = ['idle', 'walk', 'guard', 'attack', 'land'].includes(opp.state);
    if (dist < 1.1 && along > 0.2 && !opp.isAirborne() && !opp.isCrouching() && canBeThrown && !opp.invulnerable()) {
      this.attackFwd = f;
      this.setState('throwing');
      opp.setState('thrown');
      opp.thrower = this;
      opp.throwFrom = opp.pos.clone();
      opp.throwTo = this.pos.clone().addScaledVector(f, -1.4);
      opp.throwTo.y = RING_TOP;
      opp.attack = null;
      G.sfx.grab();
    } else {
      this.startAttack('throwWhiff', G);
    }
  }

  // ------------------------------------------------------------ impacto
  checkHit(opp, G) {
    const A = this.attack;
    if (opp.invulnerable()) return;
    const f = this.attackFwd;
    const rx = opp.pos.x - this.pos.x, rz = opp.pos.z - this.pos.z;
    const along = rx * f.x + rz * f.z;
    const lat = rx * f.z - rz * f.x;
    if (along < 0.05 || along > A.reach + 0.3 || Math.abs(lat) > A.width) return;
    if (Math.abs(opp.pos.y - this.pos.y) > 1.0) return;
    const oppAir = opp.isAirborne();
    if (A.level === 'high' && opp.isCrouching()) return;   // pasa por encima
    if (A.level === 'low' && oppAir) return;

    this.hasHit = true;
    const d = Math.max(0.01, Math.hypot(rx, rz));
    const of = opp.fwd();
    const facingMe = (of.x * -rx + of.z * -rz) / d > 0.2;
    const blocked = opp.isGuarding() && facingMe && !oppAir &&
      (opp.isCrouching() ? A.level === 'low' : A.level !== 'low');
    if (blocked) {
      opp.takeBlock(A, f);
      G.onBlock(this, opp, A);
    } else {
      const counter = opp.state === 'attack' && opp.f <= opp.attack.s;
      opp.takeHit(A, f, counter, G);
      G.onHit(this, opp, A, counter);
    }
  }

  takeHit(A, dir, counter, G) {
    const dmg = Math.round(A.dmg * (counter ? 1.25 : 1));
    const wasCrouching = this.isCrouching();
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 7;
    this.attack = null;
    if (this.hp <= 0) {
      this.dead = true;
      this.knockdown(dir, A.push + 0.06, 0.1);
      G.onKO(this);
    } else if (A.knockdown || this.isAirborne()) {
      this.knockdown(dir, A.push, 0.08);
    } else {
      this.hitLevel = wasCrouching ? 'crouch' : A.level;
      this.stun = A.hs + (counter ? 4 : 0);
      this.setState('hitstun');
      this.vel.x = dir.x * A.push;
      this.vel.z = dir.z * A.push;
    }
  }

  takeBlock(A, dir) {
    this.blockCrouch = this.isCrouching();
    this.stun = A.bs;
    this.setState('blockstun');
    this.vel.x = dir.x * A.push * 0.6;
    this.vel.z = dir.z * A.push * 0.6;
  }

  knockdown(dir, push, pop) {
    this.setState('knockdown');
    const k = push * 0.45;
    this.vel.set(dir.x * k, pop, dir.z * k);
    this.pos.y += 0.01;
    // caer de espaldas en la dirección del golpe
    this.facing = Math.atan2(-dir.x, -dir.z);
  }

  // ------------------------------------------------------------ actualización por frame
  update(inp, opp, G) {
    this.time++;
    this.f++;
    if (this.flash > 0) this.flash--;

    if (ACTIONABLE.has(this.state)) {
      this.turnTo(opp, 0.2);
      const held = inp.held, pr = inp.pressed;
      const down = held.down;
      const throwInput = (pr.punch && (held.guard || inp.recent.guard < 4)) || (pr.guard && inp.recent.punch < 4);
      if (throwInput && !down) this.tryThrow(opp, G);
      else if (pr.punch) this.startAttack(down ? 'lowPunch' : held.fwd ? 'elbow' : 'jab', G);
      else if (pr.kick) this.startAttack(down ? 'sweep' : held.fwd ? 'pushKick' : 'kick', G);
      else if (pr.up && !down) this.startJump(inp);
      else if (pr.sideIn || pr.sideOut) {
        this.sideVec = this.lateral(pr.sideOut ? 1 : -1, G.camN);
        this.setState('sidestep');
        G.sfx.step();
      } else {
        let st;
        if (down) st = held.guard ? 'crouchGuard' : 'crouch';
        else if (held.guard) st = 'guard';
        else if (held.fwd || held.back) {
          st = 'walk';
          const f = this.fwd();
          const sp = held.fwd ? WALK_F : -WALK_B;
          this.walkDir = held.fwd ? 1 : -1;
          this.pos.x += f.x * sp;
          this.pos.z += f.z * sp;
        } else st = 'idle';
        if (st !== this.state) { this.state = st; this.f = 0; }
      }
    } else {
      switch (this.state) {
        case 'attack': this.updateAttack(inp, opp, G); break;
        case 'jump':
          if ((inp.pressed.kick || inp.pressed.punch) && !this.airAttack && this.f > 4) {
            this.airAttack = true;
            this.startAttack('jumpKick', G);
          }
          break;
        case 'land': if (this.f >= 7) this.toIdle(); break;
        case 'sidestep': {
          const k = Math.max(0, 1 - this.f / 14) * 0.085;
          this.pos.addScaledVector(this.sideVec, k);
          this.turnTo(opp, 0.15);
          if (this.f >= 16) this.toIdle();
          break;
        }
        case 'hitstun':
        case 'blockstun':
          if (this.f >= this.stun) this.toIdle();
          break;
        case 'knockdown':
          if (!this.isAirborne() && this.f > 55) {
            if (this.dead) this.setState('ko');
            else this.setState('getup');
          }
          break;
        case 'getup': if (this.f >= 28) { this.turnTo(opp, 1); this.toIdle(); } break;
        case 'throwing':
          if (this.f >= 50) {
            // el rival quedó detrás: giramos y compensamos la pose
            this.facing += Math.PI;
            this.pose.hy -= Math.PI;
            this.toIdle();
          }
          break;
        case 'thrown': this.updateThrown(inp, G); break;
        default: break;
      }
    }
    this.physics(G);
  }

  updateAttack(inp, opp, G) {
    const A = this.attack, f = this.f;
    if (A.lunge && f <= A.s) this.pos.addScaledVector(this.attackFwd, A.lunge);
    if (this.attackName === 'jab' && f <= 3 && inp.pressed.guard) { this.tryThrow(opp, G); return; }
    if (A.a > 0 && f > A.s && f <= A.s + A.a && !this.hasHit) this.checkHit(opp, G);
    if (A.chain) {
      if (inp.pressed.punch) this.buf = 'P';
      if (inp.pressed.kick) this.buf = 'K';
      if (this.buf && f >= A.s + A.a && f <= A.s + A.a + A.r - 2 && A.chain[this.buf]) {
        const next = A.chain[this.buf];
        this.startAttack(next, G);
        return;
      }
    }
    if (A.air) return; // termina al aterrizar
    if (f >= A.s + A.a + A.r) this.toIdle();
  }

  updateThrown(inp, G) {
    const T = 32;
    if (this.f <= 8 && inp.pressed.guard) { G.throwEscape(this.thrower, this); return; }
    const t = Math.min(1, this.f / T);
    const e = t * t * (3 - 2 * t);
    this.pos.lerpVectors(this.throwFrom, this.throwTo, e);
    this.pos.y = RING_TOP + Math.sin(Math.PI * t) * 1.5;
    this.vel.set(0, 0, 0);
    if (t >= 1) {
      const dir = new THREE.Vector3().subVectors(this.throwTo, this.throwFrom).setY(0).normalize();
      this.hp = Math.max(0, this.hp - 30);
      this.flash = 7;
      this.knockdown(dir, 0.06, 0.02);
      G.onThrowLand(this.thrower, this);
      if (this.hp <= 0) { this.dead = true; G.onKO(this); }
    }
  }

  physics(G) {
    if (this.state === 'thrown') return;
    const ground = this.groundY();
    this.pos.x += this.vel.x;
    this.pos.z += this.vel.z;
    const air = this.pos.y > ground + 0.001 || this.vel.y > 0;
    if (air) {
      this.vel.x *= 0.98;
      this.vel.z *= 0.98;
      this.vel.y -= GRAV;
      this.pos.y += this.vel.y;
      if (this.pos.y <= ground) {
        this.pos.y = ground;
        this.vel.y = 0;
        this.onLand(G);
      }
    } else {
      const fr = (this.state === 'knockdown' || this.state === 'ko') ? 0.9 : 0.86;
      this.vel.x *= fr;
      this.vel.z *= fr;
      if (this.state === 'ringout') { // hundirse un poco en el agua
        this.pos.y = Math.max(WATER - 0.55, this.pos.y - 0.004);
      }
    }
    // caminar/esquivar/saltar no te saca del ring; los golpes sí
    if (!KNOCKBACK.has(this.state) && this.state !== 'ringout' && !this.outOfRing) {
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -WALL, WALL);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, -WALL, WALL);
    }
    if (!this.outOfRing && (Math.abs(this.pos.x) > RING_HALF || Math.abs(this.pos.z) > RING_HALF)) {
      this.outOfRing = true;
      this.setState('ringout');
      G.onRingOut(this);
    }
  }

  onLand(G) {
    if (this.state === 'jump' || (this.state === 'attack' && this.attack && this.attack.air)) {
      this.attack = null;
      this.setState('land');
      G.sfx.step();
    } else if (this.state === 'knockdown') {
      G.sfx.thud();
      G.fx.dust(this.pos);
    } else if (this.state === 'ringout') {
      G.onSplash(this);
    }
  }

  // ------------------------------------------------------------ animación
  targetPose() {
    const t = this.f;
    switch (this.state) {
      case 'idle': return over(STANCE, { y: STANCE.y + Math.sin(this.time * 0.07) * 0.012, sx: STANCE.sx + Math.sin(this.time * 0.07) * 0.02 });
      case 'walk': {
        const ph = this.time * 0.24 * this.walkDir;
        return over(STANCE, {
          lhx: STANCE.lhx + Math.sin(ph) * 0.3, rhx: STANCE.rhx - Math.sin(ph) * 0.3,
          lkx: STANCE.lkx + Math.max(0, Math.cos(ph)) * 0.45, rkx: STANCE.rkx + Math.max(0, -Math.cos(ph)) * 0.45,
          y: STANCE.y - Math.abs(Math.sin(ph)) * 0.025,
        });
      }
      case 'crouch': return CROUCH;
      case 'guard': return GUARD;
      case 'crouchGuard': return CROUCH_GUARD;
      case 'jump': return JUMP;
      case 'land': return LAND;
      case 'sidestep': return SIDESTEP;
      case 'attack': return this.attackPose();
      case 'hitstun': {
        const hp = this.hitLevel === 'high' ? HIT_HIGH : this.hitLevel === 'crouch' ? HIT_CROUCH : HIT_MID;
        const base = this.hitLevel === 'crouch' ? CROUCH : STANCE;
        return lerpPose(hp, base, Math.max(0, (t - this.stun * 0.4) / (this.stun * 0.6)));
      }
      case 'blockstun': return this.blockCrouch ? BLOCK_CROUCH : BLOCK;
      case 'knockdown':
      case 'ko': return KNOCK;
      case 'getup': return t < 12 ? lerpPose(KNOCK, CROUCH, t / 12) : lerpPose(CROUCH, STANCE, Math.min(1, (t - 12) / 14));
      case 'throwing': return samplePose(THROW_KEYS, t);
      case 'thrown': return over(KNOCK, { tilt: -Math.min(1, t / 32) * 1.5, lsx: -2.4, rsx: -2.4, lift: 0.1 });
      case 'ringout': {
        const s = Math.sin(this.time * 0.5);
        return over(KNOCK, { tilt: -0.7, lsx: -2.6 + s * 0.5, rsx: -2.6 - s * 0.5, lhx: -0.6 + s * 0.3, rhx: -0.2 - s * 0.3 });
      }
      case 'victory': {
        const s = Math.max(0, Math.sin(this.time * 0.12));
        return over(VICTORY, { lex: -0.3 - s * 0.6, y: s * 0.03 });
      }
      default: return STANCE;
    }
  }

  attackPose() {
    const A = this.attack, f = this.f;
    const base = A.air ? JUMP : A.crouch ? CROUCH : STANCE;
    if (A.spin) {
      return samplePose([
        [0, STANCE], [A.s * 0.6, A.W], [A.s, A.S], [A.s + A.a, A.S2],
        [A.s + A.a + A.r * 0.7, over(STANCE, { hy: STANCE.hy + Math.PI * 2 })],
      ], f);
    }
    if (A.air) return samplePose([[0, base], [A.s, A.S]], f);
    return samplePose([
      [0, base], [Math.max(1, A.s * 0.6), A.W], [A.s, A.S], [A.s + A.a, A.S], [A.s + A.a + A.r * 0.75, base],
    ], f);
  }

  render(dt) {
    const target = this.targetPose();
    const k = this.state === 'attack' ? 0.6 : (this.state === 'hitstun' || this.state === 'blockstun') ? 0.6
      : (this.state === 'knockdown' || this.state === 'thrown') ? 0.2 : 0.3;
    const a = 1 - Math.pow(1 - k, dt * 60);
    for (const key of KEYS) this.pose[key] += (target[key] - this.pose[key]) * a;
    this.applyPose(this.pose);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing;
    const e = this.flash > 0 ? 0.9 * (this.flash / 7) : 0;
    for (const m of this.mats) m.emissive.setScalar(e);
    // sombra de contacto sobre la superficie
    this.blob.position.set(this.pos.x, this.groundY() + 0.006, this.pos.z);
    const h = Math.max(0, this.pos.y - this.groundY());
    this.blob.scale.setScalar(Math.max(0.3, 1 - h * 0.4));
    this.blob.visible = this.groundY() > 0.5;
  }
}
