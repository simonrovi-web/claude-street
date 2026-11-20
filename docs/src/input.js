// Teclado (dos jugadores en el mismo teclado) + mandos (Gamepad API).
export const ACTIONS = ['left', 'right', 'up', 'down', 'sideIn', 'sideOut', 'punch', 'kick', 'guard'];

export const KEYMAPS = [
  { left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'], sideIn: ['KeyQ'], sideOut: ['KeyE'],
    punch: ['KeyF'], kick: ['KeyG'], guard: ['KeyH'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
    sideIn: ['KeyI', 'Numpad4'], sideOut: ['KeyO', 'Numpad5'],
    punch: ['KeyK', 'Numpad1'], kick: ['KeyL', 'Numpad2'], guard: ['Semicolon', 'Numpad3'] },
];

const empty = () => Object.fromEntries(ACTIONS.map((a) => [a, false]));

export class Input {
  constructor() {
    this.down = new Set();
    this.queued = new Set();
    this.players = [0, 1].map(() => ({
      held: empty(), pressed: empty(), prevPad: empty(),
      recent: Object.fromEntries(ACTIONS.map((a) => [a, 99])),
    }));
    const block = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
    addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
      if (!e.repeat) this.queued.add(e.code);
      this.down.add(e.code);
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
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
        const keyPressed = map[a].some((c) => this.queued.has(c));
        const padHeld = pad ? pad[a] : false;
        const padPressed = padHeld && !pl.prevPad[a];
        pl.prevPad[a] = padHeld;
        pl.held[a] = keyHeld || padHeld || keyPressed;
        pl.pressed[a] = keyPressed || padPressed;
        pl.recent[a] = pl.pressed[a] ? 0 : pl.recent[a] + 1;
      }
    });
    this.queued.clear();
  }

  anyPressed(...codes) { return codes.some((c) => this.queued.has(c)); }
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
  recent: Object.fromEntries(ACTIONS.map((a) => [a, 99])),
};
