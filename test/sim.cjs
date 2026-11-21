'use strict';
/* Simulador headless de la lógica de RIVER STRIKE (sin DOM real). */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'src', 'js');

function ctxStub() {
  const grad = { addColorStop() {} };
  const target = {
    canvas: { width: 540, height: 800 },
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    createPattern: () => ({}),
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: [] }),
    setTransform() {}, save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arc() {}, ellipse() {},
    arcTo() {}, fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, clearRect() {},
    drawImage() {}, fillText() {}, strokeText() {}, clip() {}, putImageData() {}
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'string' && k.startsWith('__')) return undefined;
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

const store = {};
const sandbox = {
  console,
  performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 },
  Math, Date, JSON, Map, Set, Proxy, isFinite, parseInt, parseFloat, Number, String, Object, Array,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  addEventListener() {}, removeEventListener() {},
  requestAnimationFrame() { return 0; },
  document: {
    readyState: 'complete',
    addEventListener() {},
    getElementById: () => ({ style: {}, getContext: () => ctxStub(), addEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 540, height: 800 }), width: 540, height: 800 }),
    createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctxStub(), addEventListener() {} }),
    documentElement: { requestFullscreen() {} },
    fullscreenElement: null
  },
  navigator: { userAgent: 'node' }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.innerWidth = 540;
sandbox.window.innerHeight = 800;
sandbox.window.devicePixelRatio = 1;

vm.createContext(sandbox);

for (const f of ['00-core.js', '10-audio.js', '20-sprites.js', '30-world.js', '40-update.js']) {
  const code = fs.readFileSync(path.join(SRC, f), 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}

const api = vm.runInContext(`
  var keys = {};
  var ptr = { down: false, x: null };
  globalThis.__api = {
    Game, enemies, particles, bullets, keys, ptr, startGame, update, rowAt, waterSegs, S,
    get enemiesList(){ return enemies; }, get particlesList(){ return particles; }
  };
  __api;
`, sandbox);

const keys = api.keys, ptr = api.ptr;
const G = api;

function run(seconds, opts = {}) {
  G.startGame();
  keys[' '] = true;
  let frames = 0, deaths = 0, prev = G.Game.lives;
  const reasons = [];
  const log = [];
  for (let i = 0; i < seconds * 60; i++) {
    const st = G.Game.state;
    if (st === G.S.OVER) break;
    if (st === G.S.PLAY) bot();
    G.update(1 / 60);
    frames++;
    if (G.Game.lives !== prev) { deaths++; prev = G.Game.lives; reasons.push(G.Game.deathReason + '@t' + (i / 60).toFixed(0) + 's' + (G.Game.sector + 1)); }
    if (i % 600 === 0) log.push({ t: +(i / 60).toFixed(0), sc: G.Game.score, sec: G.Game.sector, fuel: Math.round(G.Game.fuel), lv: G.Game.lives });
  }
  keys[' '] = false;
  return {
    seconds: +(frames / 60).toFixed(1), score: G.Game.score, sector: G.Game.sector + 1,
    lives: G.Game.lives, deaths, kills: G.Game.kills, bridges: G.Game.bridges,
    comboMax: G.Game.comboMax, acc: G.Game.shots ? Math.round(100 * G.Game.hits / G.Game.shots) : 0,
    state: G.Game.state, dist: +(G.Game.worldY / 100).toFixed(1), reasons, log
  };
}

function bot() {
  const Gm = G.Game;
  // corredor: intersección de segmentos de agua hacia delante
  let lo = Gm.px - 46, hi = Gm.px + 46;
  for (const ahead of [20, 60, 110, 170, 240]) {
    const r = G.rowAt(Gm.worldY + ahead);
    if (!r) break;
    const segs = G.waterSegs(r).slice().sort((a, b) => (b[1] - b[0]) - (a[1] - a[0]));
    let seg = null;
    for (const s of segs) { if (s[1] > lo + 10 && s[0] < hi - 10) { seg = s; break; } }
    if (!seg) break;
    lo = Math.max(lo, seg[0]); hi = Math.min(hi, seg[1]);
    if (hi - lo < 34) { const c = (seg[0] + seg[1]) / 2; lo = c - 17; hi = c + 17; }
  }
  let tx = (lo + hi) / 2;

  let dodge = 0;
  for (const e of G.enemiesList) {
    const dy = e.wy - Gm.worldY;
    if (e.type === 'fuel') continue;
    if (dy > -30 && dy < 190 && Math.abs(e.x - Gm.px) < 40) {
      dodge += (e.x > Gm.px ? -1 : 1) * (190 - Math.abs(dy)) * 1.1;
    }
  }
  if (Gm.fuel < 55) {
    let bf = null, bd = 1e9;
    for (const e of G.enemiesList) {
      if (e.type !== 'fuel') continue;
      const d = Math.abs(e.wy - Gm.worldY);
      if (d < bd && d < 320) { bd = d; bf = e; }
    }
    if (bf) tx = bf.x;
  }
  tx += dodge;
  tx = Math.max(lo, Math.min(hi, tx));
  keys['ArrowLeft'] = tx < Gm.px - 3;
  keys['ArrowRight'] = tx > Gm.px + 3;
  keys['ArrowUp'] = Gm.throttle < 1.0 && Gm.fuel > 60;
  keys['ArrowDown'] = Gm.fuel < 20 || Gm.throttle > 1.6;
}

module.exports = { run, sandbox, keys, Game: G.Game };

if (require.main === module) {
  const runs = [];
  for (let k = 0; k < 5; k++) runs.push(run(180));
  for (const r of runs) console.log(JSON.stringify(r));
}
