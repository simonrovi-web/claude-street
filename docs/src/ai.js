// CPU sencilla para jugar solo (o para probar).
import { ACTIONS } from './input.js';

const blank = () => Object.fromEntries([...ACTIONS, 'fwd', 'back'].map((a) => [a, false]));

export class AI {
  constructor() {
    this.cool = 40;
    this.guardT = 0;
    this.plan = null;
    this.recent = Object.fromEntries(ACTIONS.map((a) => [a, 99]));
  }

  think(me, opp) {
    const held = blank(), pressed = blank();
    const press = (a) => { pressed[a] = true; held[a] = true; };
    const dx = opp.pos.x - me.pos.x, dz = opp.pos.z - me.pos.z;
    const dist = Math.hypot(dx, dz);
    this.cool--;

    // continuar un combo
    if (me.state === 'attack' && this.plan && me.attack.chain) {
      const A = me.attack;
      if (me.f === A.s + A.a) { press(this.plan.shift()); if (!this.plan.length) this.plan = null; }
    }

    if (this.guardT > 0) {
      this.guardT--;
      held.guard = true;
      held.down = this.guardLow;
    } else if (['idle', 'walk', 'crouch', 'guard', 'crouchGuard'].includes(me.state)) {
      // reaccionar a un ataque
      if (opp.state === 'attack' && opp.f < opp.attack.s && dist < 1.8 && Math.random() < 0.08) {
        if (Math.random() < 0.25) press(Math.random() < 0.5 ? 'sideIn' : 'sideOut');
        else { this.guardT = 18; this.guardLow = !!opp.attack.crouch; held.guard = true; held.down = this.guardLow; }
      } else if (dist > 1.25) {
        held.fwd = true;
        if (dist < 2.6 && Math.random() < 0.006) press('up');
        if (Math.random() < 0.004) press(Math.random() < 0.5 ? 'sideIn' : 'sideOut');
      } else if (this.cool <= 0) {
        const r = Math.random();
        if (r < 0.28) { press('punch'); this.plan = Math.random() < 0.5 ? ['punch', 'kick'] : Math.random() < 0.5 ? ['kick'] : null; }
        else if (r < 0.45) press('kick');
        else if (r < 0.55) { held.down = true; press('punch'); }
        else if (r < 0.65) { held.down = true; press('kick'); }
        else if (r < 0.75) { held.fwd = true; press('kick'); }
        else if (r < 0.83) { held.fwd = true; press('punch'); }
        else if (r < 0.9) { held.guard = true; press('punch'); }
        else { held.back = true; }
        this.cool = 22 + Math.random() * 30;
      } else if (Math.random() < 0.3) {
        held.guard = true;
      }
    } else if (me.state === 'thrown' && Math.random() < 0.15) {
      press('guard');
    }

    for (const a of ACTIONS) this.recent[a] = pressed[a] ? 0 : this.recent[a] + 1;
    return { held, pressed, recent: this.recent };
  }
}
