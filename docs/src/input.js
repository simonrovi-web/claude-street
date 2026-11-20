// Teclado (dos jugadores en el mismo teclado), mandos (Gamepad API),
// controles táctiles (jugador local) y entrada remota (modo online).
export const ACTIONS = ['left', 'right', 'up', 'down', 'sideIn', 'sideOut', 'punch', 'kick', 'guard'];

export const KEYMAPS = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], sideIn: ['KeyQ'], sideOut: ['KeyE'],
    punch: ['KeyF'], kick: ['KeyG'], guard: ['KeyH'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    sideIn: ['KeyI', 'Numpad4'], sideOut: ['KeyO', 'Numpad5'],
    punch: ['KeyK', 'Numpad1'], kick: ['KeyL', 'Numpad2'], guard: ['Semicolon', 'Numpad3'] },
];

const empty = () => Object.fromEntries(ACTIONS.map((a) => [a, false]));
const far = () => Object.fromEntries(ACTIONS.map((a) => [a, 99]));

export function toMask(o) {
  let m = 0;
  ACTIONS.forEach((a, i) => { if (o[a]) m |= 1 << i; });
  return m;
}
export function fromMask(m) {
  const o = {};
  ACTIONS.forEach((a, i) => { o[a] = !!(m & (1 << i)); });
  return o;
}

export class Input {
  constructor() {
    this.down = new Set();
    this.queued = new Set();
    this.touch = { held: empty(), queued: empty() };
    this.players = [0, 1].map(() => ({ held: empty(), pressed: empty(), prevPad: empty(), recent: far() }));
    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
    addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (block.has(e.code)) e.preventDefault();
      if (!e.repeat) this.queued.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => { this.down.clear(); this.touch.held = empty(); });
  }

  padState(i) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && pads[i];
    if (!p) return null;
    const b = (n) => !!(p.buttons[n] && p.buttons[n].pressed);
    const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
    return {
      left: ax < -0.5 || b(14), right: ax > 0.5 || b(15), up: ay < -0.6 || b(12), down: ay > 0.6 || b(13),
      sideIn: b(4), sideOut: b(5), punch: b(2), kick: b(0), guard: b(1) || b(7),
    };
  }

  // Se llama una vez por paso fijo de simulación.
  poll() {
    this.players.forEach((pl, i) => {
      const map = KEYMAPS[i];
      const pad = this.padState(i);
      for (const a of ACTIONS) {
        const keyHeld = map[a].some((c) => this.down.has(c));
        let keyPressed = map[a].some((c) => this.queued.has(c));
        let held = keyHeld || keyPressed;
        if (i === 0) { // los controles táctiles son siempre del jugador local
          held = held || this.touch.held[a] || this.touch.queued[a];
          keyPressed = keyPressed || this.touch.queued[a];
        }
        const padHeld = pad ? pad[a] : false;
        const padPressed = padHeld && !pl.prevPad[a];
        pl.prevPad[a] = padHeld;
        pl.held[a] = held || padHeld;
        pl.pressed[a] = keyPressed || padPressed;
        pl.recent[a] = pl.pressed[a] ? 0 : pl.recent[a] + 1;
      }
    });
    this.queued.clear();
    this.touch.queued = empty();
  }
}

// Entrada del rival que llega por la red (la recibe el anfitrión).
export class RemoteInput {
  constructor() { this.reset(); }
  reset() { this.held = empty(); this.pressed = empty(); this.recent = far(); this.pend = 0; }
  receive(h, p) { this.held = fromMask(h); this.pend |= p; }
  poll() {
    const p = fromMask(this.pend);
    this.pend = 0;
    for (const a of ACTIONS) {
      this.pressed[a] = p[a];
      if (p[a]) this.held[a] = true;
      this.recent[a] = p[a] ? 0 : this.recent[a] + 1;
    }
  }
}

// Convierte izquierda/derecha de pantalla en adelante/atrás según el lado del rival.
export function toFighterInput(raw, oppOnRight) {
  const held = { ...raw.held, fwd: oppOnRight ? raw.held.right : raw.held.left, back: oppOnRight ? raw.held.left : raw.held.right };
  const pressed = { ...raw.pressed, fwd: oppOnRight ? raw.pressed.right : raw.pressed.left, back: oppOnRight ? raw.pressed.left : raw.pressed.right };
  return { held, pressed, recent: raw.recent };
}

export const NO_INPUT = {
  held: { ...empty(), fwd: false, back: false },
  pressed: { ...empty(), fwd: false, back: false },
  recent: far(),
};

// ---------------------------------------------------------------- controles táctiles
export function setupTouch(input, root) {
  const T = input.touch;
  // botones
  root.querySelectorAll('[data-a]').forEach((btn) => {
    const a = btn.dataset.a;
    const on = (e) => { e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (_) { /* sin captura */ } T.held[a] = true; T.queued[a] = true; btn.classList.add('on'); if (navigator.vibrate) navigator.vibrate(8); };
    const off = (e) => { e.preventDefault(); T.held[a] = false; btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('lostpointercapture', off);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  // joystick
  const stick = root.querySelector('#stick'), knob = stick.querySelector('.knob');
  let id = null, cx = 0, cy = 0;
  const dirs = ['left', 'right', 'up', 'down'];
  const set = (dx, dy) => {
    const r = stick.clientWidth / 2;
    const len = Math.hypot(dx, dy), max = r * 0.6;
    const k = len > max ? max / len : 1;
    knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    const th = r * 0.28;
    const next = { left: dx < -th, right: dx > th, up: dy < -r * 0.45, down: dy > r * 0.38 };
    for (const d of dirs) {
      if (next[d] && !T.held[d]) T.queued[d] = true;
      T.held[d] = next[d];
    }
  };
  stick.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    id = e.pointerId;
    try { stick.setPointerCapture(id); } catch (_) { /* sin captura */ }
    const b = stick.getBoundingClientRect();
    cx = b.left + b.width / 2; cy = b.top + b.height / 2;
    set(e.clientX - cx, e.clientY - cy);
  });
  stick.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); });
  const end = (e) => { if (e.pointerId !== id) return; id = null; set(0, 0); };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
}
