import * as THREE from 'three';
import { Fighter, MAX_HP, RING_TOP } from './fighter.js';
import { Input, toFighterInput, NO_INPUT } from './input.js';
import { Sfx } from './audio.js';
import { AI } from './ai.js';
import { setupEnvironment, loadArena, loadCrowd, updateCrowd, FX } from './arena.js';

const ROUND_TIME = 45;     // segundos
const ROUNDS_TO_WIN = 2;
const STEP = 1 / 60;

// ---------------------------------------------------------------- render
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const env = setupEnvironment(scene);
const fx = new FX(scene);
const sfx = new Sfx();
const input = new Input();

const fighters = [
  new Fighter(scene, { name: 'KAITO', gi: 0xb8231c, pants: 0xa21e18, belt: 0x161616, skin: 0xe0ac84, hair: 0x1a1410, glove: 0x2a2a2a, shoe: 0x1c1c1c, hairStyle: 'spiky' }, 0),
  new Fighter(scene, { name: 'RINA', gi: 0x2a5fd0, pants: 0x1c2f6e, belt: 0xf0f0f0, skin: 0xf1c7a6, hair: 0x5a2e14, glove: 0xf0f0f0, shoe: 0xf0f0f0, hairStyle: 'ponytail' }, 1),
];
fighters.forEach((f) => scene.add(f.blob));

// ---------------------------------------------------------------- HUD
const $ = (s) => document.querySelector(s);
const hud = $('#hud'), menu = $('#menu'), pauseEl = $('#pause'), announceEl = $('#announce'), subEl = $('#sub'), timerEl = $('#timer');
const bars = [0, 1].map((i) => ({
  fill: $(`.p${i + 1} .fill`), trail: $(`.p${i + 1} .trail`), wins: [...document.querySelectorAll(`.p${i + 1} .wins i`)], trailV: 1,
}));
let announceTimer = 0;
function announce(text, sub = '', frames = 90, cls = '') {
  announceEl.textContent = text;
  announceEl.className = 'show ' + cls;
  subEl.textContent = sub;
  subEl.className = sub ? 'show' : '';
  announceTimer = frames;
}
let popTimer = 0;
const popEl = $('#pop');
function pop(text, side) {
  popEl.textContent = text;
  popEl.className = 'show ' + (side === 0 ? 'left' : 'right');
  popTimer = 50;
}

// ---------------------------------------------------------------- estado del juego
const G = {
  mode: '2p', phase: 'loading', phaseT: 0, round: 0, timer: 0,
  hitstop: 0, slowmo: 0, shake: 0, camN: new THREE.Vector3(0, 0, 1),
  sfx, fx, ai: null, roundWinner: null, crowd: null,
  onHit(att, def, A, counter) {
    const heavy = A.heavy || A.knockdown || counter || def.dead;
    G.hitstop = heavy ? 9 : 5;
    G.shake = heavy ? 0.12 : 0.04;
    sfx.hit(heavy);
    fx.hit(hitPos(att, A), heavy, false);
    if (G.crowd) G.crowd.excite = Math.min(1, G.crowd.excite + (heavy ? 0.35 : 0.12));
    if (counter) pop('¡CONTRAATAQUE!', att.index);
    combo[att.index]++;
    if (combo[att.index] >= 3) pop(`${combo[att.index]} GOLPES`, att.index);
    combo[def.index] = 0;
  },
  onBlock(att, def, A) {
    G.hitstop = 4;
    sfx.block();
    fx.hit(hitPos(att, A), false, true);
    combo[att.index] = 0;
  },
  onThrowLand(att, def) {
    G.hitstop = 6; G.shake = 0.15;
    sfx.thud();
    fx.dust(def.pos);
    if (G.crowd) G.crowd.excite = Math.min(1, G.crowd.excite + 0.4);
    pop('¡LANZAMIENTO!', att.index);
  },
  throwEscape(att, def) {
    sfx.block();
    const f = att.fwd();
    def.pos.y = RING_TOP;
    for (const [x, s] of [[att, -1], [def, 1]]) { x.stun = 12; x.blockCrouch = false; x.setState('blockstun'); x.vel.set(f.x * 0.08 * s, 0, f.z * 0.08 * s); }
    pop('¡ESCAPE!', def.index);
  },
  onKO(loser) {
    if (G.phase !== 'fight') return;
    G.phase = 'ko'; G.phaseT = 0;
    G.roundWinner = fighters[1 - loser.index];
    G.slowmo = 80;
    G.hitstop = 14;
    announce('K.O.', '', 150, 'ko');
    sfx.bell();
    if (G.crowd) G.crowd.excite = 1;
  },
  onRingOut(loser) {
    if (G.phase !== 'fight') return;
    G.phase = 'ko'; G.phaseT = 0;
    G.roundWinner = fighters[1 - loser.index];
    announce('RING OUT', '', 150, 'ko');
    if (G.crowd) G.crowd.excite = 1;
  },
  onSplash(f) {
    sfx.splash();
    fx.splash(f.pos);
    G.shake = 0.1;
  },
};
const combo = [0, 0];

function hitPos(att, A) {
  const f = att.attackFwd || att.fwd();
  const h = A.level === 'high' ? 1.55 : A.level === 'low' ? 0.35 : 1.1;
  return att.pos.clone().addScaledVector(f, Math.min(A.reach, 0.9)).setY(att.pos.y + h);
}

function resetRound() {
  fighters[0].reset(-1.5, Math.PI / 2);
  fighters[1].reset(1.5, -Math.PI / 2);
  G.camN.set(0, 0, 1);
  G.timer = ROUND_TIME * 60;
  G.hitstop = 0; G.slowmo = 0;
  combo[0] = combo[1] = 0;
  bars.forEach((b) => { b.trailV = 1; });
}

function startMatch(mode) {
  sfx.init();
  G.mode = mode;
  G.ai = mode === 'cpu' ? new AI() : null;
  fighters.forEach((f) => { f.wins = 0; });
  G.round = 0;
  menu.classList.add('hidden');
  pauseEl.classList.add('hidden');
  hud.classList.remove('hidden');
  $('.p2 .name').textContent = mode === 'cpu' ? 'RINA (CPU)' : 'RINA';
  startRound();
}

function startRound() {
  G.round++;
  resetRound();
  G.phase = 'intro'; G.phaseT = 0;
  const last = fighters.every((f) => f.wins === ROUNDS_TO_WIN - 1);
  announce(last ? 'RONDA FINAL' : `RONDA ${G.round}`, '', 80);
}

function endRound() {
  const w = G.roundWinner;
  if (w) {
    w.wins++;
    if (!w.invulnerable() && w.state !== 'ko') { w.setState('victory'); }
    const perfect = w.hp === MAX_HP;
    announce(`${w.name} GANA`, perfect ? '¡PERFECTO!' : '', 140, 'win');
  } else {
    announce('EMPATE', '', 120, 'win');
  }
  G.phase = 'roundEnd'; G.phaseT = 0;
}

function timeOver() {
  G.phase = 'ko'; G.phaseT = 0;
  const [a, b] = fighters;
  G.roundWinner = a.hp === b.hp ? null : a.hp > b.hp ? a : b;
  announce('TIEMPO', '', 120, 'ko');
  sfx.bell();
}

// ---------------------------------------------------------------- simulación
function step() {
  G.phaseT++;
  if (announceTimer > 0 && --announceTimer === 0) { announceEl.className = ''; subEl.className = ''; }
  if (popTimer > 0 && --popTimer === 0) popEl.className = '';

  if (G.phase === 'intro') {
    if (G.phaseT === 85) { announce('¡PELEA!', '', 45, 'fight'); sfx.bell(); }
    if (G.phaseT >= 100) G.phase = 'fight';
  } else if (G.phase === 'fight') {
    if (--G.timer <= 0) timeOver();
  } else if (G.phase === 'ko') {
    if (G.phaseT >= 170) endRound();
  } else if (G.phase === 'roundEnd') {
    if (G.phaseT >= 150) {
      if (fighters.some((f) => f.wins >= ROUNDS_TO_WIN)) showMatchEnd();
      else startRound();
    }
  }

  // durante el hitstop no se leen las teclas: quedan en cola para encadenar combos
  if (G.hitstop > 0) { G.hitstop--; return; }
  input.poll();

  const camRight = new THREE.Vector3(G.camN.z, 0, -G.camN.x);
  const inputs = fighters.map((f, i) => {
    if (G.phase !== 'fight') return NO_INPUT;
    const opp = fighters[1 - i];
    if (i === 1 && G.ai) return G.ai.think(f, opp);
    const toOpp = new THREE.Vector3().subVectors(opp.pos, f.pos);
    return toFighterInput(input.players[i], toOpp.dot(camRight) > 0);
  });
  fighters[0].update(inputs[0], fighters[1], G);
  fighters[1].update(inputs[1], fighters[0], G);

  // empuje entre cuerpos
  const [a, b] = fighters;
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
  const d = Math.hypot(dx, dz);
  const solid = (f) => !['knockdown', 'ko', 'ringout', 'thrown'].includes(f.state);
  if (d < 0.6 && d > 1e-4 && solid(a) && solid(b) && Math.abs(a.pos.y - b.pos.y) < 1.2) {
    const push = (0.6 - d) / 2;
    a.pos.x -= dx / d * push; a.pos.z -= dz / d * push;
    b.pos.x += dx / d * push; b.pos.z += dz / d * push;
  }

  if (G.crowd) G.crowd.excite = Math.max(0.15, G.crowd.excite - 0.004);
}

// ---------------------------------------------------------------- cámara
const camPos = new THREE.Vector3(0, 3, 9), camLook = new THREE.Vector3(0, 1.8, 0);
function updateCamera(dt, snap = false) {
  const [a, b] = fighters;
  const mid = new THREE.Vector3().addVectors(a.pos, b.pos).multiplyScalar(0.5);
  mid.y = Math.max(RING_TOP, Math.min(a.pos.y, b.pos.y));
  const axis = new THREE.Vector3(b.pos.x - a.pos.x, 0, b.pos.z - a.pos.z);
  const len = axis.length();
  if (len > 0.05 && G.phase !== 'menu') {
    const n = new THREE.Vector3(-axis.z, 0, axis.x).normalize();
    if (n.dot(G.camN) < 0) n.negate();
    G.camN.lerp(n, 1 - Math.pow(0.94, dt * 60)).normalize();
  }
  let pos, look;
  if (G.phase === 'menu' || G.phase === 'loading') {
    const t = performance.now() * 0.00008;
    pos = new THREE.Vector3(Math.sin(t) * 14, 5.5, Math.cos(t) * 14);
    look = new THREE.Vector3(0, 1.5, 0);
  } else {
    const dist = THREE.MathUtils.clamp(4.2 + len * 0.85, 5.6, 10.5);
    look = mid.clone().add(new THREE.Vector3(0, 0.9, 0));
    pos = mid.clone().addScaledVector(G.camN, dist).add(new THREE.Vector3(0, 1.9 + len * 0.12, 0));
  }
  const k = snap ? 1 : 1 - Math.pow(0.9, dt * 60);
  camPos.lerp(pos, k);
  camLook.lerp(look, k);
  camera.position.copy(camPos);
  if (G.shake > 0) {
    camera.position.x += (Math.random() - 0.5) * G.shake;
    camera.position.y += (Math.random() - 0.5) * G.shake;
    G.shake = Math.max(0, G.shake - dt * 0.6);
  }
  camera.lookAt(camLook);
}

// ---------------------------------------------------------------- HUD
function updateHud() {
  fighters.forEach((f, i) => {
    const v = f.hp / MAX_HP;
    const b = bars[i];
    b.fill.style.width = (v * 100) + '%';
    b.fill.classList.toggle('low', v < 0.3);
    if (G.hitstop === 0) b.trailV += (v - b.trailV) * 0.04;
    if (b.trailV < v) b.trailV = v;
    b.trail.style.width = (b.trailV * 100) + '%';
    b.wins.forEach((el, k) => el.classList.toggle('on', k < f.wins));
  });
  timerEl.textContent = Math.ceil(G.timer / 60);
  timerEl.classList.toggle('low', G.timer < 10 * 60);
}

// ---------------------------------------------------------------- menús
function showMatchEnd() {
  const w = fighters.find((f) => f.wins >= ROUNDS_TO_WIN);
  G.phase = 'matchEnd';
  $('#endTitle').textContent = `¡${w.name} GANA EL COMBATE!`;
  $('#end').classList.remove('hidden');
}
function toMenu() {
  G.phase = 'menu';
  hud.classList.add('hidden');
  pauseEl.classList.add('hidden');
  $('#end').classList.add('hidden');
  menu.classList.remove('hidden');
  announceEl.className = ''; subEl.className = '';
  resetRound();
}
function togglePause() {
  if (G.phase === 'paused') { G.phase = G.pausedFrom; pauseEl.classList.add('hidden'); }
  else if (['fight', 'intro', 'ko', 'roundEnd'].includes(G.phase)) { G.pausedFrom = G.phase; G.phase = 'paused'; pauseEl.classList.remove('hidden'); }
}
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => startMatch(b.dataset.mode)));
$('#resume').addEventListener('click', togglePause);
document.querySelectorAll('.toMenu').forEach((b) => b.addEventListener('click', toMenu));
$('#rematch').addEventListener('click', () => { $('#end').classList.add('hidden'); startMatch(G.mode); });
addEventListener('keydown', (e) => {
  if (e.code === 'Escape') togglePause();
  if (e.code === 'Enter') {
    if (G.phase === 'menu') startMatch('2p');
    else if (G.phase === 'matchEnd') { $('#end').classList.add('hidden'); startMatch(G.mode); }
  }
});

// ---------------------------------------------------------------- bucle
let arena = null;
let acc = 0, last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const running = !['paused', 'menu', 'loading', 'matchEnd'].includes(G.phase);
  if (running) {
    let scale = 1;
    if (G.slowmo > 0) { scale = 0.35; }
    acc += dt * scale;
    while (acc >= STEP) {
      acc -= STEP;
      step();
      if (G.slowmo > 0) G.slowmo--;
    }
  }
  const t = now / 1000;
  env.torches.forEach((l, i) => { l.intensity = 7 + Math.sin(t * 13 + i * 2) * 0.8 + Math.sin(t * 29 + i) * 0.6; });
  if (arena) {
    if (arena.waterTex) { arena.waterTex.offset.x = t * 0.01; arena.waterTex.offset.y = t * 0.006; }
    arena.fires.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 17 + i) * 0.1, 1.4 + Math.sin(t * 11 + i * 3) * 0.25, 1 + Math.cos(t * 15 + i) * 0.1); });
  }
  if (G.crowd) { updateCrowd(G.crowd, G.phase === 'paused' ? 0 : dt); sfx.crowd(G.crowd.excite); }
  fighters.forEach((f) => f.render(G.phase === 'paused' ? 0 : dt));
  fx.update(G.phase === 'paused' ? 0 : dt);
  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
}

(async () => {
  try {
    arena = await loadArena(scene);
    G.crowd = await loadCrowd(scene);
  } catch (err) {
    console.error(err);
    $('#loading').textContent = 'No se pudo cargar la arena. Abre el juego desde un servidor web (ver README).';
    return;
  }
  $('#loading').classList.add('hidden');
  menu.classList.remove('hidden');
  resetRound();
  G.phase = 'menu';
  updateCamera(0, true);
})();
requestAnimationFrame(frame);

// para depurar desde la consola
window.__game = {
  G, fighters, startMatch, input,
  advance(n = 1) { for (let i = 0; i < n; i++) { step(); fighters.forEach((f) => f.render(STEP)); fx.update(STEP); } },
};
