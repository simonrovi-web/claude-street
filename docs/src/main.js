import * as THREE from 'three';
import { Fighter, MAX_HP, RING_TOP, SPECIAL_COST } from './fighter.js';
import { Input, RemoteInput, toFighterInput, NO_INPUT, toMask, setupTouch } from './input.js';
import { ATTACKS, STANCE, over } from './poses.js';
import { ROSTER } from './characters.js';
import { Sfx } from './audio.js';
import { Music, themeFor } from './music.js';
import { AI, LEVELS } from './ai.js';
import { Net, cleanCode } from './net.js';
import { setupEnvironment, loadArena, loadCrowd, updateCrowd, FX, animateSky, animateBanners, setStage, STAGES, STAGE_KEYS } from './arena.js';
import { createPost } from './postfx.js';
import { Trail, Confetti } from './effects.js';

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
renderer.toneMapping = THREE.NeutralToneMapping; // conserva los colores vivos
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
let post = null;
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  if (post) post.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  // en pantallas estrechas (móvil en vertical) abrimos el ángulo para que quepan los dos
  camera.fov = camera.aspect < 1 ? 62 : 42;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const env = setupEnvironment(scene, TOUCH ? 1024 : 2048, renderer);
post = createPost(renderer, scene, camera, { bloom: !TOUCH });
resize();
const fx = new FX(scene);
const sfx = new Sfx();
const music = new Music(sfx);
const input = new Input();
const remote = new RemoteInput();
const net = new Net();

const fighters = [new Fighter(scene, ROSTER[0], 0), new Fighter(scene, ROSTER[1], 1)];
fighters.forEach((f) => scene.add(f.blob));
const TRAIL_COLORS = { kaito: 0xff5a2a, rina: 0x3fb0ff, voss: 0xffc040, nyx: 0xc060ff, torak: 0xff3040, sera: 0xffd060 };
const trails = fighters.map(() => new Trail(scene, 0xffffff));
const confetti = new Confetti(scene);

// ---------------------------------------------------------------- HUD
const $ = (s) => document.querySelector(s);
const hud = $('#hud'), menu = $('#menu'), pauseEl = $('#pause'), announceEl = $('#announce'), subEl = $('#sub'), timerEl = $('#timer');
const onlineEl = $('#online'), endEl = $('#end'), touchEl = $('#touch');
const bars = [0, 1].map((i) => ({
  fill: $(`.p${i + 1} .fill`), trail: $(`.p${i + 1} .trail`), wins: [...document.querySelectorAll(`.p${i + 1} .wins i`)], trailV: 1,
  meter: $(`.p${i + 1} .meter i`), meterBox: $(`.p${i + 1} .meter`),
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
const speedEl = document.getElementById('speed'), flashEl = document.getElementById('flash');
const vfx = {
  speed() { speedEl.classList.remove('show'); void speedEl.offsetWidth; speedEl.classList.add('show'); },
  flash(color = '#ffffff') { flashEl.style.background = color; flashEl.classList.remove('show'); void flashEl.offsetWidth; flashEl.classList.add('show'); },
};
const nvfx = recorder(vfx, 'v');
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
// onomatopeyas de cómic en los golpes fuertes
const COMIC = ['¡PAM!', '¡ZAS!', '¡POW!', '¡TOMA!', '¡CRAC!', '¡BAM!'];
const comicEls = Array.from({ length: 5 }, () => {
  const el = document.createElement('div');
  el.className = 'comic';
  document.body.appendChild(el);
  return el;
});
let comicI = 0;
function comic(pos, word) {
  if (isHost()) outbox.push(['c', ser(pos), word]);
  const v = pos.clone().project(camera);
  if (v.z > 1) return;
  const el = comicEls[comicI++ % comicEls.length];
  el.textContent = word;
  el.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
  el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight - 40) + 'px';
  el.style.setProperty('--rot', ((Math.random() - 0.5) * 30).toFixed(0) + 'deg');
  el.classList.remove('show');
  void el.offsetWidth; // reinicia la animación
  el.classList.add('show');
}
const randWord = () => COMIC[(Math.random() * COMIC.length) | 0];

const comboEls = [document.getElementById('combo1'), document.getElementById('combo2')];
const comboTimers = [0, 0];
function showCombo(side, n, dmg) {
  if (isHost()) outbox.push(['k', side, n, dmg]);
  const el = comboEls[side];
  el.innerHTML = `<b>${n}</b> GOLPES<small>${dmg} de daño</small>`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  comboTimers[side] = 80;
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
  for (let i = 0; i < 2; i++) if (comboTimers[i] > 0 && --comboTimers[i] === 0) comboEls[i].classList.remove('show');
}

// ---------------------------------------------------------------- estado del juego
const G = {
  mode: '2p', phase: 'loading', phaseT: 0, round: 0, timer: ROUND_TIME * 60,
  hitstop: 0, slowmo: 0, shake: 0, camN: new THREE.Vector3(0, 0, 1),
  sfx: nsfx, fx: nfx, ai: null, roundWinner: null, crowd: null, projectiles: [], netProj: [],
  finishAvail: false, finisher: null, finishLoser: null, dummy: 'stand', trainIdle: 0,
  stage: 'atardecer', arcade: null,
  onHit(att, def, A, counter, pos) {
    G.trainIdle = 0;
    if (G.phase === 'finish') { finisherHit(att, def, pos || hitPos(att, A)); return; }
    const heavy = A.heavy || A.knockdown || counter || def.dead;
    G.hitstop = heavy ? 9 : 5;
    G.shake = heavy ? 0.12 : 0.04;
    nsfx.hit(heavy);
    nfx.hit(pos || hitPos(att, A), heavy, false);
    if (heavy) { comic(pos || hitPos(att, A), randWord()); nvfx.speed(); }
    if (!A.special) att.meter = Math.min(100, att.meter + 8);
    def.meter = Math.min(100, def.meter + 6);
    if (G.crowd) G.crowd.excite = Math.min(1, G.crowd.excite + (heavy ? 0.35 : 0.12));
    if (counter) pop('¡CONTRAATAQUE!', att.index);
    combo[att.index]++;
    comboDmg[att.index] += Math.round(A.dmg * att.stats.power * (counter ? 1.25 : 1));
    if (combo[att.index] >= 2) showCombo(att.index, combo[att.index], comboDmg[att.index]);
    combo[def.index] = 0; comboDmg[def.index] = 0;
  },
  onBlock(att, def, A, pos) {
    G.trainIdle = 0;
    G.hitstop = 4;
    nsfx.block();
    nfx.hit(pos || hitPos(att, A), false, true);
    att.meter = Math.min(100, att.meter + 3);
    def.meter = Math.min(100, def.meter + 3);
    combo[att.index] = 0;
  },
  onThrowLand(att, def) {
    G.hitstop = 6; G.shake = 0.15;
    att.meter = Math.min(100, att.meter + 8);
    def.meter = Math.min(100, def.meter + 6);
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
    if (G.mode === 'training') { loser.hp = MAX_HP; loser.dead = false; return; } // en práctica nadie cae
    G.phase = 'ko'; G.phaseT = 0;
    G.roundWinner = fighters[1 - loser.index];
    // en la ronda decisiva se puede rematar
    G.finishAvail = G.roundWinner.wins + 1 >= ROUNDS_TO_WIN;
    G.finisher = G.roundWinner; G.finishLoser = loser;
    G.slowmo = 80;
    G.hitstop = 14;
    announce('K.O.', '', 150, 'ko');
    nsfx.bell();
    if (G.crowd) G.crowd.excite = 1;
  },
  onRingOut(loser) {
    if (G.phase !== 'fight') return;
    G.phase = 'ko'; G.phaseT = 0;
    G.finishAvail = false;
    G.roundWinner = fighters[1 - loser.index];
    announce('RING OUT', '', 150, 'ko');
    if (G.crowd) G.crowd.excite = 1;
  },
  onSpecial(f) {
    // "destello" del especial: congela un instante y anuncia el nombre
    G.hitstop = Math.max(G.hitstop, 12);
    G.shake = 0.06;
    nsfx.special();
    nfx.burst(f.pos, 0xffd060);
    nvfx.flash('rgba(255,255,255,0.75)');
    nvfx.speed();
    pop(f.def.special.name.toUpperCase() + '!', f.index);
    if (G.crowd) G.crowd.excite = Math.min(1, G.crowd.excite + 0.3);
  },
  spawnProjectile(f, A) {
    const dir = f.attackFwd.clone();
    G.projectiles.push({
      owner: f, A, dir, speed: A.projectile.speed, life: A.projectile.life,
      pos: f.pos.clone().addScaledVector(dir, 0.55).add(new THREE.Vector3(0, 1.25, 0)),
    });
    nsfx.zap();
  },
  onSlam(f) {
    G.shake = 0.25;
    nsfx.thud();
    nfx.shock(f.pos.clone(), f.attackFwd.clone());
  },
  onSplash(f) {
    nsfx.splash();
    nfx.splash(f.pos);
    G.shake = 0.1;
  },
};
const combo = [0, 0], comboDmg = [0, 0];

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
  combo[0] = combo[1] = 0; comboDmg[0] = comboDmg[1] = 0;
  G.projectiles.length = 0;
  G.netProj = [];
  remote.reset();
  bars.forEach((b) => { b.trailV = 1; });
}

function setNames() {
  const you = G.mode === 'online' ? (net.role === 'host' ? 0 : 1) : -1;
  $('.p1 .name').textContent = fighters[0].name + (you === 0 ? ' (TÚ)' : '');
  $('.p2 .name').textContent = fighters[1].name + ((G.mode === 'cpu' || G.mode === 'arcade') ? ' (CPU)' : G.mode === 'training' ? ' (MUÑECO)' : you === 1 ? ' (TÚ)' : '');
}

function showFightUi() {
  menu.classList.add('hidden');
  pauseEl.classList.add('hidden');
  onlineEl.classList.add('hidden');
  endEl.classList.add('hidden');
  selectEl.classList.add('hidden');
  hud.classList.remove('hidden');
  touchEl.classList.toggle('hidden', !TOUCH || G.mode === '2p');
  $('#trainInfo').classList.toggle('hidden', G.mode !== 'training');
  if (G.mode === 'training') updateTrainInfo();
  $('#btnPause').classList.toggle('hidden', G.mode === 'online');
  setNames();
}

function startMatch(mode) { openSelect(mode); }

function applyPicks(picks) {
  fighters[0].setCharacter(ROSTER[picks[0]], false);
  fighters[1].setCharacter(ROSTER[picks[1]], picks[0] === picks[1]); // mismo luchador: colores alternativos
  fighters.forEach((f, i) => trails[i].setColor(TRAIL_COLORS[f.def.id] || 0xffffff));
}

function beginMatch() {
  sfx.init();
  G.ai = G.mode === 'cpu' ? new AI(cpuLevel) : G.mode === 'arcade' ? new AI(ARCADE_LEVELS[G.arcade.idx]) : null;
  applyPicks(sel.cur);
  fighters.forEach((f) => { f.wins = 0; f.meter = 0; });
  G.round = 0;
  showFightUi();
  if (isHost()) outbox.push(['start', sel.cur.slice(), G.stage]);
  startRound();
}

function startRound() {
  G.round++;
  resetRound();
  G.finishAvail = false;
  fighters.forEach((f) => f.setState('intro')); // pose de presentación de cada luchador
  G.phase = 'intro'; G.phaseT = 0;
  if (G.mode === 'training') { announce('PRÁCTICA', '', 60); G.phaseT = 60; return; }
  const last = fighters.every((f) => f.wins === ROUNDS_TO_WIN - 1);
  announce(last ? 'RONDA FINAL' : `RONDA ${G.round}`, '', 80);
}

function endRound() {
  const w = G.roundWinner;
  if (G.mode === 'training') { G.phase = 'roundEnd'; G.phaseT = 120; return; }
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
    if (G.phaseT >= 100) {
      G.phase = 'fight';
      fighters.forEach((f) => { if (f.state === 'intro') f.toIdle(); });
    }
  } else if (G.phase === 'fight') {
    if (G.mode === 'training') trainingTick();
    else if (--G.timer <= 0) timeOver();
  } else if (G.phase === 'ko') {
    const L = G.finishLoser;
    if (G.finishAvail && G.phaseT >= 110 && L && L.state === 'ko' && !L.outOfRing) startFinishWait();
    else if (G.phaseT >= 170) endRound();
  } else if (G.phase === 'finishWait') {
    if (G.phaseT >= 160) cancelFinish();
  } else if (G.phase === 'finish') {
    if (G.phaseT >= 170) { G.phase = 'ko'; G.phaseT = 150; }
  } else if (G.phase === 'roundEnd') {
    if (G.phaseT >= 150) {
      if (G.mode === 'training') startRound();
      else if (fighters.some((f) => f.wins >= ROUNDS_TO_WIN)) showMatchEnd();
      else startRound();
    }
  }

  // durante el hitstop no se leen las teclas: quedan en cola para encadenar combos
  if (G.hitstop > 0) { G.hitstop--; sendSnapshot(); return; }
  input.poll();
  remote.poll();

  if (G.phase === 'finishWait') checkFinishInput();
  const camRight = new THREE.Vector3(G.camN.z, 0, -G.camN.x);
  const inputs = fighters.map((f, i) => {
    if (G.phase !== 'fight') return NO_INPUT;
    const opp = fighters[1 - i];
    if (i === 1 && G.mode === 'training') return dummyInput(f, opp);
    if (i === 1 && G.ai) return G.ai.think(f, opp);
    const toOpp = new THREE.Vector3().subVectors(opp.pos, f.pos);
    const raw = (i === 1 && G.mode === 'online') ? remote : input.players[i];
    return toFighterInput(raw, toOpp.dot(camRight) > 0);
  });
  fighters[0].update(inputs[0], fighters[1], G);
  fighters[1].update(inputs[1], fighters[0], G);
  updateProjectiles();
  fighters.forEach((f, i) => {
    if (['idle', 'walk', 'guard', 'crouch', 'crouchGuard'].includes(f.state)) { combo[1 - i] = 0; comboDmg[1 - i] = 0; }
  });

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

// ---------------------------------------------------------------- escenarios
function applyStage(key) {
  G.stage = STAGES[key] ? key : 'atardecer';
  setStage(env, arena, scene, renderer, G.stage);
  updateStageLabel();
}
function cycleStage(d) {
  const i = STAGE_KEYS.indexOf(G.stage);
  applyStage(STAGE_KEYS[(i + d + STAGE_KEYS.length) % STAGE_KEYS.length]);
  try { localStorage.setItem('cs-stage', G.stage); } catch (e) { /* sin almacenamiento */ }
  nsfx.step();
  if (isHost()) net.send({ t: 'stage', s: G.stage });
}
function updateStageLabel() {
  $('#stageName').textContent = STAGES[G.stage].name;
  $('#stageSel').classList.toggle('locked', isGuest() || G.mode === 'arcade');
}
$('#stagePrev').addEventListener('click', () => { if (!isGuest() && G.mode !== 'arcade') cycleStage(-1); });
$('#stageNext').addEventListener('click', () => { if (!isGuest() && G.mode !== 'arcade') cycleStage(1); });

// ---------------------------------------------------------------- torneo
const ARCADE_LEVELS = ['facil', 'normal', 'normal', 'dificil', 'dificil'];
const ARCADE_STAGES = ['dia', 'atardecer', 'dia', 'atardecer', 'noche'];
function startArcade() {
  if (sel.started) return;
  sel.started = true;
  const me = sel.cur[0];
  const rivals = ROSTER.map((_, i) => i).filter((i) => i !== me).sort(() => Math.random() - 0.5);
  G.arcade = { me, order: rivals, idx: 0, lost: false };
  showLadder();
}
function showLadder(msg = '') {
  const A = G.arcade;
  G.phase = 'ladder';
  selectEl.classList.add('hidden'); hud.classList.add('hidden'); touchEl.classList.add('hidden');
  endEl.classList.add('hidden');
  const champion = A.idx >= A.order.length;
  $('#ladderTitle').textContent = champion ? '¡CAMPEÓN DEL TORNEO!' : 'TORNEO';
  $('#ladderRow').innerHTML = A.order.map((ri, k) => {
    const st = k < A.idx ? 'done' : k === A.idx ? 'next' : '';
    return `<div class="rung ${st}"><div class="ph" style="background-image:url(${portraits[ri] || ''})"></div><span>${ROSTER[ri].name}</span></div>`;
  }).join('');
  const lvl = champion ? '' : LEVELS[ARCADE_LEVELS[A.idx]].name;
  $('#ladderInfo').textContent = champion
    ? `Has vencido a los cinco rivales con ${ROSTER[A.me].name}.`
    : (msg || `Combate ${A.idx + 1} de ${A.order.length}: contra ${ROSTER[A.order[A.idx]].name} · CPU ${lvl} · ${STAGES[ARCADE_STAGES[A.idx]].name}`);
  $('#ladderGo').textContent = A.lost ? 'Reintentar' : '¡A pelear!';
  $('#ladderGo').classList.toggle('hidden', champion);
  $('#ladder').classList.remove('hidden');
  if (champion) confetti.burst(new THREE.Vector3(0, RING_TOP, 0));
}
function arcadeNext() {
  const A = G.arcade;
  if (!A || A.idx >= A.order.length) return;
  A.lost = false;
  sel.cur = [A.me, A.order[A.idx]];
  applyStage(ARCADE_STAGES[A.idx]);
  $('#ladder').classList.add('hidden');
  beginMatch();
}
function arcadeAfterMatch(w) {
  const A = G.arcade;
  if (w.index === 0) { A.idx++; A.lost = false; showLadder(); }
  else { A.lost = true; showLadder(`${ROSTER[A.order[A.idx]].name} te ha ganado. ¡Inténtalo otra vez!`); }
}
$('#ladderGo').addEventListener('click', arcadeNext);

// ---------------------------------------------------------------- remate final
const FINISH_DIST = { sp_dragon: 0.9, sp_storm: 1.0, sp_quake: 1.6, sp_shadow: 2.4, sp_charge: 2.2, sp_lotus: 3.0 };
function startFinishWait() {
  const W = G.finisher, L = G.finishLoser;
  G.phase = 'finishWait'; G.phaseT = 0;
  L.setState('dazed');
  L.pos.y = RING_TOP; L.vel.set(0, 0, 0);
  L.facing = Math.atan2(W.pos.x - L.pos.x, W.pos.z - L.pos.z);
  if (!['victory', 'ko'].includes(W.state)) W.toIdle();
  const how = TOUCH ? 'botón ESPECIAL' : (W.index === 0 ? 'R o puño + patada' : 'P o puño + patada');
  announce('¡REMÁTALO!', `${W.name}: ${how}`, 150, 'ko');
}
function checkFinishInput() {
  const W = G.finisher;
  if (W.index === 1 && G.ai) { if (G.phaseT === 45) startFinisher(); return; } // la CPU siempre remata
  const raw = W.index === 1 ? (G.mode === 'online' ? remote : input.players[1]) : input.players[0];
  const pr = raw.pressed, rc = raw.recent;
  if (pr.special || (pr.punch && rc.kick < 4) || (pr.kick && rc.punch < 4)) startFinisher();
}
function startFinisher() {
  const W = G.finisher, L = G.finishLoser;
  G.finishAvail = false;
  const d = new THREE.Vector3(W.pos.x - L.pos.x, 0, W.pos.z - L.pos.z);
  if (d.lengthSq() < 1e-4) d.set(-1, 0, 0);
  d.normalize();
  const D = FINISH_DIST[W.def.special.move] || 1.2;
  W.pos.set(THREE.MathUtils.clamp(L.pos.x + d.x * D, -4.7, 4.7), RING_TOP, THREE.MathUtils.clamp(L.pos.z + d.z * D, -4.7, 4.7));
  W.facing = Math.atan2(L.pos.x - W.pos.x, L.pos.z - W.pos.z);
  W.lastFacing = W.facing;
  L.facing = Math.atan2(W.pos.x - L.pos.x, W.pos.z - L.pos.z);
  W.meter = 100;
  G.phase = 'finish'; G.phaseT = 0;
  G.slowmo = 150;
  announceEl.className = ''; subEl.className = '';
  W.startAttack(W.def.special.move, G);
}
function finisherHit(att, def, pos) {
  if (G.phaseT < 0) return;
  def.flash = 7;
  def.vel.y = 0.2; // sale despedido
  G.hitstop = 18; G.shake = 0.45;
  nsfx.hit(true); nsfx.thud();
  nfx.hit(pos, true, false); nfx.burst(def.pos, 0xff5030); nfx.burst(def.pos, 0xffd060);
  if (G.crowd) G.crowd.excite = 1;
  comic(pos, '¡KABOOM!');
  nvfx.flash('rgba(255,225,74,0.85)');
  nvfx.speed();
  announce('¡REMATE!', att.def.special.name, 150, 'win');
  G.phase = 'ko'; G.phaseT = 40;
}
function cancelFinish() {
  const L = G.finishLoser;
  L.setState('ko');
  G.phase = 'ko'; G.phaseT = 160;
}

// ---------------------------------------------------------------- práctica
const DUMMY = { stand: 'Quieto', guard: 'Se cubre', crouch: 'Agachado', cpu: 'Pelea' };
const dummyAI = new AI('normal');
function dummyInput(f, opp) {
  if (G.dummy === 'cpu') return dummyAI.think(f, opp);
  const inp = { held: { ...NO_INPUT.held }, pressed: { ...NO_INPUT.pressed }, recent: NO_INPUT.recent };
  if (G.dummy === 'guard') inp.held.guard = true;
  if (G.dummy === 'crouch') { inp.held.down = true; inp.held.guard = true; }
  return inp;
}
function trainingTick() {
  fighters[0].meter = 100;
  if (++G.trainIdle > 80) { fighters.forEach((f) => { f.hp = MAX_HP; }); fighters[1].meter = 0; }
}
function cycleDummy() {
  const keys = Object.keys(DUMMY);
  G.dummy = keys[(keys.indexOf(G.dummy) + 1) % keys.length];
  updateTrainInfo();
}
function updateTrainInfo() {
  $('#trainInfo').innerHTML = `PRÁCTICA · Muñeco: <b>${DUMMY[G.dummy]}</b>` + (TOUCH ? '' : ' · <kbd>T</kbd> cambiar · <kbd>Esc</kbd> salir');
}
$('#trainInfo').addEventListener('click', cycleDummy);

// ---------------------------------------------------------------- proyectiles
function updateProjectiles() {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    p.pos.addScaledVector(p.dir, p.speed);
    p.life--;
    const opp = fighters[1 - p.owner.index];
    let gone = p.life <= 0 || Math.abs(p.pos.x) > 6.5 || Math.abs(p.pos.z) > 6.5;
    const near = Math.hypot(opp.pos.x - p.pos.x, opp.pos.z - p.pos.z) < 0.5 && Math.abs(opp.pos.y + 1.1 - p.pos.y) < 1.0;
    if (!gone && near && !opp.invulnerable()) {
      const of = opp.fwd();
      const facing = (of.x * -p.dir.x + of.z * -p.dir.z) > 0.2;
      const blocked = opp.isGuarding() && facing && !opp.isAirborne() && !opp.isCrouching();
      if (blocked) { opp.takeBlock(p.A, p.dir); G.onBlock(p.owner, opp, p.A, p.pos.clone()); }
      else { opp.takeHit(p.A, p.dir, false, G, p.owner); G.onHit(p.owner, opp, p.A, false, p.pos.clone()); }
      gone = true;
    }
    if (gone) G.projectiles.splice(i, 1);
  }
}

const projMeshes = [];
for (let i = 0; i < 4; i++) {
  const g = new THREE.Group();
  const core = new THREE.MeshBasicMaterial({ color: 0xfff4c0 });
  core.color.multiplyScalar(4);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), core));
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: fx.tex, color: 0xffa828, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.material.color.multiplyScalar(3);
  halo.scale.setScalar(0.9);
  g.add(halo);
  g.visible = false;
  scene.add(g);
  projMeshes.push(g);
}
function renderProjectiles(t) {
  const list = isGuest() ? G.netProj : G.projectiles.map((p) => [p.pos.x, p.pos.y, p.pos.z]);
  projMeshes.forEach((m, i) => {
    const q = list[i];
    m.visible = !!q;
    if (!q) return;
    m.position.set(q[0], q[1], q[2]);
    m.children[1].scale.setScalar(0.85 + Math.sin(t * 25 + i) * 0.15);
  });
}

// ---------------------------------------------------------------- red
const r3 = (n) => Math.round(n * 1000) / 1000;
function sendSnapshot() {
  if (!isHost()) return;
  net.send({
    t: 's', ph: G.phase, tm: G.timer, sh: r3(G.shake), ex: r3(G.crowd ? G.crowd.excite : 0),
    f: fighters.map((f) => [r3(f.pos.x), r3(f.pos.y), r3(f.pos.z), r3(f.facing), f.state, f.f, f.hp, f.wins,
      f.flash, f.attackName || '', f.hitLevel || '', f.blockCrouch ? 1 : 0, f.stun || 0, f.walkDir || 1, f.dead ? 1 : 0, Math.round(f.meter)]),
    pj: G.projectiles.map((p) => [r3(p.pos.x), r3(p.pos.y), r3(p.pos.z)]),
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
    f.hitLevel = d[10]; f.blockCrouch = !!d[11]; f.stun = d[12]; f.walkDir = d[13]; f.dead = !!d[14]; f.meter = d[15] || 0;
    if (f.state !== 'attack') f.attack = null;
  });
  G.netProj = s.pj || [];
  for (const e of s.ev) playEvent(e);
}

function playEvent(e) {
  const [k] = e;
  if (k === 's') { const fn = sfx[e[1]]; if (fn) fn.apply(sfx, e[2].map(des)); }
  else if (k === 'f') { const fn = fx[e[1]]; if (fn) fn.apply(fx, e[2].map(des)); }
  else if (k === 'v') { const fn = vfx[e[1]]; if (fn) fn.apply(vfx, e[2].map(des)); }
  else if (k === 'a') announce(e[1], e[2], e[3], e[4]);
  else if (k === 'p') pop(e[1], e[2]);
  else if (k === 'c') comic(des(e[1]), e[2]);
  else if (k === 'k') showCombo(e[1], e[2], e[3]);
  else if (k === 'start') {
    if (e[1]) { sel.cur = e[1].slice(); applyPicks(sel.cur); }
    if (e[2]) applyStage(e[2]);
    fighters.forEach((f) => f.reset(f.index ? 1.5 : -1.5, f.index ? -Math.PI / 2 : Math.PI / 2));
    G.camN.set(0, 0, 1);
    showFightUi();
  }
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
    else if (d.t === 'rematch' && G.phase === 'matchEnd') beginMatch();
    else if (d.t === 'reselect' && G.phase === 'matchEnd') { openSelect('online'); net.send({ t: 'toSelect' }); }
    else if (d.t === 'sel') applyRemoteSel(d);
  } else if (d.t === 'stage') {
    applyStage(d.s);
  } else if (d.t === 's') {
    applySnapshot(d);
  } else if (d.t === 'toSelect') {
    openSelect('online');
  } else if (d.t === 'sel') {
    applyRemoteSel(d);
  }
});
net.on('connected', () => {
  if (net.role === 'host') {
    setOnlineStatus('¡Rival conectado!');
    openSelect('online');
    net.send({ t: 'toSelect' });
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
  if (G.phase === 'select') {
    pos = new THREE.Vector3(0, RING_TOP + 1.45, 3.9);
    look = new THREE.Vector3(0, RING_TOP + 0.85, 0);
  } else if (inMenu) {
    const t = performance.now() * 0.00008;
    pos = new THREE.Vector3(Math.sin(t) * 14, 5.5, Math.cos(t) * 14);
    look = new THREE.Vector3(0, 1.5, 0);
  } else if (G.phase === 'finish' || G.phase === 'finishWait') {
    if (G.phase === 'finish') G.camN.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.35); // giro lento
    const dist = THREE.MathUtils.clamp(3.2 + len * 0.6, 3.8, 7);
    look = mid.clone().add(new THREE.Vector3(0, 1.0, 0));
    pos = mid.clone().addScaledVector(G.camN, dist).add(new THREE.Vector3(0, 1.15, 0));
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
    const mt = f.meter || 0;
    b.meter.style.width = mt + '%';
    b.meterBox.classList.toggle('ready', mt >= SPECIAL_COST);
    b.meterBox.classList.toggle('full', mt >= 100);
  });
  timerEl.textContent = G.mode === 'training' ? '∞' : Math.max(0, Math.ceil(G.timer / 60));
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
  if (G.mode === 'arcade') { arcadeAfterMatch(w); return; }
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
  selectEl.classList.add('hidden');
  $('#trainInfo').classList.add('hidden');
  $('#ladder').classList.add('hidden');
  G.arcade = null;
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

// --- dificultad de la CPU
const LEVEL_KEYS = Object.keys(LEVELS);
let cpuLevel = 'normal';
try { if (LEVELS[localStorage.getItem('cs-cpu')]) cpuLevel = localStorage.getItem('cs-cpu'); } catch (e) { /* sin almacenamiento */ }
const levelBtn = $('#btnLevel');
const showLevel = () => { levelBtn.textContent = `CPU: ${LEVELS[cpuLevel].name}`; };
showLevel();
levelBtn.addEventListener('click', () => {
  cpuLevel = LEVEL_KEYS[(LEVEL_KEYS.indexOf(cpuLevel) + 1) % LEVEL_KEYS.length];
  try { localStorage.setItem('cs-cpu', cpuLevel); } catch (e) { /* sin almacenamiento */ }
  showLevel();
});

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
  beginMatch();
}
function reselect() {
  if (isGuest()) { net.send({ t: 'reselect' }); setEndStatus('Esperando al anfitrión…'); return; }
  openSelect(G.mode);
  if (isHost()) net.send({ t: 'toSelect' });
}
$('#reselect').addEventListener('click', reselect);
function setEndStatus(t) { $('#endStatus').textContent = t; }
$('#rematch').addEventListener('click', rematch);
// el audio del navegador solo arranca tras un gesto del usuario
const unlockAudio = () => sfx.init();
addEventListener('pointerdown', unlockAudio, { capture: true });
addEventListener('keydown', unlockAudio, { capture: true });
function toggleMusic() {
  const on = music.toggle();
  document.querySelectorAll('.musicBtn').forEach((b) => { b.textContent = on ? 'Música: sí' : 'Música: no'; });
}
document.querySelectorAll('.musicBtn').forEach((b) => {
  b.textContent = music.enabled ? 'Música: sí' : 'Música: no';
  b.addEventListener('click', toggleMusic);
});
addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'KeyM') toggleMusic();
  if (e.code === 'KeyT' && G.mode === 'training') cycleDummy();
  if (e.code === 'Escape') togglePause();
  if (e.code === 'Enter') {
    if (G.phase === 'ladder') { arcadeNext(); return; }
    if (G.phase === 'menu' && !menu.classList.contains('hidden')) startMatch(TOUCH ? 'cpu' : '2p');
    else if (G.phase === 'matchEnd') rematch();
  }
});

// ---------------------------------------------------------------- selección de luchador
const selectEl = $('#select'), gridEl = $('#grid');
const sel = { cur: [0, 1], ok: [false, false], t: 0, cpuT: 0 };
const COLS = 3;
const portraits = [];

ROSTER.forEach((d, i) => {
  const b = document.createElement('button');
  b.className = 'card';
  b.dataset.i = i;
  b.innerHTML = `<div class="ph"></div><span>${d.name}</span><em class="m1">J1</em><em class="m2">J2</em>`;
  const cc = d.look.topColor ?? d.look.paint ?? 0x888888;
  b.style.setProperty('--cc', '#' + cc.toString(16).padStart(6, '0'));
  b.addEventListener('click', () => tapCard(i));
  gridEl.appendChild(b);
});

// Retratos: cada luchador se renderiza una vez en un lienzo aparte.
function makePortraits() {
  const W = 180, H = 216;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.NeutralToneMapping;
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight(0xffe2c8, 0x2a1c18, 1.1));
  const key = new THREE.DirectionalLight(0xffe0c0, 2.6); key.position.set(1.5, 2.5, 2); sc.add(key);
  const rim = new THREE.DirectionalLight(0x8fb0ff, 3); rim.position.set(-1.5, 2, -2); sc.add(rim);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 20);
  ROSTER.forEach((d, i) => {
    const f = new Fighter(sc, d, 0);
    // pose de retrato: brazos abajo y algo separados para que se vea la cara y el torso
    const pose = over(STANCE, { hy: -0.15, sy: 0.1, hd: 0.02, lsx: -0.25, lsz: 0.28, lex: -0.9, rsx: -0.25, rsz: -0.28, rex: -0.9 });
    f.pose = pose; f.applyPose(pose);
    f.root.rotation.y = -0.35;
    const s = d.build.scale;
    cam.position.set(0.25, 1.55 * s, 1.75 * s);
    cam.lookAt(0, 1.4 * s, 0);
    r.render(sc, cam);
    portraits[i] = cv.toDataURL('image/png');
    sc.remove(f.root);
  });
  r.dispose();
  r.forceContextLoss();
  gridEl.querySelectorAll('.card .ph').forEach((el, i) => { el.style.backgroundImage = `url(${portraits[i]})`; });
}

// Qué ranuras controla este dispositivo, y con qué jugador del teclado.
function localSlots() {
  if (G.mode === 'online') return net.role === 'host' ? [[0, 0]] : [[1, 0]];
  if (G.mode === 'cpu' || G.mode === 'training' || G.mode === 'arcade') return [[0, 0]];
  return [[0, 0], [1, 1]];
}

function openSelect(mode) {
  sfx.init();
  G.mode = mode;
  G.phase = 'select';
  sel.ok = [false, false]; sel.t = 0; sel.cpuT = 0;
  menu.classList.add('hidden'); onlineEl.classList.add('hidden'); endEl.classList.add('hidden');
  pauseEl.classList.add('hidden'); hud.classList.add('hidden'); touchEl.classList.add('hidden');
  announceEl.className = ''; subEl.className = ''; popEl.className = '';
  selectEl.classList.remove('hidden');
  selectEl.classList.toggle('arcade', mode === 'arcade');
  sel.started = false;
  updateStageLabel();
  resetRound();
  fighters[0].reset(-1.1, Math.PI / 2 - 0.5);
  fighters[1].reset(1.1, -Math.PI / 2 + 0.5);
  G.camN.set(0, 0, 1);
  renderSelect();
}

function moveCursor(slot, d) {
  const n = ROSTER.length;
  let c = sel.cur[slot];
  if (d === 'left') c = (c - 1 + n) % n;
  if (d === 'right') c = (c + 1) % n;
  if (d === 'up') c = (c - COLS + n) % n;
  if (d === 'down') c = (c + COLS) % n;
  setCursor(slot, c);
}
function setCursor(slot, c) {
  if (sel.ok[slot] || sel.cur[slot] === c) return;
  sel.cur[slot] = c;
  nsfx.step();
  syncSel(slot);
}
function confirmPick(slot, ok) {
  if (sel.ok[slot] === ok) return;
  sel.ok[slot] = ok;
  if (ok) nsfx.hit(false); else nsfx.block();
  syncSel(slot);
}
function syncSel(slot) {
  if (G.mode === 'online') net.send({ t: 'sel', s: slot, c: sel.cur[slot], ok: sel.ok[slot] });
  renderSelect();
}
function applyRemoteSel(d) {
  if (G.phase !== 'select') return;
  sel.cur[d.s] = d.c;
  sel.ok[d.s] = d.ok;
  renderSelect();
}

function tapCard(i) {
  if (G.phase !== 'select') return;
  const slots = localSlots().map(([s]) => s);
  const slot = slots.find((s) => !sel.ok[s]);
  if (slot === undefined) return;
  if (sel.cur[slot] === i) confirmPick(slot, true); // segundo toque: confirmar
  else { sel.cur[slot] = i; nsfx.step(); syncSel(slot); }
}

function selectStep() {
  input.poll();
  for (const [slot, pi] of localSlots()) {
    const p = input.players[pi].pressed;
    if (!sel.ok[slot]) {
      for (const d of ['left', 'right', 'up', 'down']) if (p[d]) moveCursor(slot, d);
      if (p.punch) confirmPick(slot, true);
    } else if (p.kick || p.guard) confirmPick(slot, false);
  }
  if ((G.mode === 'cpu' || G.mode === 'training') && sel.ok[0] && !sel.ok[1]) {
    // la CPU "piensa" moviendo el cursor y elige uno al azar
    sel.cpuT++;
    if (sel.cpuT % 8 === 0) { sel.cur[1] = (sel.cur[1] + 1) % ROSTER.length; renderSelect(); }
    if (sel.cpuT > 50) { sel.cur[1] = (Math.random() * ROSTER.length) | 0; confirmPick(1, true); }
  }
  if (G.mode === 'arcade' && sel.ok[0]) { if (++sel.t > 40) startArcade(); return; }
  // escenario: J1 con Q / E (en online solo el anfitrión)
  if (!isGuest()) {
    const p0 = input.players[0].pressed;
    if (p0.sideIn) cycleStage(-1);
    if (p0.sideOut) cycleStage(1);
  }
  if (sel.ok[0] && sel.ok[1]) {
    if (++sel.t > 55 && !isGuest()) beginMatch();
  } else sel.t = 0;
}

const pct = (v, lo, hi) => Math.round(Math.max(0.08, Math.min(1, (v - lo) / (hi - lo))) * 100);
function statsHtml(d) {
  const row = (label, v) => `<div class="st"><span>${label}</span><b><i style="width:${v}%"></i></b></div>`;
  return row('Poder', pct(d.stats.power, 0.75, 1.3)) + row('Velocidad', pct(d.stats.speed, 0.75, 1.25)) + row('Peso', pct(d.stats.weight, 0.75, 1.4));
}
function renderSelect() {
  applyPicks(sel.cur);
  fighters.forEach((f, i) => {
    const want = sel.ok[i] ? 'victory' : 'idle';
    if (f.state !== want) f.setState(want);
  });
  const mine = localSlots().map(([s]) => s);
  [0, 1].forEach((i) => {
    const d = ROSTER[sel.cur[i]];
    const box = selectEl.querySelector(`.sel-info.p${i + 1}`);
    box.querySelector('.nm').textContent = d.name;
    box.querySelector('.tt').textContent = `${d.title} · ${d.origin}`;
    box.querySelector('.stats').innerHTML = statsHtml(d);
    box.querySelector('.sp').innerHTML = `<b>Especial:</b> ${d.special.name}. <span>${d.special.desc}.</span>`;
    let who = i === 0 ? 'J1' : (G.mode === 'cpu' ? 'CPU' : G.mode === 'training' ? 'MUÑECO' : G.mode === 'arcade' ? 'TORNEO' : 'J2');
    if (G.mode === 'online') who = mine.includes(i) ? 'TÚ' : 'RIVAL';
    box.querySelector('.who').textContent = who;
    box.querySelector('.state').textContent = sel.ok[i] ? '¡LISTO!' : (mine.includes(i) ? (TOUCH ? 'Toca otra vez para confirmar' : 'Elige y confirma') : 'Eligiendo…');
    box.classList.toggle('ready', sel.ok[i]);
  });
  gridEl.querySelectorAll('.card').forEach((c, i) => {
    c.classList.toggle('c1', sel.cur[0] === i);
    c.classList.toggle('c2', sel.cur[1] === i);
    c.classList.toggle('lock1', sel.cur[0] === i && sel.ok[0]);
    c.classList.toggle('lock2', sel.cur[1] === i && sel.ok[1]);
  });
}

// ---------------------------------------------------------------- bucle
let arena = null;
let acc = 0, last = performance.now();
let emberAcc = 0, lastPhase = '', lastHp = MAX_HP;
const paused0 = () => G.phase === 'paused';
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (G.phase === 'select') {
    acc += dt;
    while (acc >= STEP) { acc -= STEP; selectStep(); }
  } else if (isGuest()) {
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
  animateSky(env, dt);
  if (arena && arena.banners) animateBanners(arena.banners, t);
  emberAcc += dt;
  while (emberAcc > 0.09) { // ascuas que suben de las antorchas
    emberAcc -= 0.09;
    const l = env.torches[(Math.random() * 4) | 0];
    fx.ember(new THREE.Vector3(l.position.x + (Math.random() - 0.5) * 0.2, 3.1, l.position.z + (Math.random() - 0.5) * 0.2));
  }
  if (G.phase === 'matchEnd' && lastPhase !== 'matchEnd') {
    const w = fighters.find((f) => f.wins >= ROUNDS_TO_WIN) || fighters[0];
    confetti.burst(w.pos);
  }
  lastPhase = G.phase;
  confetti.update(paused0() ? 0 : dt);
  const tb = env.torchBase || 7;
  env.torches.forEach((l, i) => { l.intensity = tb + (Math.sin(t * 13 + i * 2) * 0.8 + Math.sin(t * 29 + i) * 0.6) * tb / 7; });
  if (env.night && Math.random() < dt * 6) { // luciérnagas alrededor del ring
    const a = Math.random() * Math.PI * 2, r = 5.5 + Math.random() * 9;
    fx.firefly(new THREE.Vector3(Math.cos(a) * r, 0.6 + Math.random() * 2.5, Math.sin(a) * r));
  }
  // vibración en el móvil cuando te golpean
  const me = isGuest() ? 1 : 0;
  const hpNow = fighters[me].hp;
  if (TOUCH && navigator.vibrate && hpNow < lastHp && !['menu', 'select', 'loading'].includes(G.phase)) navigator.vibrate(lastHp - hpNow > 15 ? 70 : 30);
  lastHp = hpNow;
  if (arena) {
    if (arena.waterTex) { arena.waterTex.offset.x = t * 0.01; arena.waterTex.offset.y = t * 0.006; }
    arena.fires.forEach((f, i) => { f.scale.set(1 + Math.sin(t * 17 + i) * 0.1, 1.4 + Math.sin(t * 11 + i * 3) * 0.25, 1 + Math.cos(t * 15 + i) * 0.1); });
  }
  const paused = G.phase === 'paused';
  // música según la fase (el invitado online la sigue por la fase que recibe)
  music.play(themeFor(G.phase));
  music.setLevel(paused ? 0.35 : G.phase === 'ko' ? 0.55 : 1);
  if (G.crowd) { updateCrowd(G.crowd, paused ? 0 : dt); sfx.crowd(G.crowd.excite); }
  fighters.forEach((f, i) => {
    f.render(paused ? 0 : dt);
    f.root.updateMatrixWorld(true);
    trails[i].update(f, camera);
  });
  fx.update(paused ? 0 : dt);
  renderProjectiles(t);
  updateCamera(dt);
  env.rim.position.copy(camLook).addScaledVector(G.camN, -9).add(new THREE.Vector3(0, 5, 0));
  env.rim.target.position.copy(camLook);
  updateHud();
  post.render();
}

(async () => {
  try {
    arena = await loadArena(scene);
    G.crowd = await loadCrowd(scene, 'assets/', TOUCH ? 0.6 : 1);
    music.load('assets/musica.json').catch((e) => console.warn('Sin música', e));
    makePortraits();
  } catch (err) {
    console.error(err);
    $('#loading').textContent = 'No se pudo cargar la arena. Abre el juego desde un servidor web (ver README).';
    return;
  }
  $('#loading').classList.add('hidden');
  resetRound();
  let saved = 'atardecer';
  try { saved = localStorage.getItem('cs-stage') || saved; } catch (e) { /* sin almacenamiento */ }
  applyStage(saved);
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
  G, fighters, startMatch, beginMatch, sel: () => sel, input, net, music, trails, confetti, camera, fx, post: () => post, startArcade, arcadeNext, applyStage,
  draw() { updateCamera(1 / 60, true); updateHud(); renderProjectiles(performance.now() / 1000); post.render(); },
  advance(n = 1) { for (let i = 0; i < n; i++) { step(); fighters.forEach((f) => f.render(STEP)); fx.update(STEP); } },
};
