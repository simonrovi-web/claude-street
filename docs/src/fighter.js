import * as THREE from 'three';
import {
  P, over, lerpPose, samplePose, KEYS,
  STANCE, GUARD, CROUCH, CROUCH_GUARD, JUMP, LAND, SIDESTEP,
  HIT_HIGH, HIT_MID, HIT_CROUCH, BLOCK, BLOCK_CROUCH, KNOCK, VICTORY,
  ATTACKS, THROW_KEYS,
} from './poses.js';
import { buildModel } from './characters.js';

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
  constructor(scene, def, index) {
    this.scene = scene;
    this.index = index;
    // sombra de contacto (siempre visible, ayuda a leer la profundidad)
    this.blob = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.time = index * 37;
    this.wins = 0;
    this.setCharacter(def, false);
    this.reset(0, 0);
  }

  // ------------------------------------------------------------ modelo
  setCharacter(def, alt = false) {
    if (this.def === def && this.alt === alt) return;
    if (this.root) {
      this.scene.remove(this.root);
      this.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
      this.mats.forEach((m) => m.dispose());
    }
    this.def = def;
    this.alt = alt;
    this.name = def.name;
    this.stats = def.stats;
    Object.assign(this, buildModel(def, alt));
    this.root.scale.setScalar(def.build.scale);
    this.scene.add(this.root);
    if (this.pose) this.applyPose(this.pose);
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
    this.lastFacing = facing;
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
      opp.takeHit(A, f, counter, G, this);
      G.onHit(this, opp, A, counter);
    }
  }

  takeHit(A, dir, counter, G, att) {
    const dmg = Math.round(A.dmg * (att ? att.stats.power : 1) * (counter ? 1.25 : 1));
    const push = A.push / this.stats.weight;
    const wasCrouching = this.isCrouching();
    this.hp = Math.max(0, this.hp - dmg);
    this.flash = 7;
    this.attack = null;
    if (this.hp <= 0) {
      this.dead = true;
      this.knockdown(dir, push + 0.06, 0.1);
      G.onKO(this);
    } else if (A.knockdown || this.isAirborne()) {
      this.knockdown(dir, push, 0.08);
    } else {
      this.hitLevel = wasCrouching ? 'crouch' : A.level;
      this.stun = A.hs + (counter ? 4 : 0);
      this.setState('hitstun');
      this.vel.x = dir.x * push;
      this.vel.z = dir.z * push;
    }
  }

  takeBlock(A, dir) {
    this.blockCrouch = this.isCrouching();
    this.stun = A.bs;
    this.setState('blockstun');
    this.vel.x = dir.x * A.push * 0.6 / this.stats.weight;
    this.vel.z = dir.z * A.push * 0.6 / this.stats.weight;
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
          const sp = (held.fwd ? WALK_F : -WALK_B) * this.stats.speed;
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
          const k = Math.max(0, 1 - this.f / 14) * 0.085 * Math.sqrt(this.stats.speed);
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
            this.facing += Math.PI; // render() compensa la pose para que no gire de golpe
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
      this.hp = Math.max(0, this.hp - Math.round(30 * this.thrower.stats.power));
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
    this.time += dt * 60;
    // si la orientación cambia de golpe (tras un lanzamiento), giramos la cadera al revés
    // para que el cuerpo no salte y se recoloque suavemente
    const d = wrap(this.facing - this.lastFacing);
    if (Math.abs(d) > 0.6) this.pose.hy -= d;
    this.lastFacing = this.facing;
    if (this.state !== 'attack' && this.state !== 'throwing') {
      if (this.pose.hy > Math.PI) this.pose.hy -= Math.PI * 2;
      else if (this.pose.hy < -Math.PI * 1.5) this.pose.hy += Math.PI * 2;
    }
    const target = this.targetPose();
    const k = this.state === 'attack' ? 0.6 : (this.state === 'hitstun' || this.state === 'blockstun') ? 0.6
      : (this.state === 'knockdown' || this.state === 'thrown') ? 0.2 : 0.3;
    const a = 1 - Math.pow(1 - k, dt * 60);
    for (const key of KEYS) this.pose[key] += (target[key] - this.pose[key]) * a;
    this.applyPose(this.pose);
    for (const c of this.cloth) {
      const p = this.pose;
      c.pivot.rotation.x = c.side > 0
        ? Math.min(0, Math.min(p.lhx, p.rhx)) * 0.75 - 0.04
        : Math.max(0, Math.max(p.lhx, p.rhx)) * 0.75 + 0.04;
    }
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
