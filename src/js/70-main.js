'use strict';
/* =========================================================================
   70-main.js · arranque, entrada, bucle principal
   ========================================================================= */

const keys = {};
const ptr = { down: false, x: null, touched: false };

function fit() {
  const availW = Math.max(240, window.innerWidth);
  const availH = Math.max(320, window.innerHeight);
  const scale = Math.min(availW / W, availH / H);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
  if (cvs.width !== bw || cvs.height !== bh) { cvs.width = bw; cvs.height = bh; }
  viewScale = scale;
  cvs.style.width = Math.floor(W * scale) + 'px';
  cvs.style.height = Math.floor(H * scale) + 'px';
}

function boot() {
  cvs = document.getElementById('game');
  ctx = cvs.getContext('2d', { alpha: false, desynchronized: true });
  fit();
  makeGradients();
  buildSprites();
  buildUI();
  resetTerrain();
  ensureTerrain();
  Game.hi = Save.data.hi || 0;
  Game.state = S.SPLASH;
  Game.stateT = 0;

  Save.readDisk().then(() => {
    Game.hi = Math.max(Game.hi, Save.data.hi || 0);
  }).catch(() => {});

  // asegurar foco del documento: en WKWebView sin foco no llegan los keydown
  try {
    document.body.setAttribute('tabindex', '-1');
    document.body.style.outline = 'none';
    document.body.focus();
  } catch (e) { /* noop */ }
  window.focus();

  window.addEventListener('resize', fit);

  requestAnimationFrame(frame);
  document.getElementById('boot').style.display = 'none';
}

/* ------------------------------------------------------------------ input */
function startOrSkip() {
  audioInit();
  if (Game.state === S.SPLASH) { Game.skipSplash = true; return; }
  if (Game.state === S.TITLE) { startGame(); return; }
  if (Game.state === S.OVER && Game.stateT > 0.65) { startGame(); return; }
  if (Game.state === S.PAUSE) { Game.state = S.PLAY; Game.stateT = 0; engineSet(true, Game.throttle); return; }
}

window.addEventListener('keydown', e => {
  const k = e.key;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Spacebar'].includes(k)) e.preventDefault();
  if (e.repeat) return;
  audioInit();
  keys[k] = true;

  if (k === 'm' || k === 'M') {
    audioMute();
    if (Game.state === S.PLAY && Audio2.ready) Audio2.master.gain.value = Save.data.mute ? 0 : 0.72;
    return;
  }
  if (k === 'f' || k === 'F') { toggleFullscreen(); return; }

  if (Game.state === S.SPLASH) { Game.skipSplash = true; return; }

  if (k === 'p' || k === 'P') {
    if (Game.state === S.PLAY) { Game.state = S.PAUSE; Game.stateT = 0; engineSet(false, 1); musicStop(); }
    else if (Game.state === S.PAUSE) { Game.state = S.PLAY; Game.stateT = 0; engineSet(true, Game.throttle); musicStart(); }
    return;
  }
  if (k === 'Escape') {
    if (Game.state === S.PLAY) { Game.state = S.PAUSE; Game.stateT = 0; engineSet(false, 1); musicStop(); }
    else if (Game.state === S.PAUSE) { startGame(); }
    else if (Game.state === S.OVER) { Game.state = S.TITLE; Game.stateT = 0; musicReset(); musicTitle(); }
    return;
  }
  if (k === ' ' || k === 'Enter') startOrSkip();
  if ((k === 'r' || k === 'R') && Game.state === S.OVER) startGame();
});

window.addEventListener('keyup', e => { keys[e.key] = false; });
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  ptr.down = false; ptr.x = null;
  if (Game.state === S.PLAY) { Game.state = S.PAUSE; Game.stateT = 0; engineSet(false, 1); musicStop(); }
});

function canvasX(e) {
  const r = cvs.getBoundingClientRect();
  let cx = e.clientX;
  if (cx === undefined || cx === null) {
    if (e.touches && e.touches[0]) cx = e.touches[0].clientX;
    else if (e.changedTouches && e.changedTouches[0]) cx = e.changedTouches[0].clientX;
    else return null;
  }
  const x = ((cx - r.left) / Math.max(1, r.width)) * W;
  return isFinite(x) ? x : null;      // nunca dejamos un NaN entrar al juego
}
function clearPointer() { ptr.down = false; ptr.x = null; }

function onDown(e) {
  audioInit();
  if (Game.state === S.SPLASH) { Game.skipSplash = true; return; }
  if (Game.state === S.TITLE) { startGame(); return; }
  if (Game.state === S.OVER) { if (Game.stateT > 0.65) startGame(); return; }
  if (Game.state === S.PAUSE) { Game.state = S.PLAY; Game.stateT = 0; engineSet(true, Game.throttle); musicStart(); return; }
  const x = canvasX(e);
  if (x === null) return;
  ptr.down = true;
  ptr.x = x;
  if (e.pointerType === 'touch' || e.pointerType === 'pen') ptr.touched = true;
  e.preventDefault();
}
cvs = document.getElementById('game');
if (cvs) {
  cvs.addEventListener('pointerdown', onDown);
  cvs.addEventListener('pointermove', e => {
    if (!ptr.down) return;
    if (e.buttons === 0) { clearPointer(); return; }   // el botón ya se soltó fuera
    const x = canvasX(e);
    if (x !== null) ptr.x = x;
  });
  cvs.addEventListener('pointerleave', () => { if (ptr.down) clearPointer(); });
  cvs.addEventListener('contextmenu', e => e.preventDefault());
}
// redes de seguridad: cualquier final de pulsación, en cualquier sitio, libera el puntero
['pointerup', 'pointercancel', 'mouseup', 'touchend', 'touchcancel'].forEach(ev =>
  window.addEventListener(ev, clearPointer, { passive: true }));
window.addEventListener('blur', clearPointer);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    for (const k in keys) keys[k] = false;
    clearPointer();
    if (Game.state === S.PLAY) {
      Game.state = S.PAUSE; Game.stateT = 0; engineSet(false, 1); musicStop();
    }
  } else {
    // al volver, el keyup pudo perderse: partimos de cero
    for (const k in keys) keys[k] = false;
    clearPointer();
  }
});

async function toggleFullscreen() {
  try {
    if (window.__TAURI__ && window.__TAURI__.window) {
      const win = window.__TAURI__.window.getCurrentWindow();
      const fs = await win.isFullscreen();
      await win.setFullscreen(!fs);
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (e) { /* noop */ }
}

/* ------------------------------------------------------------------ bucle */
let lastTs = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  if (!lastTs) lastTs = ts;
  let dt = (ts - lastTs) / 1000;
  lastTs = ts;
  if (!isFinite(dt) || dt <= 0) dt = 1 / 60;
  dt = Math.min(dt, 1 / 20);
  update(dt);
  draw();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
