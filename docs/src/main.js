import * as THREE from 'three';
import { Fighter, MAX_HP, RING_TOP } from './fighter.js';
import { Input, RemoteInput, toFighterInput, NO_INPUT, toMask, setupTouch } from './input.js';
import { ATTACKS } from './poses.js';
import { Sfx } from './audio.js';
import { AI } from './ai.js';
import { Net, cleanCode } from './net.js';
import { setupEnvironment, loadArena, loadCrowd, updateCrowd, FX } from './arena.js';

const ROUND_TIME = 45;     // segundos
const ROUNDS_TO_WIN = 2;
const STEP = 1 / 60;
const TOUCH = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', TOUCH);

// ---------------------------------------------------------------- render
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !TOUCH || devicePixelRatio < 2 });
renderer.setPixelRatio(Math.min(devicePixelRatio, TOUCH ? 1.5 : 2));
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
  // en pantallas estrechas (móvil en vertical) abrimos el ángulo para que quepan los dos
  camera.fov = camera.aspect < 1 ? 62 : 42;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const env = setupEnvironment(scene, TOUCH ? 1024 : 2048);
const fx = new FX(scene);
const sfx = new Sfx();
const input = new Input();
const remote = new RemoteInput();
const net = new Net();

const fighters = [
  new Fighter(scene, { name: 'KAITO', gi: 0xb8231c, pants: 0xa21e18, belt: 0x161616, skin: 0xe0ac84, hair: 0x1a1410, glove: 0x2a2a2a, shoe: 0x1c1c1c, hairStyle: 'spiky' }, 0),
  new Fighter(scene, { name: 'RINA', gi: 0x2a5fd0, pants: 0x1c2f6e, belt: 0xf0f0f0, skin: 0xf1c7a6, hair: 0x5a2e14, glove: 0xf0f0f0, shoe: 0xf0f0f0, hairStyle: 'ponytail' }, 1),
];
fighters.forEach((f) => scene.add(f.blob));

// ---------------------------------------------------------------- HUD
const $ = (s) => document.querySelector(s);
const hud = $('#hud'), menu = $('#menu'), pauseEl = $('#pause'), announceEl = $('#announce'), subEl = $('#sub'), timerEl = $('#timer');
const onlineEl = $('#online'), endEl = $('#end'), touchEl = $('#touch');
const bars = [0, 1].map((i) => ({
  fill: $(`.p${i + 1} .fill`), trail: $(`.p${i + 1} .trail`), wins: [...document.querySelectorAll(`.p${i + 1} .wins i`)], trailV: 1,
}));
setupTouch(input, touchEl);

// Todo lo que se ve u oye durante el combate pasa por aquí: en online el anfitrión
// lo reenvía al invitado para que lo reproduzca igual.
const outbox = [];
const isHost = () => G.mode === 'online' && net.role === 'host';
const isGuest = () => G.mode === 'online' && net.role === 'guest';
const ser = (v) => (v && v.isVector3 ? { v: [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)] } : v);
const des = (v) => (v && v.v ? new THREE.Vector3(...v.v) : v);
function recorder(target, kind) {
  return new Proxy(target, {
    get(t, k) {
      const val = t[k];
      if (typeof val !== 'function') return val;
      return (...args) => { if (isHost()) outbox.push([kind, k, args.map(ser)]); return val.apply(t, args); };
    },
  });
}
const nsfx = recorder(sfx, 's');
const nfx = recorder(fx, 'f');

let announceTimer = 0;
function announce(text, sub = '', frames = 90, cls = '') {
  if (isHost()) outbox.push(['a', text, sub, frames, cls]);
  announceEl.textContent = text;
  announceEl.className = 'show ' + cls;
  subEl.textContent = sub;
  subEl.className = sub ? 'show' : '';
  announceTimer = frames;
}
let popTimer = 0;
const popEl = $('#pop');
function pop(text, side) {
  if (isHost()) outbox.push(['p', text, side]);
  popEl.textContent = text;
  popEl.className = 'show ' + (side === 0 ? 'left' : 'right');
  popTimer = 50;
}
function tickTexts() {
  if (announceTimer > 0 && --announceTimer === 0) { announceEl.className = ''; subEl.className = ''; }
  if (popTimer > 0 && --popTimer === 0) popEl.className = '';
}

// ---------------------------------------------------------------- estado del juego
const G = {
  mode: '2p', phase: 'loading', phaseT: 0, round: 0, timer: ROUND_TIME * 60,
  hitstop: 0, slowmo: 0, shake: 0, camN: new THREE.Vector3(0, 0, 1),
  sfx: nsfx, fx: nfx, ai: null, roundWinner: null, crowd: null,
  onHit(att, def, A, counter) {
    const heavy = A.heavy || A.knockdown || counter || def.dead;
    G.hitstop = heavy ? 9 : 5;
    G.shake = heavy ? 0.12 : 0.04;
    nsfx.hit(heavy);
    nfx.hit(hitPos(att, A), heavy, false);
    if (G.crowd) G.crowd.excite = Math.min(1, G.crowd.excite + (heavy ? 0.35 : 0.12));
    if (counter) pop('¡CONTRAATAQUE!', att.index);
    combo[att.index]++;
    if (combo[att.index] >= 3) pop(`${combo[att.index]} GOLPES`, att.index);
    combo[def.index] = 0;
  },
  onBlock(att, def, A) {
    G.hitstop = 4;
    nsfx.block();
    nfx.hit(hitPos(att, A), false, true);
    combo[att.index] = 0;
  },
  onThrowLand(att, def) {
    G.hitstop = 6; G.shake = 0.15;
    nsfx.thud();
    nfx.dust(def.pos);
    if (G.crowd) G.crowd.excite = Math.min(1, G.crowd.excite + 0.4);
    pop('¡LANZAMIENTO!', att.index);
  },
  throwEscape(att, def) {
    nsfx.block();
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
    nsfx.bell();
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
    nsfx.splash();
    nfx.splash(f.pos);
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
  remote.reset();
  bars.forEach((b) => { b.trailV = 1; });
}

function setNames() {
  const you = G.mode === 'online' ? (net.role === 'host' ? 0 : 1) : -1;
  $('.p1 .name').textContent = 'KAITO' + (you === 0 ? ' (TÚ)' : '');
  $('.p2 .name').textContent = 'RINA' + (G.mode === 'cpu' ? ' (CPU)' : you === 1 ? ' (TÚ)' : '');
}

function showFightUi() {
  menu.classList.add('hidden');
  pauseEl.classList.add('hidden');
  onlineEl.classList.add('hidden');
  endEl.classList.add('hidden');
  hud.classList.remove('hidden');
  touchEl.classList.toggle('hidden', !TOUCH || G.mode === '2p');
  $('#btnPause').classList.toggle('hidden', G.mode === 'online');
  setNames();
}

function startMatch(mode) {
  sfx.init();
  G.mode = mode;
  G.ai = mode === 'cpu' ? new AI() : null;
  fighters.forEach((f) => { f.wins = 0; });
  G.round = 0;
  showFightUi();
  if (isHost()) outbox.push(['start']);
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
    if (!w.invulnerable() && w.state !== 'ko') w.setState('victory');
    announce(`${w.name} GANA`, w.hp === MAX_HP ? '¡PERFECTO!' : '', 140, 'win');
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
  nsfx.bell();
}

// ---------------------------------------------------------------- simulación (local o anfitrión)
function step() {
  G.phaseT++;
  tickTexts();

  if (G.phase === 'intro') {
    if (G.phaseT === 85) { announce('¡PELEA!', '', 45, 'fight'); nsfx.bell(); }
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
  if (G.hitstop > 0) { G.hitstop--; sendSnapshot(); return; }
  input.poll();
  remote.poll();

  const camRight = new THREE.Vector3(G.camN.z, 0, -G.camN.x);
  const inputs = fighters.map((f, i) => {
    if (G.phase !== 'fight') return NO_INPUT;
    const opp = fighters[1 - i];
    if (i === 1 && G.ai) return G.ai.think(f, opp);
    const toOpp = new THREE.Vector3().subVectors(opp.pos, f.pos);
    const raw = (i === 1 && G.mode === 'online') ? remote : input.players[i];
    return toFighterInput(raw, toOpp.dot(camRight) > 0);
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
  sendSnapshot();
}

// ---------------------------------------------------------------- red
const r3 = (n) => Math.round(n * 1000) / 1000;
function sendSnapshot() {
  if (!isHost()) return;
  net.send({
    t: 's', ph: G.phase, tm: G.timer, sh: r3(G.shake), ex: r3(G.crowd ? G.crowd.excite : 0),
    f: fighters.map((f) => [r3(f.pos.x), r3(f.pos.y), r3(f.pos.z), r3(f.facing), f.state, f.f, f.hp, f.wins,
      f.flash, f.attackName || '', f.hitLevel || '', f.blockCrouch ? 1 : 0, f.stun || 0, f.walkDir || 1, f.dead ? 1 : 0]),
    ev: outbox.splice(0),
  });
}

function applySnapshot(s) {
  G.phase = s.ph; G.timer = s.tm;
  G.shake = Math.max(G.shake, s.sh);
  if (G.crowd) G.crowd.excite = s.ex;
  s.f.forEach((d, i) => {
    const f = fighters[i];
    f.pos.set(d[0], d[1], d[2]);
    f.facing = d[3]; f.state = d[4]; f.f = d[5]; f.hp = d[6]; f.wins = d[7]; f.flash = d[8];
    f.attackName = d[9]; f.attack = d[9] ? ATTACKS[d[9]] : null;
    f.hitLevel = d[10]; f.blockCrouch = !!d[11]; f.stun = d[12]; f.walkDir = d[13]; f.dead = !!d[14];
    if (f.state !== 'attack') f.attack = null;
  });
  for (const e of s.ev) playEvent(e);
}

function playEvent(e) {
  const [k] = e;
  if (k === 's') { const fn = sfx[e[1]]; if (fn) fn.apply(sfx, e[2].map(des)); }
  else if (k === 'f') { const fn = fx[e[1]]; if (fn) fn.apply(fx, e[2].map(des)); }
  else if (k === 'a') announce(e[1], e[2], e[3], e[4]);
  else if (k === 'p') pop(e[1], e[2]);
  else if (k === 'start') { fighters.forEach((f) => f.reset(f.index ? 1.5 : -1.5, f.index ? -Math.PI / 2 : Math.PI / 2)); G.camN.set(0, 0, 1); showFightUi(); }
  else if (k === 'end') showEndPanel(e[1]);
}

let guestAcc = 0;
function guestStep() {
  input.poll();
  const p = input.players[0];
  net.send({ t: 'i', h: toMask(p.held), p: toMask(p.pressed) });
  tickTexts();
}

net.on('data', (d) => {
  if (!d || !d.t) return;
  if (net.role === 'host') {
    if (d.t === 'i') remote.receive(d.h, d.p);
    else if (d.t === 'rematch' && G.phase === 'matchEnd') startMatch('online');
  } else if (d.t === 's') {
    applySnapshot(d);
  }
});
net.on('connected', () => {
  if (net.role === 'host') {
    setOnlineStatus('¡Rival conectado!');
    startMatch('online');
  } else {
    setOnlineStatus('Conectado. Esperando al anfitrión…');
    G.mode = 'online';
    sfx.init();
  }
});
net.on('closed', () => {
  if (G.mode === 'online') {
    toMenu();
    showOnline();
    setOnlineStatus('Se perdió la conexión con el rival.');
  }
});
net.on('error', (e) => {
  const msg = {
    'peer-unavailable': 'No existe ninguna sala con ese código.',
    network: 'No hay conexión con el servidor. Revisa tu internet.',
    'server-error': 'El servidor de conexión no responde. Prueba de nuevo.',
    'browser-incompatible': 'Este navegador no permite jugar online.',
  }[e.type] || 'No se pudo conectar. Prueba de nuevo.';
  setOnlineStatus(msg);
  $('#btnConnect').disabled = false;
});

// ---------------------------------------------------------------- cámara
const camPos = new THREE.Vector3(0, 3, 9), camLook = new THREE.Vector3(0, 1.8, 0);
function updateCamera(dt, snap = false) {
  const [a, b] = fighters;
  const mid = new THREE.Vector3().addVectors(a.pos, b.pos).multiplyScalar(0.5);
  mid.y = Math.max(RING_TOP, Math.min(a.pos.y, b.pos.y));
  const axis = new THREE.Vector3(b.pos.x - a.pos.x, 0, b.pos.z - a.pos.z);
  const len = axis.length();
  const inMenu = G.phase === 'menu' || G.phase === 'loading';
  if (len > 0.05 && !inMenu) {
    const n = new THREE.Vector3(-axis.z, 0, axis.x).normalize();
    if (n.dot(G.camN) < 0) n.negate();
    G.camN.lerp(n, 1 - Math.pow(0.94, dt * 60)).normalize();
  }
  let pos, look;
  if (inMenu) {
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
  timerEl.textContent = Math.max(0, Math.ceil(G.timer / 60));
  timerEl.classList.toggle('low', G.timer < 10 * 60);
}

// ---------------------------------------------------------------- menús
function showEndPanel(name) {
  G.phase = 'matchEnd';
  $('#endTitle').textContent = `¡${name} GANA EL COMBATE!`;
  touchEl.classList.add('hidden');
  endEl.classList.remove('hidden');
}
function showMatchEnd() {
  const w = fighters.find((f) => f.wins >= ROUNDS_TO_WIN);
  if (isHost()) outbox.push(['end', w.name]);
  showEndPanel(w.name);
}
function toMenu() {
  if (G.mode === 'online') net.close();
  G.mode = '2p';
  G.phase = 'menu';
  hud.classList.add('hidden');
  pauseEl.classList.add('hidden');
  endEl.classList.add('hidden');
  onlineEl.classList.add('hidden');
  touchEl.classList.add('hidden');
  menu.classList.remove('hidden');
  announceEl.className = ''; subEl.className = ''; popEl.className = '';
  resetRound();
}
function togglePause() {
  if (G.mode === 'online') return; // en online no se pausa
  if (G.phase === 'paused') { G.phase = G.pausedFrom; pauseEl.classList.add('hidden'); }
  else if (['fight', 'intro', 'ko', 'roundEnd'].includes(G.phase)) { G.pausedFrom = G.phase; G.phase = 'paused'; pauseEl.classList.remove('hidden'); }
}
function goFullscreen() {
  if (!TOUCH) return;
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (req && !document.fullscreenElement) {
    Promise.resolve(req.call(el)).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
  }
}

// --- online
function setOnlineStatus(t) { $('#onStatus').textContent = t; }
function showOnline() {
  menu.classList.add('hidden');
  onlineEl.classList.remove('hidden');
  $('#onChoose').classList.remove('hidden');
  $('#onHost').classList.add('hidden');
  $('#onJoin').classList.add('hidden');
  setOnlineStatus('');
}
$('#btnOnline').addEventListener('click', () => { sfx.init(); showOnline(); });
$('#btnHost').addEventListener('click', async () => {
  goFullscreen();
  $('#onChoose').classList.add('hidden');
  $('#onHost').classList.remove('hidden');
  $('#roomCode').textContent = '····';
  setOnlineStatus('Creando sala…');
  try {
    const code = await net.host();
    $('#roomCode').textContent = code;
    const link = `${location.origin}${location.pathname}?sala=${code}`;
    $('#shareLink').dataset.link = link;
    setOnlineStatus('Esperando a que tu rival se una…');
  } catch (e) { /* el mensaje lo pone net.on('error') */ }
});
$('#shareLink').addEventListener('click', async () => {
  const link = $('#shareLink').dataset.link;
  if (!link) return;
  try {
    if (navigator.share) await navigator.share({ title: 'Claude Street', text: '¡Pelea conmigo!', url: link });
    else { await navigator.clipboard.writeText(link); setOnlineStatus('Enlace copiado. Envíaselo a tu rival.'); }
  } catch (e) { /* compartir cancelado */ }
});
$('#btnJoin').addEventListener('click', () => {
  $('#onChoose').classList.add('hidden');
  $('#onJoin').classList.remove('hidden');
  $('#codeInput').focus();
});
async function joinRoom(code) {
  code = cleanCode(code);
  if (code.length !== 4) { setOnlineStatus('El código tiene 4 caracteres.'); return; }
  goFullscreen();
  $('#btnConnect').disabled = true;
  setOnlineStatus('Conectando…');
  try { await net.join(code); } catch (e) { /* mensaje en net.on('error') */ }
  $('#btnConnect').disabled = false;
}
$('#btnConnect').addEventListener('click', () => joinRoom($('#codeInput').value));
$('#codeInput').addEventListener('input', (e) => { e.target.value = cleanCode(e.target.value); });
$('#codeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(e.target.value); });

document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { goFullscreen(); startMatch(b.dataset.mode); }));
$('#resume').addEventListener('click', togglePause);
$('#btnPause').addEventListener('click', togglePause);
document.querySelectorAll('.toMenu').forEach((b) => b.addEventListener('click', toMenu));
function rematch() {
  if (isGuest()) { net.send({ t: 'rematch' }); setEndStatus('Revancha pedida…'); return; }
  startMatch(G.mode);
}
function setEndStatus(t) { $('#endStatus').textContent = t; }
$('#rematch').addEventListener('click', rematch);
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'Escape') togglePause();
  if (e.code === 'Enter') {
    if (G.phase === 'menu' && !menu.classList.contains('hidden')) startMatch('2p');
    else if (G.phase === 'matchEnd') rematch();
  }
});

// ---------------------------------------------------------------- bucle
let arena = null;
let acc = 0, last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (isGuest()) {
    guestAcc += dt;
    while (guestAcc >= STEP) { guestAcc -= STEP; guestStep(); }
  } else if (!['paused', 'menu', 'loading', 'matchEnd'].includes(G.phase)) {
    acc += dt * (G.slowmo > 0 ? 0.35 : 1);
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
  const paused = G.phase === 'paused';
  if (G.crowd) { updateCrowd(G.crowd, paused ? 0 : dt); sfx.crowd(G.crowd.excite); }
  fighters.forEach((f) => f.render(paused ? 0 : dt));
  fx.update(paused ? 0 : dt);
  updateCamera(dt);
  updateHud();
  renderer.render(scene, camera);
}

(async () => {
  try {
    arena = await loadArena(scene);
    G.crowd = await loadCrowd(scene, 'assets/', TOUCH ? 0.6 : 1);
  } catch (err) {
    console.error(err);
    $('#loading').textContent = 'No se pudo cargar la arena. Abre el juego desde un servidor web (ver README).';
    return;
  }
  $('#loading').classList.add('hidden');
  resetRound();
  G.phase = 'menu';
  updateCamera(0, true);
  // enlace de invitación: ?sala=CODIGO
  const code = cleanCode(new URLSearchParams(location.search).get('sala'));
  if (code.length === 4) {
    showOnline();
    $('#onChoose').classList.add('hidden');
    $('#onJoin').classList.remove('hidden');
    $('#codeInput').value = code;
    setOnlineStatus('Te han invitado a una sala. Pulsa Conectar.');
  } else {
    menu.classList.remove('hidden');
  }
})();
requestAnimationFrame(frame);

// para depurar desde la consola
window.__game = {
  G, fighters, startMatch, input, net,
  advance(n = 1) { for (let i = 0; i < n; i++) { step(); fighters.forEach((f) => f.render(STEP)); fx.update(STEP); } },
};
