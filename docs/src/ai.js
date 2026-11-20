// CPU para jugar solo, con tres niveles de dificultad.
import { ACTIONS } from './input.js';

const blank = () => Object.fromEntries([...ACTIONS, 'fwd', 'back'].map((a) => [a, false]));

// react: probabilidad por frame de reaccionar a un ataque; cool: pausa entre ataques (frames);
// guard: probabilidad de cubrirse cuando no hace nada; combo: probabilidad de encadenar; special: de usar el especial
export const LEVELS = {
  facil: { name: 'Fácil', react: 0.025, cool: [45, 40], guard: 0.12, combo: 0.25, special: 0.01, escape: 0.03 },
  normal: { name: 'Normal', react: 0.08, cool: [22, 30], guard: 0.3, combo: 0.5, special: 0.03, escape: 0.15 },
  dificil: { name: 'Difícil', react: 0.2, cool: [10, 16], guard: 0.45, combo: 0.8, special: 0.08, escape: 0.4 },
};

// alcance a partir del cual tiene sentido lanzar cada especial
const SPECIAL_RANGE = { sp_dragon: 1.3, sp_storm: 2.2, sp_quake: 2.4, sp_shadow: 4, sp_charge: 3.2, sp_lotus: 6 };

export class AI {
  constructor(level = 'normal') {
    this.L = LEVELS[level] || LEVELS.normal;
    this.cool = 40;
    this.guardT = 0;
    this.plan = null;
    this.recent = Object.fromEntries(ACTIONS.map((a) => [a, 99]));
  }

  think(me, opp) {
    const L = this.L;
    const held = blank(), pressed = blank();
    const press = (a) => { pressed[a] = true; held[a] = true; };
    const dx = opp.pos.x - me.pos.x, dz = opp.pos.z - me.pos.z;
    const dist = Math.hypot(dx, dz);
    this.cool--;

    // continuar un combo
    if (me.state === 'attack' && this.plan && me.attack && me.attack.chain) {
      const A = me.attack;
      if (me.f === A.s + A.a) { press(this.plan.shift()); if (!this.plan.length) this.plan = null; }
    }

    const free = ['idle', 'walk', 'crouch', 'guard', 'crouchGuard'].includes(me.state);
    const oppDown = ['knockdown', 'getup', 'ko'].includes(opp.state);
    if (this.guardT > 0) {
      this.guardT--;
      held.guard = true;
      held.down = this.guardLow;
    } else if (free) {
      const range = SPECIAL_RANGE[me.def.special.move] || 1.5;
      if (me.canSpecial() && !oppDown && dist < range && Math.random() < L.special) {
        press('special');
      } else if (opp.state === 'attack' && opp.attack && opp.f < opp.attack.s && dist < 2 && Math.random() < L.react) {
        if (Math.random() < 0.25) press(Math.random() < 0.5 ? 'sideIn' : 'sideOut');
        else { this.guardT = 18; this.guardLow = !!opp.attack.crouch; held.guard = true; held.down = this.guardLow; }
      } else if (dist > 1.25) {
        held.fwd = true;
        if (dist < 2.6 && Math.random() < 0.006) press('up');
        if (Math.random() < 0.004) press(Math.random() < 0.5 ? 'sideIn' : 'sideOut');
      } else if (this.cool <= 0 && !oppDown) {
        const r = Math.random();
        if (r < 0.28) {
          press('punch');
          this.plan = Math.random() < L.combo ? (Math.random() < 0.6 ? ['punch', 'kick'] : ['kick']) : null;
        } else if (r < 0.45) press('kick');
        else if (r < 0.55) { held.down = true; press('punch'); }
        else if (r < 0.65) { held.down = true; press('kick'); }
        else if (r < 0.75) { held.fwd = true; press('kick'); }
        else if (r < 0.83) { held.fwd = true; press('punch'); }
        else if (r < 0.9) { held.guard = true; press('punch'); }
        else { held.back = true; }
        this.cool = L.cool[0] + Math.random() * L.cool[1];
      } else if (Math.random() < L.guard) {
        held.guard = true;
      }
    } else if (me.state === 'thrown' && Math.random() < L.escape) {
      press('guard');
    }

    for (const a of ACTIONS) this.recent[a] = pressed[a] ? 0 : this.recent[a] + 1;
    return { held, pressed, recent: this.recent };
  }
}
