'use strict';

/* ============================================================
   SAMUDRA RASA 🌊 — Game Engine 14 Babak
   ============================================================ */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const isHttp = location.protocol.startsWith('http');
const SCENE_KEY = 'samudra-rasa-scene';

/* ---------------- STATE ---------------- */
function defaultState() {
  return {
    currentScene: 1,
    totalScenes: 14,
    musicMuted: false,
    audioUnlocked: false,
    /* 1 */ light: 0, ignites: 0,
    /* 2 */ scanDone: false,
    /* 3 */ bubblesCaught: 0,
    /* 4 */ bottleLifted: false, corkPopped: false, corkFails: 0,
    /* 5 */ clamsOpened: [false, false, false],
    /* 6 */ wheelDeg: 0, wheelDone: false,
    /* 7 */ nautPlayed: false,
    /* 8 */ starStep: 0, starDone: false,
    /* 9 */ polarOpened: 0,
    /* 10 */ breathCaught: 0, breathPopped: 0,
    /* 11 */ hugProgress: 0, hugDone: false,
    /* 12 */ letterDone: false,
    /* 13 */ noRuns: 0,
    /* 14 */ finaleLaunched: false
  };
}
let STATE = defaultState();

/* ---------------- Toast & haptic ---------------- */
let toastTimer = null;
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}
function vibrate(p) { if (navigator.vibrate) { try { navigator.vibrate(p); } catch (e) {} } }

function spawnFloaters(n, chars) {
  const pool = chars || ['🫧', '💙', '🌊', '💗', '✨'];
  for (let i = 0; i < n; i++) {
    const el = document.createElement('div');
    el.className = 'float-heart';
    el.textContent = pool[Math.floor(Math.random() * pool.length)];
    el.style.left = rand(8, 88) + 'vw';
    el.style.top = rand(55, 88) + 'vh';
    el.style.animationDelay = (i * 90) + 'ms';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
}

/* ============================================================
   SOUND ENGINE — Web Audio API (musik + sfx sintetis)
   ============================================================ */
const A = {
  ctx: null, master: null, analyser: null, noiseBuf: null,
  mp3Ok: false, mp3Mode: false, mp3Failed: false, synthOn: false,
  schedTimer: null, step: 0, nextTime: 0, mediaSrc: null
};

function ensureAudio() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return A.ctx; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  A.ctx = new Ctx();
  A.master = A.ctx.createGain();
  A.master.gain.value = 0.55;
  A.analyser = A.ctx.createAnalyser();
  A.analyser.fftSize = 64;
  A.analyser.smoothingTimeConstant = 0.75;
  A.master.connect(A.analyser);
  A.analyser.connect(A.ctx.destination);
  // buffer noise untuk efek ombak
  const len = A.ctx.sampleRate * 1.2;
  A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
  const d = A.noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return A.ctx;
}

/* ---- SFX sintetis ---- */
function sfxWaterDrop() {
  const ctx = ensureAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(920, t);
  o.frequency.exponentialRampToValueAtTime(280, t + 0.16);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g); g.connect(A.master);
  o.start(t); o.stop(t + 0.22);
}
function sfxSoftWave() {
  const ctx = ensureAudio(); if (!ctx || !A.noiseBuf) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource(); src.buffer = A.noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass';
  f.frequency.setValueAtTime(420, t);
  f.frequency.linearRampToValueAtTime(160, t + 0.9);
  f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.16, t + 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
  src.connect(f); f.connect(g); g.connect(A.master);
  src.start(t); src.stop(t + 1.1);
}
function sfxChime() {
  const ctx = ensureAudio(); if (!ctx) return;
  const t = ctx.currentTime;
  [1318.51, 1975.53, 2637.02].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const g = ctx.createGain();
    const st = t + i * 0.07;
    g.gain.setValueAtTime(0.0001, st);
    g.gain.exponentialRampToValueAtTime(0.09, st + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 1.1);
    o.connect(g); g.connect(A.master);
    o.start(st); o.stop(st + 1.2);
  });
}

/* ---- Musik: komposisi piano romantis "Samudra Melody" ---- */
const BPM = 66;
const SPB = 60 / BPM;          // detik per ketuk
const EIGHTH = SPB / 2;        // pola arpeggio per paruh ketuk

function noteHz(n) {
  const m = /^([A-G]#?)(-?\d)$/.exec(n);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1][0]];
  const midi = base + (m[1][1] === '#' ? 1 : 0) + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/* Progresi 8 bar: Am – F – C – G  ×2 (vi–IV–I–V, klasik bikin merinding) */
const CH_BAR = [0, 1, 2, 3, 0, 1, 2, 3];
const ARPS = [
  ['A2', 'E3', 'A3', 'C4', 'E4', 'C4', 'A3', 'E3'], // Am
  ['F2', 'C3', 'F3', 'A3', 'C4', 'A3', 'F3', 'C3'], // F
  ['C3', 'G3', 'C4', 'E4', 'G4', 'E4', 'C4', 'G3'], // C
  ['G2', 'D3', 'G3', 'B3', 'D4', 'B3', 'G3', 'D3']  // G
];
const PADS = [
  ['A3', 'C4', 'E4'],
  ['F3', 'A3', 'C4'],
  ['C4', 'E4', 'G4'],
  ['G3', 'B3', 'D4']
];
/* Melodi: frasa 1 lembut, frasa 2 naik oktaf (bagian yang bikin baper) */
const MEL = [
  { t: 0, n: 'A4', d: 2 }, { t: 2, n: 'C5', d: 2 }, { t: 4, n: 'B4', d: 4 },
  { t: 8, n: 'A4', d: 2 }, { t: 10, n: 'G4', d: 2 }, { t: 12, n: 'F4', d: 4 },
  { t: 16, n: 'E4', d: 2 }, { t: 18, n: 'G4', d: 2 }, { t: 20, n: 'C5', d: 4 },
  { t: 24, n: 'B4', d: 2 }, { t: 26, n: 'A4', d: 2 }, { t: 28, n: 'G4', d: 4 },
  { t: 32, n: 'E5', d: 3 }, { t: 35, n: 'C5', d: 1 }, { t: 36, n: 'A4', d: 4 },
  { t: 40, n: 'F5', d: 2 }, { t: 42, n: 'E5', d: 2 }, { t: 44, n: 'C5', d: 4 },
  { t: 48, n: 'E5', d: 2 }, { t: 50, n: 'D5', d: 2 }, { t: 52, n: 'C5', d: 4 },
  { t: 56, n: 'D5', d: 4 }, { t: 60, n: 'B4', d: 4 }
];

/* Piano felt lembut: fundamental + partial + sedikit detune */
function pianoHz(freq, time, dur, vel) {
  const ctx = A.ctx;
  const g = ctx.createGain();
  const filt = ctx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(2800, time);
  filt.frequency.exponentialRampToValueAtTime(900, time + dur);
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vel, time + 0.014);
  g.gain.exponentialRampToValueAtTime(vel * 0.32, time + Math.min(0.7, dur * 0.5));
  g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  g.connect(filt);
  filt.connect(A.master);
  const mk = (ratio, type, mul, detune) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq * ratio;
    if (detune) o.detune.value = detune;
    const og = ctx.createGain();
    og.gain.value = mul;
    o.connect(og); og.connect(g);
    o.start(time); o.stop(time + dur + 0.15);
  };
  mk(1, 'sine', 1, 0);
  mk(2.002, 'sine', 0.22, 3);
  mk(0.999, 'triangle', 0.16, -4);
  mk(3.001, 'sine', 0.06, 5);
}
function padHz(freq, time, dur, vel) {
  const ctx = A.ctx;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(vel, time + dur * 0.35);
  g.gain.linearRampToValueAtTime(0.0001, time + dur);
  o.connect(g); g.connect(A.master);
  o.start(time); o.stop(time + dur + 0.1);
}
function oceanSwell(time) {
  const ctx = A.ctx;
  if (!A.noiseBuf) return;
  const src = ctx.createBufferSource();
  src.buffer = A.noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(300, time);
  f.frequency.linearRampToValueAtTime(750, time + 1.4);
  f.frequency.linearRampToValueAtTime(280, time + 2.9);
  f.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, time);
  g.gain.linearRampToValueAtTime(0.028, time + 1.4);
  g.gain.linearRampToValueAtTime(0.0001, time + 2.9);
  src.connect(f); f.connect(g); g.connect(A.master);
  src.start(time); src.stop(time + 3.0);
}

function musicTick() {
  if (!A.synthOn || !A.ctx) return;
  const now = A.ctx.currentTime;
  while (A.nextTime < now + 0.3) {
    const step = A.step;            // 0..63 (8 bar × 8 pola)
    const t = A.nextTime;
    const chIdx = CH_BAR[Math.floor(step / 8)];
    pianoHz(noteHz(ARPS[chIdx][step % 8]), t, 1.7, 0.05);
    if (step % 8 === 0) {
      PADS[chIdx].forEach(n => padHz(noteHz(n), t, SPB * 4 * 1.1, 0.014));
    }
    const ev = MEL.find(m => m.t === step);
    if (ev) pianoHz(noteHz(ev.n), t, ev.d * EIGHTH * 1.9, 0.115);
    if (step % 16 === 0) oceanSwell(t);
    A.step = (step + 1) % 64;
    A.nextTime += EIGHTH;
  }
}
function startSynth() {
  const ctx = ensureAudio(); if (!ctx || A.synthOn) return;
  A.synthOn = true; A.mp3Mode = false;
  A.step = 0;
  A.nextTime = ctx.currentTime + 0.12;
  A.schedTimer = setInterval(musicTick, 90);
  updateMusicUI(true);
}
function stopSynth() {
  A.synthOn = false;
  clearInterval(A.schedTimer);
}

/* ---- Musik MP3 (jika file tersedia; fallback ke synth) ---- */
function probeMp3() {
  if (!isHttp) return Promise.resolve(false);
  return fetch('assets/ocean_melody.mp3', { method: 'HEAD' })
    .then(r => { A.mp3Ok = r.ok; return A.mp3Ok; })
    .catch(() => { A.mp3Ok = false; return false; });
}
function tryMp3() {
  if (A.mp3Failed) return Promise.resolve(false);
  const audio = $('bg-audio');
  ensureAudio();
  if (isHttp && A.ctx && !A.mediaSrc) {
    try {
      A.mediaSrc = A.ctx.createMediaElementSource(audio);
      A.mediaSrc.connect(A.master);
    } catch (e) { A.mediaSrc = null; }
  }
  return audio.play().then(() => {
    A.mp3Mode = true; A.mp3Ok = true; stopSynth(); updateMusicUI(true); return true;
  }).catch(() => {
    A.mp3Failed = true; A.mp3Ok = false; A.mp3Mode = false; return false;
  });
}
function startMusic() {
  STATE.musicMuted = false;
  ensureAudio();
  tryMp3().then(ok => { if (!ok) startSynth(); });
  updateMusicUI(true);
}
function stopMusic() {
  STATE.musicMuted = true;
  stopSynth();
  $('bg-audio').pause();
  updateMusicUI(false);
}
function toggleMusic() {
  if (STATE.musicMuted) startMusic(); else stopMusic();
}
function updateMusicUI(playing) {
  const pill = $('music-pill');
  pill.classList.toggle('playing', playing);
  $('music-label').textContent = playing ? 'Musik aktif' : 'Musik mati';
  const b = $('btn-play-naut');
  if (b) b.textContent = playing ? '⏸ Jeda Melodi' : '▶ Putar Melodi';
  const naut = $('nautilus');
  if (naut) naut.classList.toggle('spinning', playing);
  const viz = $('viz');
  if (viz) viz.classList.toggle('idle', !playing);
}
function unlockAudio() {
  if (STATE.audioUnlocked) return;
  STATE.audioUnlocked = true;
  ensureAudio();
  if (!STATE.musicMuted) {
    tryMp3().then(ok => { if (!ok && !STATE.musicMuted) startSynth(); });
  }
}

/* ============================================================
   PROGRESS + SCENE ENGINE
   ============================================================ */
function buildProgressDots() {
  const wrap = $('step-dots');
  wrap.innerHTML = '';
  for (let i = 1; i <= STATE.totalScenes; i++) {
    const d = document.createElement('span');
    d.className = 'step-dot';
    d.id = 'dot-' + i;
    wrap.appendChild(d);
  }
}
function updateProgress(n) {
  for (let i = 1; i <= STATE.totalScenes; i++) {
    const d = $('dot-' + i);
    if (!d) continue;
    d.classList.toggle('done', i < n);
    d.classList.toggle('active', i === n);
  }
  $('step-label').textContent = n + '/' + STATE.totalScenes;
}

function nextScene() {
  const next = STATE.currentScene + 1;
  if (next > STATE.totalScenes) return;
  const cur = $('scene-' + STATE.currentScene);
  cur.style.animation = 'sceneOut .38s var(--ease-out) both';
  sfxWaterDrop();
  setTimeout(() => {
    cur.classList.remove('active');
    cur.style.animation = '';
    STATE.currentScene = next;
    try { localStorage.setItem(SCENE_KEY, String(next)); } catch (e) {}
    const el = $('scene-' + next);
    el.classList.add('active');
    $('stage').scrollTop = 0;
    updateProgress(next);
    onSceneEnter(next);
    spawnFloaters(3);
  }, 370);
}

function onSceneEnter(n) {
  if (n === 3) resetBubbleGame();
  if (n === 4) resetBottle();
  if (n === 6) resetWheel();
  if (n === 7) syncNautilusUI();
  if (n === 8) resetConstellation();
  if (n === 9) resetPolaroids();
  if (n === 10) resetBreathGame();
  if (n === 11) resetHug();
  if (n === 12) resetLetter();
  if (n === 13) resetRunaway();
  if (n === 14) launchFinale();
}

/* ============================================================
   SCENE 1 — NYALAKAN MERCUSUAR
   ============================================================ */
function updateScene1() {
  $('st-1').textContent = 'Cahaya ' + STATE.light + '% · Pemantik ' + STATE.ignites + '/3';
  const done = STATE.light >= 100 && STATE.ignites >= 3;
  $('btn-1-next').classList.toggle('hidden', !done);
  if (done && !$('lighthouse').classList.contains('lit')) {
    $('lighthouse').classList.add('lit');
    sfxSoftWave(); sfxChime();
    showToast('Mercusuar menyala! Kapal cinta menemukan jalan 🗼💙');
    spawnFloaters(4);
  }
}
function initScene1() {
  const sl = $('light-slider');
  sl.addEventListener('input', () => {
    STATE.light = +sl.value;
    sl.style.setProperty('--prog', STATE.light + '%');
    if (STATE.light > 0 && STATE.light % 25 === 0) sfxWaterDrop();
    updateScene1();
  });
  $('btn-ignite').addEventListener('click', () => {
    if (STATE.ignites >= 3) return;
    STATE.ignites++;
    sfxWaterDrop();
    vibrate(18);
    const lamp = $('lh-lamp');
    lamp.style.transform = 'scale(1.25)';
    setTimeout(() => lamp.style.transform = '', 180);
    updateScene1();
    if (STATE.ignites === 3) showToast('Api pemantik menyala! 🔥');
  });
  updateScene1();
}

/* ============================================================
   SCENE 2 — SONAR RADAR HATI (tahan 2.5 detik)
   ============================================================ */
let scanTimer = null, scanVal = 0;
const SCAN_C = 339.29;
function setScan(v) {
  scanVal = clamp(v, 0, 100);
  $('scan-fill').style.strokeDashoffset = String(SCAN_C * (1 - scanVal / 100));
}
function startScan() {
  if (STATE.scanDone) return;
  ensureAudio();
  $('sonar-sweep').classList.add('scanning');
  clearInterval(scanTimer);
  scanTimer = setInterval(() => {
    setScan(scanVal + 2); // 2% / 50ms = 2.5s
    if (scanVal % 10 < 2) sfxWaterDrop();
    if (scanVal >= 100) completeScan();
  }, 50);
}
function stopScan() {
  clearInterval(scanTimer);
  $('sonar-sweep').classList.remove('scanning');
  if (!STATE.scanDone && scanVal < 100) setScan(0);
}
function completeScan() {
  clearInterval(scanTimer);
  STATE.scanDone = true;
  $('sonar-sweep').classList.remove('scanning');
  $('sonar-ping').classList.add('found');
  $('st-2').textContent = ' Frekuensi hati terdeteksi: 72 bpm 💙';
  $('btn-2-next').classList.remove('hidden');
  sfxChime();
  spawnFloaters(3);
}
function initScene2() {
  const btn = $('btn-scan');
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); unlockAudio(); startScan(); });
  btn.addEventListener('pointerup', stopScan);
  btn.addEventListener('pointercancel', stopScan);
  btn.addEventListener('pointerleave', stopScan);
  window.addEventListener('pointerup', stopScan);
  setScan(0);
}

/* ============================================================
   SCENE 3 — TANGKAP GELEMBUNG HARAPAN (canvas)
   ============================================================ */
const BUBBLE_MSGS = [
  'Kamu cantik kayak cahaya bioluminescent 🌊',
  'Senyummu lebih hangat dari matahari pantai ☀️',
  'Denganmu, laut terasa selalu tenang 🥰',
  'Kamu ombak favoritku, selalu kutunggu 💗',
  'Hatimu sedalam palung terdalam 💙'
];
let bCtx = null, bBubbles = [], bBursts = [], bAnimOn = false;
function resetBubbleGame() {
  STATE.bubblesCaught = 0;
  bBubbles = []; bBursts = [];
  $('st-3').textContent = 'Tertangkap: 0/5';
  $('btn-3-next').classList.add('hidden');
  const c = $('bubble-canvas');
  bCtx = c.getContext('2d');
  for (let i = 0; i < 5; i++) spawnBubble(i, true);
  for (let i = 0; i < 3; i++) spawnBubble(-1, false); // decoy
  if (!bAnimOn) { bAnimOn = true; requestAnimationFrame(drawBubbles); }
}
function spawnBubble(idx, target) {
  const c = $('bubble-canvas');
  bBubbles.push({
    idx: target ? idx : -1,
    target,
    x: rand(60, 540),
    y: rand(300, 560),
    r: target ? rand(38, 50) : rand(22, 32),
    vy: target ? rand(28, 44) : rand(40, 60),
    wob: rand(0, Math.PI * 2),
    alive: true
  });
}
function drawBubbles() {
  requestAnimationFrame(drawBubbles);
  if (STATE.currentScene !== 3 || !bCtx) return;
  const c = bCtx.canvas;
  bCtx.clearRect(0, 0, c.width, c.height);
  // latar dalam
  const g = bCtx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#0b2c4d'); g.addColorStop(1, '#041f36');
  bCtx.fillStyle = g; bCtx.fillRect(0, 0, c.width, c.height);
  const dt = 1 / 60;
  bBubbles.forEach(b => {
    if (!b.alive) return;
    b.y -= b.vy * dt * 2.2;
    b.wob += dt * 3;
    b.x += Math.sin(b.wob) * 0.7;
    if (b.y < -70) { b.y = c.height + 60; b.x = rand(60, 540); }
    const grad = bCtx.createRadialGradient(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.15, b.x, b.y, b.r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.4, b.target ? 'rgba(125,211,252,0.5)' : 'rgba(56,189,248,0.28)');
    grad.addColorStop(1, b.target ? 'rgba(2,132,199,0.18)' : 'rgba(12,74,110,0.1)');
    bCtx.beginPath(); bCtx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    bCtx.fillStyle = grad; bCtx.fill();
    bCtx.strokeStyle = b.target ? 'rgba(125,211,252,0.85)' : 'rgba(125,211,252,0.35)';
    bCtx.lineWidth = 2; bCtx.stroke();
    bCtx.beginPath(); bCtx.arc(b.x - b.r * 0.32, b.y - b.r * 0.34, b.r * 0.2, 0, Math.PI * 2);
    bCtx.fillStyle = 'rgba(255,255,255,0.8)'; bCtx.fill();
    if (b.target) {
      bCtx.font = '22px serif'; bCtx.textAlign = 'center'; bCtx.textBaseline = 'middle';
      bCtx.fillText(['💙', '💗', '✨', '🌊', '🥰'][b.idx % 5], b.x, b.y + 2);
    }
  });
  // bursts
  bBursts = bBursts.filter(p => p.life > 0);
  bBursts.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.life -= 0.03;
    bCtx.beginPath(); bCtx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    bCtx.fillStyle = p.c; bCtx.globalAlpha = clamp(p.life, 0, 1); bCtx.fill();
    bCtx.globalAlpha = 1;
  });
}
function popBubble(b) {
  b.alive = false;
  for (let i = 0; i < 12; i++) {
    const a = rand(0, Math.PI * 2), s = rand(1.5, 4.5);
    bBursts.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(3, 7), life: 1, c: i % 2 ? '#7dd3fc' : '#f0fdfa' });
  }
}
function initScene3() {
  const c = $('bubble-canvas');
  c.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) * (c.width / r.width);
    const y = (e.clientY - r.top) * (c.height / r.height);
    let hit = null;
    for (const b of bBubbles) {
      if (!b.alive) continue;
      if (Math.hypot(b.x - x, b.y - y) <= b.r + 8) { hit = b; break; }
    }
    if (!hit) { sfxWaterDrop(); return; }
    if (hit.target) {
      popBubble(hit);
      STATE.bubblesCaught++;
      sfxChime();
      showToast(BUBBLE_MSGS[Math.min(STATE.bubblesCaught - 1, 4)]);
      spawnFloaters(2);
      $('st-3').textContent = 'Tertangkap: ' + STATE.bubblesCaught + '/5';
      if (STATE.bubblesCaught >= 5) {
        $('btn-3-next').classList.remove('hidden');
        showToast('Semua harapan tertangkap! 🫧💙');
      } else {
        setTimeout(() => spawnBubble(STATE.bubblesCaught, true), 500);
      }
    } else {
      popBubble(hit);
      sfxWaterDrop();
      setTimeout(() => spawnBubble(-1, false), 700);
    }
  });
}

/* ============================================================
   SCENE 4 — PESAN DALAM BOTOL (angkat + tarik sumbat)
   ============================================================ */
const BOTTLE_NOTE = 'Rahasia samudra:\nsetiap ombak yang kubawa selalu membawa namamu,\nsetiap bintang di dasar laut menuliskan namamu,\ndan setiap detak jantungku berbunyi: "aku sayang kamu". 💌🌊';
function resetBottle() {
  STATE.bottleLifted = false; STATE.corkPopped = false; STATE.corkFails = 0;
  $('drift-bottle').classList.remove('lifted');
  $('cork').classList.remove('show', 'popped');
  $('cork').style.transform = '';
  $('secret-note').classList.add('hidden');
  $('note-text').textContent = '';
  $('st-4').textContent = 'Botol masih tertutup rapat...';
  $('btn-4-next').classList.add('hidden');
}
function initScene4() {
  const bottle = $('drift-bottle');
  bottle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (STATE.corkPopped) return;
    if (!STATE.bottleLifted) {
      STATE.bottleLifted = true;
      bottle.classList.add('lifted');
      $('cork').classList.add('show');
      $('st-4').textContent = 'Botol terangkat! Geser sumbat gabusnya ke atas ↑';
      sfxWaterDrop();
      unlockAudio();
    }
  });
  bottle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); bottle.dispatchEvent(new PointerEvent('pointerdown', { clientX: 0, clientY: 0 })); }
  });

  const cork = $('cork');
  let dragging = false, startY = 0, startT = 0;
  const snapBack = () => {
    cork.classList.remove('dragging');
    cork.style.transition = 'transform .4s var(--ease-spring)';
    cork.style.transform = '';
    setTimeout(() => { cork.style.transition = ''; }, 420);
  };
  cork.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!STATE.bottleLifted || STATE.corkPopped) return;
    dragging = true; startY = e.clientY; startT = Date.now();
    try { cork.setPointerCapture(e.pointerId); } catch (err) {}
    cork.style.transition = 'none';
    cork.classList.add('dragging');
  });
  cork.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = clamp(e.clientY - startY, -150, 24);
    const rot = clamp(dy * 0.35, -18, 10);
    cork.style.transform = 'translate(-50%, calc(-50% + ' + dy + 'px)) rotate(' + rot + 'deg)';
  });
  const endCork = (e) => {
    if (!dragging) return;
    dragging = false;
    const dy = e.clientY - startY;
    const dur = Date.now() - startT;
    const isTap = Math.abs(dy) < 10 && dur < 280;
    // geser ke atas cukup panjang ATAU cukup (flick cepat) ATAU ketuk (setelah 2x gagal)
    if (dy <= -30 || (dy <= -12 && dur < 320) || (isTap && STATE.corkFails >= 2)) {
      popCork();
    } else {
      STATE.corkFails++;
      snapBack();
      if (STATE.corkFails === 1) showToast('Geser sumbat ke atas ya 🍾');
    }
  };
  cork.addEventListener('pointerup', endCork);
  cork.addEventListener('pointercancel', () => { dragging = false; snapBack(); });
  cork.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (STATE.bottleLifted && !STATE.corkPopped) popCork();
    }
  });
}
function popCork() {
  if (STATE.corkPopped) return;
  STATE.corkPopped = true;
  const cork = $('cork');
  cork.classList.remove('dragging');
  // serahkan transform ke CSS .popped (hapus inline agar animasi terbang bekerja)
  cork.style.transition = '';
  cork.style.transform = '';
  requestAnimationFrame(() => cork.classList.add('popped'));
  sfxWaterDrop(); setTimeout(sfxChime, 150);
  vibrate([20, 40, 20]);
  $('st-4').textContent = 'Pesan rahasianya terbuka! 🍾';
  const note = $('secret-note');
  note.classList.remove('hidden');
  // ketik pesan
  const el = $('note-text');
  el.textContent = '';
  let i = 0;
  const type = () => {
    if (i <= BOTTLE_NOTE.length) {
      el.textContent = BOTTLE_NOTE.slice(0, i);
      i++;
      setTimeout(type, BOTTLE_NOTE[i - 1] === '\n' ? 220 : 18);
    } else {
      $('btn-4-next').classList.remove('hidden');
      spawnFloaters(3);
    }
  };
  type();
}

/* ============================================================
   SCENE 5 — GOSOK KERANG MUTIARA (scratch card)
   ============================================================ */
let scratchInited = false;
function paintClamFoil(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#7dd3fc'); g.addColorStop(0.45, '#0c4a6e'); g.addColorStop(1, '#071326');
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  // tekstur pasir
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = 'rgba(255,255,255,' + rand(0.02, 0.09) + ')';
    ctx.fillRect(rand(0, w), rand(0, h), rand(1, 3), rand(1, 3));
  }
  ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(224,242,254,0.85)';
  ctx.fillText('GOSOK DI SINI', w / 2, h / 2 - 14);
  ctx.font = '26px serif';
  ctx.fillText('🦪', w / 2, h / 2 + 28);
}
function checkScratchDone(card, canvas) {
  const ctx = canvas.getContext('2d');
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let clear = 0;
  for (let i = 3; i < d.length; i += 40) if (d[i] < 40) clear++;
  const total = Math.floor(d.length / 40);
  if (clear / total > 0.5) {
    const idx = +card.dataset.idx;
    if (!STATE.clamsOpened[idx]) {
      STATE.clamsOpened[idx] = true;
      card.classList.add('done');
      sfxChime();
      spawnFloaters(2);
      const n = STATE.clamsOpened.filter(Boolean).length;
      $('st-5').textContent = 'Kerang terbuka: ' + n + '/3';
      if (n >= 3) {
        $('btn-5-next').classList.remove('hidden');
        showToast('Tiga kupon manis terbuka! 🦪💗');
      }
    }
  }
}
function initScene5() {
  if (scratchInited) return;
  scratchInited = true;
  document.querySelectorAll('.clam-card').forEach(card => {
    const canvas = card.querySelector('.clam-canvas');
    paintClamFoil(canvas);
    let drawing = false;
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return {
        x: (src.clientX - r.left) * (canvas.width / r.width),
        y: (src.clientY - r.top) * (canvas.height / r.height)
      };
    };
    const erase = (e) => {
      if (!drawing) return;
      const p = pos(e);
      const ctx = canvas.getContext('2d');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(p.x, p.y, 34, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      checkScratchDone(card, canvas);
    };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault(); drawing = true;
      canvas.setPointerCapture(e.pointerId);
      ensureAudio();
      erase(e);
    });
    canvas.addEventListener('pointermove', erase);
    canvas.addEventListener('pointerup', () => drawing = false);
    canvas.addEventListener('pointercancel', () => drawing = false);
    canvas.addEventListener('pointerleave', () => drawing = false);
  });
}
function repaintScratchCards() {
  STATE.clamsOpened = [false, false, false];
  $('st-5').textContent = 'Kerang terbuka: 0/3';
  $('btn-5-next').classList.add('hidden');
  document.querySelectorAll('.clam-card').forEach(card => {
    card.classList.remove('done');
    paintClamFoil(card.querySelector('.clam-canvas'));
  });
}

/* ============================================================
   SCENE 6 — KEMUDI KAPAL 180°
   ============================================================ */
let wheelAcc = 0, wheelLastAng = null;
function resetWheel() {
  wheelAcc = 0; wheelLastAng = null;
  STATE.wheelDeg = 0; STATE.wheelDone = false;
  const w = $('ship-wheel');
  w.style.transform = 'rotate(0deg)';
  w.classList.remove('done');
  $('compass-needle').style.transform = 'rotate(0deg)';
  $('st-6').textContent = 'Putaran: 0° / 180°';
  $('btn-6-next').classList.add('hidden');
  w.setAttribute('aria-valuenow', '0');
}
function initScene6() {
  const w = $('ship-wheel');
  const angOf = (e) => {
    const r = w.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  };
  w.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (STATE.wheelDone) return;
    unlockAudio();
    wheelLastAng = angOf(e);
    w.setPointerCapture(e.pointerId);
  });
  w.addEventListener('pointermove', (e) => {
    if (wheelLastAng === null || STATE.wheelDone) return;
    const a = angOf(e);
    let d = a - wheelLastAng;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    wheelLastAng = a;
    wheelAcc += Math.abs(d);
    STATE.wheelDeg = Math.min(180, Math.round(wheelAcc));
    w.style.transform = 'rotate(' + wheelAcc + 'deg)';
    $('compass-needle').style.transform = 'rotate(' + STATE.wheelDeg + 'deg)';
    $('st-6').textContent = 'Putaran: ' + STATE.wheelDeg + '° / 180°';
    w.setAttribute('aria-valuenow', String(STATE.wheelDeg));
    if (Math.round(wheelAcc) % 20 === 0) sfxWaterDrop();
    if (STATE.wheelDeg >= 180) completeWheel();
  });
  const end = () => { wheelLastAng = null; };
  w.addEventListener('pointerup', end);
  w.addEventListener('pointercancel', end);
  w.addEventListener('keydown', (e) => {
    if (STATE.wheelDone) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      wheelAcc += 15;
      STATE.wheelDeg = Math.min(180, Math.round(wheelAcc));
      w.style.transform = 'rotate(' + wheelAcc + 'deg)';
      $('compass-needle').style.transform = 'rotate(' + STATE.wheelDeg + 'deg)';
      $('st-6').textContent = 'Putaran: ' + STATE.wheelDeg + '° / 180°';
      if (STATE.wheelDeg >= 180) completeWheel();
    }
  });
}
function completeWheel() {
  STATE.wheelDone = true;
  $('ship-wheel').classList.add('done');
  $('st-6').textContent = 'Haluan lurus menuju pulau bahagia! ⚓💙';
  $('btn-6-next').classList.remove('hidden');
  sfxSoftWave(); sfxChime();
  spawnFloaters(3);
}

/* ============================================================
   SCENE 7 — KOTAK MUSIK NAUTILUS + VISUALIZER
   ============================================================ */
function buildViz() {
  const viz = $('viz');
  viz.innerHTML = '';
  for (let i = 0; i < 16; i++) {
    const b = document.createElement('span');
    b.className = 'viz-bar';
    viz.appendChild(b);
  }
  viz.classList.add('idle');
}
function syncNautilusUI() {
  const playing = A.synthOn || A.mp3Mode || (!$('bg-audio').paused && !$('bg-audio').ended);
  updateMusicUI(playing && !STATE.musicMuted);
  $('st-7').textContent = STATE.nautPlayed ? 'Melodi samudra sedang mengalir 🐚' : 'Melodi belum diputar';
  $('btn-7-next').classList.toggle('hidden', !STATE.nautPlayed);
}
function initScene7() {
  buildViz();
  $('btn-play-naut').addEventListener('click', () => {
    unlockAudio();
    const playing = A.synthOn || A.mp3Mode;
    if (playing) {
      stopMusic();
      $('st-7').textContent = 'Melodi dijeda';
    } else {
      startMusic();
      if (!STATE.nautPlayed) {
        STATE.nautPlayed = true;
        $('st-7').textContent = 'Melodi samudra sedang mengalir 🐚';
        $('btn-7-next').classList.remove('hidden');
        showToast('Kotak musik Nautilus berbunyi 🐚🎵');
      }
    }
  });
  // loop visualizer
  const bars = () => Array.from($('viz').children);
  const tickViz = () => {
    requestAnimationFrame(tickViz);
    if (STATE.currentScene !== 7) return;
    const playing = A.synthOn || (A.mp3Mode && !STATE.musicMuted);
    if (playing && A.analyser) {
      const data = new Uint8Array(A.analyser.frequencyBinCount);
      A.analyser.getByteFrequencyData(data);
      bars().forEach((b, i) => {
        const v = data[i % data.length] / 255;
        b.style.height = (6 + v * 56) + 'px';
      });
    }
  };
  tickViz();
}

/* ============================================================
   SCENE 8 — RASI BINTANG (connect 5 stars)
   ============================================================ */
const STAR_POS = [
  { x: 300, y: 150 },
  { x: 155, y: 105 },
  { x: 95, y: 265 },
  { x: 300, y: 440 },
  { x: 505, y: 265 }
];
let sCtx = null, sAnimOn = false, sTwinkle = 0;
function resetConstellation() {
  STATE.starStep = 0; STATE.starDone = false;
  $('st-8').textContent = 'Bintang tersambung: 0/5';
  $('btn-8-next').classList.add('hidden');
  sCtx = $('star-canvas').getContext('2d');
  if (!sAnimOn) { sAnimOn = true; requestAnimationFrame(drawStars); }
}
function drawStars() {
  requestAnimationFrame(drawStars);
  if (STATE.currentScene !== 8 || !sCtx) return;
  const c = sCtx.canvas;
  sCtx.clearRect(0, 0, c.width, c.height);
  const g = sCtx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#050b1c'); g.addColorStop(1, '#0b1f3a');
  sCtx.fillStyle = g; sCtx.fillRect(0, 0, c.width, c.height);
  // bintang latar
  sTwinkle += 0.05;
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % c.width, y = (i * 61) % c.height;
    const a = 0.25 + Math.abs(Math.sin(sTwinkle + i)) * 0.5;
    sCtx.fillStyle = 'rgba(224,242,254,' + a.toFixed(2) + ')';
    sCtx.fillRect(x, y, 2, 2);
  }
  // garis tersambung
  sCtx.strokeStyle = 'rgba(56,189,248,0.9)';
  sCtx.lineWidth = 4;
  sCtx.shadowColor = '#38bdf8'; sCtx.shadowBlur = 12;
  sCtx.beginPath();
  for (let i = 0; i < STATE.starStep; i++) {
    const p = STAR_POS[i];
    if (i === 0) sCtx.moveTo(p.x, p.y); else sCtx.lineTo(p.x, p.y);
  }
  if (STATE.starStep >= 5) sCtx.lineTo(STAR_POS[0].x, STAR_POS[0].y);
  sCtx.stroke();
  sCtx.shadowBlur = 0;
  // bintang
  STAR_POS.forEach((p, i) => {
    const reached = i < STATE.starStep;
    const pulse = 1 + Math.sin(sTwinkle * 1.6 + i) * 0.12;
    sCtx.beginPath();
    sCtx.arc(p.x, p.y, (reached ? 16 : 13) * pulse, 0, Math.PI * 2);
    sCtx.fillStyle = reached ? '#fde68a' : (i === STATE.starStep ? '#f0fdfa' : 'rgba(224,242,254,0.45)');
    sCtx.shadowColor = reached ? '#fbbf24' : '#7dd3fc';
    sCtx.shadowBlur = reached ? 22 : 10;
    sCtx.fill();
    sCtx.shadowBlur = 0;
    sCtx.fillStyle = '#071326';
    sCtx.font = '700 13px "Plus Jakarta Sans", sans-serif';
    sCtx.textAlign = 'center'; sCtx.textBaseline = 'middle';
    sCtx.fillText(String(i + 1), p.x, p.y + 1);
  });
}
function initScene8() {
  const c = $('star-canvas');
  c.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (STATE.starDone) return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) * (c.width / r.width);
    const y = (e.clientY - r.top) * (c.height / r.height);
    const expect = STAR_POS[STATE.starStep];
    if (!expect) return;
    if (Math.hypot(expect.x - x, expect.y - y) < 44) {
      STATE.starStep++;
      sfxChime();
      $('st-8').textContent = 'Bintang tersambung: ' + STATE.starStep + '/5';
      if (STATE.starStep >= 5) {
        STATE.starDone = true;
        $('st-8').textContent = 'Konstelasi hati sempurna! 🌌💙';
        $('btn-8-next').classList.remove('hidden');
        sfxSoftWave();
        spawnFloaters(4, ['⭐', '✨', '💙']);
        showToast('Rasi bintang hati kita terbentuk! 🌌');
      }
    } else {
      sfxWaterDrop();
      showToast('Bintang nomor ' + (STATE.starStep + 1) + ' dulu ya~');
    }
  });
}

/* ============================================================
   SCENE 9 — POLAROID KENANGAN
   ============================================================ */
const POL_MSGS = [
  'Senja pertama — udara asin, tangan kita saling menggenggam 🌅',
  'Malam bioluminescent — kamu bilang bintang di air lebih indah darimu (aku tidak setuju) ✨',
  'Berenang berdua — paus kecil ikut tersenyum melihat kita 🐬',
  'Perahu kertas — melayang pelan, seperti perasaan kita yang tenang ⛵'
];
function resetPolaroids() {
  STATE.polarOpened = 0;
  document.querySelectorAll('.polaroid').forEach(p => {
    p.classList.remove('flew');
    p.style.pointerEvents = '';
  });
  $('st-9').textContent = 'Foto terbuka: 0/4';
  $('btn-9-next').classList.add('hidden');
}
function initScene9() {
  document.querySelectorAll('.polaroid').forEach(card => {
    card.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (card.classList.contains('flew')) return;
      card.classList.add('flew');
      card.style.pointerEvents = 'none';
      STATE.polarOpened++;
      sfxWaterDrop();
      showToast(POL_MSGS[+card.dataset.i]);
      $('st-9').textContent = 'Foto terbuka: ' + STATE.polarOpened + '/4';
      if (STATE.polarOpened >= 4) {
        $('btn-9-next').classList.remove('hidden');
        sfxChime();
      }
    });
  });
}

/* ============================================================
   SCENE 10 — GELEMBUNG NAPAS CINTA (refleks)
   ============================================================ */
let brCtx = null, brBubbles = [], brAnimOn = false;
const BREATH_TARGET = 6;
function resetBreathGame() {
  STATE.breathCaught = 0; STATE.breathPopped = 0;
  $('st-10').textContent = 'Ditangkap: 0/6 · Pecah: 0';
  $('btn-10-next').classList.add('hidden');
  brCtx = $('breath-canvas').getContext('2d');
  brBubbles = [];
  for (let i = 0; i < 6; i++) spawnBreath();
  if (!brAnimOn) { brAnimOn = true; requestAnimationFrame(drawBreath); }
}
function spawnBreath() {
  brBubbles.push({
    x: rand(70, 530), y: rand(70, 450),
    r: rand(34, 46),
    life: 1, maxLife: rand(2.8, 3.6),
    born: performance.now() / 1000
  });
}
function drawBreath() {
  requestAnimationFrame(drawBreath);
  if (STATE.currentScene !== 10 || !brCtx) return;
  const c = brCtx.canvas;
  brCtx.clearRect(0, 0, c.width, c.height);
  const g = brCtx.createLinearGradient(0, 0, 0, c.height);
  g.addColorStop(0, '#04203a'); g.addColorStop(1, '#021426');
  brCtx.fillStyle = g; brCtx.fillRect(0, 0, c.width, c.height);
  const now = performance.now() / 1000;
  brBubbles = brBubbles.filter(b => b.life > 0);
  brBubbles.forEach(b => {
    b.life = 1 - (now - b.born) / b.maxLife;
    if (b.life <= 0) {
      STATE.breathPopped++;
      sfxWaterDrop();
      $('st-10').textContent = 'Ditangkap: ' + STATE.breathCaught + '/6 · Pecah: ' + STATE.breathPopped;
      spawnBreath();
      return;
    }
    const rr = b.r * (0.55 + b.life * 0.45);
    const grad = brCtx.createRadialGradient(b.x - rr * 0.3, b.y - rr * 0.3, rr * 0.15, b.x, b.y, rr);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.5, 'rgba(56,189,248,' + (0.35 + b.life * 0.3).toFixed(2) + ')');
    grad.addColorStop(1, 'rgba(2,132,199,0.15)');
    brCtx.beginPath(); brCtx.arc(b.x, b.y, rr, 0, Math.PI * 2);
    brCtx.fillStyle = grad; brCtx.fill();
    brCtx.strokeStyle = 'rgba(125,211,252,' + (0.4 + b.life * 0.5).toFixed(2) + ')';
    brCtx.lineWidth = 2.5; brCtx.stroke();
    // bar waktu
    brCtx.fillStyle = 'rgba(244,63,94,0.85)';
    brCtx.fillRect(b.x - rr, b.y - rr - 10, rr * 2 * b.life, 4);
    brCtx.font = '20px serif'; brCtx.textAlign = 'center'; brCtx.textBaseline = 'middle';
    brCtx.fillText('O₂', b.x, b.y + 1);
    b._rr = rr;
  });
}
function initScene10() {
  const c = $('breath-canvas');
  c.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) * (c.width / r.width);
    const y = (e.clientY - r.top) * (c.height / r.height);
    for (let i = 0; i < brBubbles.length; i++) {
      const b = brBubbles[i];
      if (b.life <= 0) continue;
      if (Math.hypot(b.x - x, b.y - y) <= (b._rr || b.r) + 6) {
        brBubbles.splice(i, 1);
        STATE.breathCaught++;
        sfxChime();
        vibrate(12);
        spawnBreath();
        $('st-10').textContent = 'Ditangkap: ' + STATE.breathCaught + '/6 · Pecah: ' + STATE.breathPopped;
        if (STATE.breathCaught >= BREATH_TARGET) {
          $('btn-10-next').classList.remove('hidden');
          showToast('Semua napas cinta terselamatkan! 🤿💙');
          spawnFloaters(3);
        }
        break;
      }
    }
  });
}

/* ============================================================
   SCENE 11 — PELAMPUNG PELUKAN (tahan 3.5 detik)
   ============================================================ */
let hugUp = null, hugDown = null;
const HUG_C = 490.09;
function setHug(v) {
  STATE.hugProgress = clamp(v, 0, 100);
  $('buoy-fill').style.strokeDashoffset = String(HUG_C * (1 - STATE.hugProgress / 100));
  $('st-11').textContent = 'Progres pelukan: ' + Math.round(STATE.hugProgress) + '%';
}
function resetHug() {
  clearInterval(hugUp); clearInterval(hugDown);
  hugUp = hugDown = null;
  STATE.hugProgress = 0; STATE.hugDone = false;
  setHug(0);
  $('btn-hug').classList.remove('holding');
  $('hug-result').classList.add('hidden');
  $('btn-11-next').classList.add('hidden');
}
function startHug() {
  if (STATE.hugDone) return;
  unlockAudio();
  clearInterval(hugDown);
  $('btn-hug').classList.add('holding');
  clearInterval(hugUp);
  hugUp = setInterval(() => {
    setHug(STATE.hugProgress + 1.8);
    if (STATE.hugProgress >= 100) completeHug();
  }, 60);
}
function stopHug() {
  if (STATE.hugDone) return;
  clearInterval(hugUp);
  $('btn-hug').classList.remove('holding');
  clearInterval(hugDown);
  hugDown = setInterval(() => {
    if (STATE.hugProgress <= 0) { clearInterval(hugDown); return; }
    setHug(STATE.hugProgress - 3);
  }, 30);
}
function completeHug() {
  clearInterval(hugUp); clearInterval(hugDown);
  STATE.hugDone = true;
  setHug(100);
  $('btn-hug').classList.remove('holding');
  $('hug-result').classList.remove('hidden');
  $('btn-11-next').classList.remove('hidden');
  $('st-11').textContent = 'Pelukan hangat terkirim non-stop 3.5 detik 🤗';
  sfxChime(); sfxSoftWave();
  vibrate([40, 60, 40]);
  spawnFloaters(5);
  showToast('Pelukan hangat meluncur dariku 🛟💗');
}
function initScene11() {
  const btn = $('btn-hug');
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); startHug(); });
  btn.addEventListener('pointerup', stopHug);
  btn.addEventListener('pointercancel', stopHug);
  btn.addEventListener('pointerleave', stopHug);
  window.addEventListener('pointerup', stopHug);
  setHug(0);
}

/* ============================================================
   SCENE 12 — SURAT PALUNG TERDALAM (typewriter)
   ============================================================ */
const LETTER_TEXT =
  'Kepada samudra kecilku,\n\n' +
  'Aku tidak pandai berlayar,\ntapi setiap kali aku melihat matamu,\nlayar otomatis terbuka dan angin membawaku ke arahmu.\n\n' +
  'Di palung terdalam, tekanan air bisa menghancurkan kapal,\ntapi tidak pernah bisa menghancurkan rasa ini.\n\n' +
  'Terima kasih sudah menjadi tempat pulangku,\ndi lautan yang selalu berubah. 💙';
let letterTimers = [];
function addLetterTimer(fn, t) { letterTimers.push(setTimeout(fn, t)); }
function clearLetterTimers() { letterTimers.forEach(clearTimeout); letterTimers = []; }
function resetLetter() {
  clearLetterTimers();
  STATE.letterDone = false;
  const env = $('envelope');
  env.classList.remove('opened');
  $('mail-wrap').classList.remove('open');
  $('letter-text').textContent = '';
  $('letter-sign').textContent = '';
  $('letter-cursor').style.display = 'none';
  $('env-letter').scrollTop = 0;
  $('st-12').textContent = 'Amplop masih tersegel...';
  $('btn-12-next').classList.add('hidden');
}
function typeLetter(full, done) {
  const el = $('letter-text');
  const cur = $('letter-cursor');
  cur.style.display = 'inline-block';
  el.textContent = '';
  let i = 0;
  const step = () => {
    if (STATE.currentScene !== 12) return;
    if (i <= full.length) {
      el.textContent = full.slice(0, i);
      const paper = $('env-letter');
      paper.scrollTop = paper.scrollHeight;
      const ch = full[i - 1];
      i++;
      addLetterTimer(step, ch === '\n' ? 320 : rand(28, 58));
    } else {
      cur.style.display = 'none';
      done();
    }
  };
  step();
}
function openLetter() {
  if (STATE.letterDone) return;
  $('envelope').classList.add('opened');
  $('mail-wrap').classList.add('open');
  $('st-12').textContent = 'Amplop terbuka... pesan mengalir 📜';
  sfxSoftWave();
  addLetterTimer(() => {
    sfxWaterDrop();
    typeLetter(LETTER_TEXT, () => {
      $('letter-sign').textContent = '— dari palung terdalam 💙';
      STATE.letterDone = true;
      $('st-12').textContent = 'Surat selesai dibaca 📜💙';
      $('btn-12-next').classList.remove('hidden');
      sfxChime();
      spawnFloaters(3);
    });
  }, 950);
}
function initScene12() {
  const env = $('envelope');
  env.addEventListener('click', () => { if (!STATE.letterDone) openLetter(); });
  env.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!STATE.letterDone) openLetter();
    }
  });
}

/* ============================================================
   SCENE 13 — UBUR-UBUR USIL (runaway)
   ============================================================ */
const TAUNTS = ['Hahaha, nggak kejar aku! 🪼', 'Nggak mau~', 'Masih belum menyerah? 😜', 'Aku cepat loh!', 'Sudah, klik yang bener! 🥺', 'Yah, hampir kena!'];
function resetRunaway() {
  STATE.noRuns = 0;
  const no = $('btn-no');
  no.style.left = '20%'; no.style.top = '40%';
  no.textContent = 'Nggak Mau';
  $('st-13').textContent = 'Berapa kali dia kabur? 0';
  $('run-jelly').style.left = ''; $('run-jelly').style.right = '10px';
}
function runAway(clientX, clientY) {
  const area = $('runaway-area');
  const no = $('btn-no');
  const ar = area.getBoundingClientRect();
  const nr = no.getBoundingClientRect();
  let x = rand(14, 86), y = rand(16, 84);
  // pastikan jauh dari posisi kursor
  for (let i = 0; i < 8; i++) {
    const px = ar.left + ar.width * x / 100;
    const py = ar.top + ar.height * y / 100;
    if (Math.hypot(px - clientX, py - clientY) > 110) break;
    x = rand(14, 86); y = rand(16, 84);
  }
  no.style.left = x + '%';
  no.style.top = y + '%';
  no.textContent = TAUNTS[STATE.noRuns % TAUNTS.length];
  STATE.noRuns++;
  $('st-13').textContent = 'Berapa kali dia kabur? ' + STATE.noRuns;
  sfxWaterDrop();
  vibrate(10);
  const jelly = $('run-jelly');
  jelly.style.right = 'auto';
  jelly.style.left = clamp(100 - x - 8, 2, 88) + '%';
  spawnFloaters(2, ['🫧', '💨']);
}
function initScene13() {
  const area = $('runaway-area');
  const no = $('btn-no');
  no.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    unlockAudio();
    runAway(e.clientX, e.clientY);
  });
  area.addEventListener('pointermove', (e) => {
    const nr = no.getBoundingClientRect();
    const cx = nr.left + nr.width / 2, cy = nr.top + nr.height / 2;
    if (Math.hypot(e.clientX - cx, e.clientY - cy) < 78) runAway(e.clientX, e.clientY);
  });
  $('btn-yes').addEventListener('click', () => {
    sfxChime(); sfxSoftWave();
    vibrate([30, 50, 30]);
    showToast('Akhirnya dia bilang "Mau"! 💗🪼');
    spawnFloaters(6);
    $('st-13').textContent = 'Ubur-ubur luluh! 💗';
    setTimeout(() => { if (STATE.currentScene === 13) nextScene(); }, 1300);
  });
}

/* ============================================================
   SCENE 14 — GRAND FINALE + WHATSAPP
   ============================================================ */
let confetti = [], confettiOn = false;
function setWALink() {
  const phone = '6281249192305';
  const msg = 'Hai! Aku baru saja menyelesaikan 14 babak Samudra Rasa 🌊. Semua samudra ini hanya untukmu 💙';
  $('btn-wa').href = 'https://wa.me/' + phone + '?text=' + encodeURIComponent(msg);
}
function launchFinale() {
  if (STATE.finaleLaunched) return;
  STATE.finaleLaunched = true;
  const canvas = $('finale-canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#38bdf8', '#7dd3fc', '#e0f2fe', '#f43f5e', '#fb7185', '#0284c7', '#f0fdfa', '#fbbf24'];
  confetti = [];
  for (let i = 0; i < 130; i++) {
    confetti.push({
      x: rand(0, canvas.width), y: rand(-canvas.height, -10),
      vx: rand(-1.4, 1.4), vy: rand(2.2, 5.2),
      r: rand(4, 9), rot: rand(0, Math.PI * 2), rotV: rand(-0.15, 0.15),
      c: colors[Math.floor(Math.random() * colors.length)],
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      w: rand(5, 10), h: rand(8, 14)
    });
  }
  if (!confettiOn) { confettiOn = true; requestAnimationFrame(drawConfetti); }
  sfxSoftWave(); sfxChime();
  spawnFloaters(8, ['🎆', '💙', '🌊', '✨', '💗']);
  showToast('Selamat! Kita sampai di finale 🎆');
  setTimeout(() => {
    const cv = $('finale-canvas');
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    confetti = [];
  }, 9000);
}
function drawConfetti() {
  requestAnimationFrame(drawConfetti);
  if (confetti.length === 0) return;
  const canvas = $('finale-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  confetti.forEach(p => {
    p.x += p.vx; p.y += p.vy; p.vy += 0.045; p.rot += p.rotV;
    if (p.y > canvas.height + 20) { p.y = rand(-40, -10); p.x = rand(0, canvas.width); p.vy = rand(2.2, 5); }
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.c;
    if (p.shape === 'rect') ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  });
}

/* ============================================================
   AMBIENT CANVAS — gelembung bioluminescent
   ============================================================ */
function initAmbient() {
  const canvas = $('ambient-canvas');
  const ctx = canvas.getContext('2d');
  let parts = [];
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    parts = [];
    const n = window.innerWidth < 500 ? 34 : 55;
    for (let i = 0; i < n; i++) {
      parts.push({
        x: rand(0, canvas.width), y: rand(0, canvas.height),
        r: rand(1.5, 5.5), v: rand(0.25, 0.95),
        wob: rand(0, Math.PI * 2), jelly: Math.random() > 0.93
      });
    }
  };
  resize();
  window.addEventListener('resize', resize);
  const loop = () => {
    requestAnimationFrame(loop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    parts.forEach(p => {
      p.y -= p.v; p.wob += 0.02; p.x += Math.sin(p.wob) * 0.35;
      if (p.y < -12) { p.y = canvas.height + 10; p.x = rand(0, canvas.width); }
      if (p.jelly) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 2.4, Math.PI, 0);
        ctx.quadraticCurveTo(p.x + p.r * 2.4, p.y + p.r * 1.4, p.x, p.y + p.r * 1.2);
        ctx.quadraticCurveTo(p.x - p.r * 2.4, p.y + p.r * 1.4, p.x - p.r * 2.4, p.y);
        ctx.fillStyle = 'rgba(56,189,248,0.16)';
        ctx.fill();
      } else {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.2);
        g.addColorStop(0, 'rgba(125,211,252,0.55)');
        g.addColorStop(1, 'rgba(56,189,248,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2); ctx.fill();
      }
    });
  };
  loop();
}

/* ============================================================
   MUSIC PILL + RESTART + INIT
   ============================================================ */
function initMusicPill() {
  $('music-pill').addEventListener('click', () => {
    ensureAudio();
    toggleMusic();
  });
  const audio = $('bg-audio');
  audio.addEventListener('error', () => { A.mp3Ok = false; A.mp3Failed = true; });
  audio.addEventListener('pause', () => { if (A.mp3Mode) updateMusicUI(false); });
  audio.addEventListener('play', () => { A.mp3Mode = true; updateMusicUI(true); });
}

function restartJourney() {
  // reset semua state & DOM game
  const keepMute = STATE.musicMuted;
  STATE = defaultState();
  STATE.musicMuted = keepMute;
  try { localStorage.removeItem(SCENE_KEY); } catch (e) {}

  clearInterval(scanTimer); setScan(0);
  $('sonar-sweep').classList.remove('scanning');
  $('sonar-ping').classList.remove('found');
  $('st-2').textContent = 'Menunggu pemindaian...';
  $('btn-2-next').classList.add('hidden');

  const sl = $('light-slider');
  sl.value = 0; sl.style.setProperty('--prog', '0%');
  $('lighthouse').classList.remove('lit');
  STATE.light = 0; STATE.ignites = 0;
  updateScene1();

  resetBottle();
  repaintScratchCards();
  resetWheel();
  resetPolaroids();
  resetHug();
  resetLetter();
  resetRunaway();
  STATE.finaleLaunched = false;
  confetti = [];
  const fcv = $('finale-canvas');
  fcv.getContext('2d').clearRect(0, 0, fcv.width, fcv.height);
  STATE.nautPlayed = false;

  // kembali ke scene 1
  for (let i = 2; i <= 14; i++) $('scene-' + i).classList.remove('active');
  $('scene-1').classList.add('active');
  STATE.currentScene = 1;
  updateProgress(1);
  $('stage').scrollTop = 0;
  showToast('Berlayar lagi dari mercusuar 🗼🌊');
  sfxSoftWave();
}

/* ---- koreksi sceneOut keyframes via JS (agar style tetap rapi) ---- */
function injectKeyframes() {
  const s = document.createElement('style');
  s.textContent = '@keyframes sceneOut{to{opacity:0;transform:translateY(-20px) scale(0.95)}}';
  document.head.appendChild(s);
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  injectKeyframes();
  buildProgressDots();
  updateProgress(1);
  initAmbient();
  initMusicPill();
  setWALink();
  probeMp3();

  // pasang handler semua tombol "Berlayar / Lanjut →"
  document.querySelectorAll('.btn-main[id$="-next"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('hidden')) return;
      nextScene();
    });
  });

  initScene1();
  initScene2();
  initScene3();
  initScene4();
  initScene5();
  initScene6();
  initScene7();
  initScene8();
  initScene9();
  initScene10();
  initScene11();
  initScene12();
  initScene13();

  // unlock audio pada gesture pertama (kebijakan autoplay HP)
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev => {
    window.addEventListener(ev, function once() {
      window.removeEventListener(ev, once);
      unlockAudio();
    }, { once: true });
  });

  // restore progres tersimpan
  let saved = 0;
  try { saved = parseInt(localStorage.getItem(SCENE_KEY) || '0', 10); } catch (e) {}
  if (saved >= 2 && saved <= STATE.totalScenes) {
    $('scene-1').classList.remove('active');
    STATE.currentScene = saved;
    $('scene-' + saved).classList.add('active');
    updateProgress(saved);
    onSceneEnter(saved);
    showToast('Melanjutkan dari babak ' + saved + ' 🌊');
  }
});
