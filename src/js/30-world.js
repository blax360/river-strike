'use strict';
/* =========================================================================
   30-world.js · estado del juego, terreno procedural, partículas, entidades
   ========================================================================= */

const Game = {
  state: S.SPLASH, stateT: 0, T: 0,
  score: 0, hi: Save.data.hi || 0, lives: 3, sector: 0,
  worldY: 0, speed: 0, base: 118, throttle: 1,
  fuel: 100, heat: 0, overheat: 0, invuln: 0, fireCd: 0,
  combo: 0, comboT: 0, comboMax: 0,
  kills: 0, shots: 0, hits: 0, bridges: 0,
  banner: '', bannerSub: '', bannerT: 0,
  shakeT: 0, shakeDur: 1, shakeMag: 0, hitstop: 0,
  flash: 0, flashCol: '#ffffff',
  px: W / 2, ptilt: 0, newHi: false, nextLife: 10000,
  runT: 0, lowBeep: 0, refBlip: 0, warnT: 0, introT: 0,
  rank: 0, fuelWarn: 0,
  pw: { double: 0, shield: 0, x2: 0 }, pwLast: null
};

/* ------------------------------------------------------------- power-ups */
const PWTYPES = {
  double: { label: 'D', name: 'DOBLE', col: '#8fe3ff', dur: 11 },
  shield: { label: 'E', name: 'ESCUDO', col: '#8dffb9', dur: 2.6 },
  x2:     { label: 'X', name: 'PUNTOS x2', col: '#ffd76a', dur: 9 }
};
const pwActive = k => (Game.pw[k] || 0) > 0;

const PY = HUD_TOP + PLAY_H * 0.74;
const AHEAD = PY - HUD_TOP;          // mundo visible por delante
const BEHIND = H - HUD_BOT - PY;     // mundo visible por detrás

let terrain = new Map();
let gen = null;
let enemies = [], bullets = [], particles = [], powerups = [];

/* --------------------------------------------------------------- terreno */
function waterSegs(row) {
  if (!row) return [[0, W]];
  if (row.il >= 0 && row.ir > row.il) return [[row.l, row.il], [row.ir, row.r]];
  return [[row.l, row.r]];
}
function rowAt(wy) { return terrain.get(Math.floor(wy / ROW_H)); }

function resetTerrain() {
  terrain = new Map();
  enemies = []; bullets = []; particles = []; powerups = [];
  Game.pw = { double: 0, shield: 0, x2: 0 };
  gen = {
    i: -40,
    l: W * 0.19, r: W * 0.81, tl: W * 0.19, tr: W * 0.81,
    untilTarget: 26, untilBridge: 110, bridgeRows: 0, bl: 0, br: 0,
    cool: 55, bridges: 0, untilIsland: randi(70, 130), island: null
  };
}

function genRow() {
  const g = gen, i = g.i++;
  let bridge = false;

  if (g.bridgeRows > 0) { g.bridgeRows--; bridge = true; }
  else if (!g.island && --g.untilBridge <= 0) {
    g.bridgeRows = 8;
    g.bl = g.l - 14; g.br = g.r + 14;
    bridge = true; g.cool = 30;
    g.untilBridge = randi(150, 240);
  }

  if (!bridge && !g.island) {
    if (--g.untilTarget <= 0) {
      g.untilTarget = randi(20, 50);
      const st = Math.random();
      const narrow = Math.min(0.62, g.bridges * 0.03);
      if (st < 0.16) {
        const c = rand(W * 0.34, W * 0.66), hf = rand(52, 78) * (1 - narrow);
        g.tl = c - hf; g.tr = c + hf;
      } else if (st < 0.42) {
        g.tl = rand(24, W * 0.30); g.tr = rand(W * 0.70, W - 24);
      } else {
        g.tl = clamp(g.tl + rand(-78, 78), 24, W * 0.33);
        g.tr = clamp(g.tr + rand(-78, 78), W * 0.67, W - 24);
      }
      const minW = Math.max(112, 150 - g.bridges * 4);
      if (g.tr - g.tl < minW) { const c = (g.tl + g.tr) / 2; g.tl = c - minW / 2; g.tr = c + minW / 2; }
      g.tl = clamp(g.tl, 18, W - 18); g.tr = clamp(g.tr, 18, W - 18);
    }
    g.l += clamp(g.tl - g.l, -2.4, 2.4);
    g.r += clamp(g.tr - g.r, -2.4, 2.4);
  }

  let il = -1, ir = -1;
  if (!bridge) {
    if (g.island) {
      const s = g.island; s.t++;
      const wf = Math.min(1, s.t / 7, (s.total - s.t) / 7);
      if (wf <= 0) g.island = null;
      else { const hf = s.half * Math.max(0, wf); il = s.cx - hf; ir = s.cx + hf; }
    } else if (--g.untilIsland <= 0) {
      g.untilIsland = randi(80, 160);
      const wd = g.r - g.l;
      if (wd > 250) {
        const hf = rand(30, 50);
        g.island = { t: 0, total: randi(28, 48), half: hf, cx: rand(g.l + 60 + hf, g.r - 60 - hf) };
      }
    }
  }

  terrain.set(i, { l: g.l, r: g.r, il, ir, bridge, bl: g.bl, br: g.br });

  if (g.cool > 0) g.cool--;
  else if (!bridge && i > 70) {
    const p = 0.045 + Math.min(0.055, g.bridges * 0.008);
    if (Math.random() < p) spawnEnemy(i);
  }
}

function spawnEnemy(i) {
  const segs = waterSegs(terrain.get(i));
  const seg = pick(segs);
  if (seg[1] - seg[0] < 64) return;
  const x = rand(seg[0] + 26, seg[1] - 26);
  const r0 = Math.random();
  let type = r0 < 0.36 ? 'ship' : r0 < 0.60 ? 'heli' : r0 < 0.84 ? 'fuel' : 'jet';
  if (game_sector() >= 2 && Math.random() < 0.10) type = 'missile';
  const vx = type === 'ship' ? (Math.random() < 0.5 ? -1 : 1) * (16 + gen.bridges * 3)
    : type === 'heli' ? (Math.random() < 0.5 ? -1 : 1) * (44 + gen.bridges * 6) : 0;
  enemies.push({
    type, x, wy: i * ROW_H + ROW_H / 2, vx,
    bob: rand(0, 6), hp: 1, t: 0, dead: false,
    mdir: Math.random() < 0.5 ? -1 : 1
  });
}
const game_sector = () => Game.sector;

function ensureTerrain() {
  const need = Math.floor((Game.worldY + AHEAD + 280) / ROW_H);
  let guard = 0;
  while (gen.i <= need && guard++ < 400) genRow();
  const drop = Math.floor((Game.worldY - BEHIND - 100) / ROW_H);
  if (terrain.size > 460) {
    for (const k of terrain.keys()) if (k < drop) terrain.delete(k);
  }
}

function terrainHit() {
  const wy0 = Game.worldY - 13, wy1 = Game.worldY + 13;
  const i0 = Math.floor(wy0 / ROW_H), i1 = Math.floor(wy1 / ROW_H);
  for (let i = i0; i <= i1; i++) {
    const row = terrain.get(i);
    if (!row) continue;
    if (Game.px - 10 < row.l + 2 || Game.px + 10 > row.r - 2) return 'bank';
    if (row.il >= 0 && Game.px + 9 > row.il && Game.px - 9 < row.ir) return 'bank';
    if (row.bridge && Game.px + 10 > row.bl && Game.px - 10 < row.br) return 'bridge';
  }
  return null;
}

function spawnPowerup(x, wy, forceType) {
  if (powerups.length > 6) return;
  const r = Math.random();
  const type = forceType || (r < 0.40 ? 'double' : r < 0.72 ? 'x2' : 'shield');
  powerups.push({ x: clamp(x, 26, W - 26), wy, type, t: 0, life: 12, bob: rand(0, 6) });
}

function grantPowerup(type, x, y) {
  const def = PWTYPES[type];
  Game.pw[type] = Math.max(Game.pw[type] || 0, def.dur);
  Game.pwLast = type;
  sfx[type === 'shield' ? 'shield' : type === 'x2' ? 'x2' : 'power']();
  floatText(x, y - 16, def.name, def.col, 2);
  for (let i = 0; i < 14; i++) {
    part({ t: 'p', x, y, vx: rand(-90, 90), vy: rand(-110, 40), g: 120,
      r: rand(1.6, 3), life: rand(0.25, 0.5), max: 0.5, c: type === 'shield' ? '140,255,185' : type === 'x2' ? '255,220,110' : '150,225,255' });
  }
  part({ t: 'ring', x, y, r: 8, dr: 120, life: 0.35, max: 0.35, c: '200,240,255' });
}

/* ------------------------------------------------------------ partículas */
function part(p) { if (particles.length < 520) particles.push(p); }

function explosionFx(x, y, water, big) {
  const n = big ? 26 : water ? 13 : 20;
  for (let k = 0; k < n; k++) {
    part({
      t: 'p', x, y, vx: rand(-190, 190), vy: rand(-230, 90),
      g: water ? 280 : 460, r: rand(2, 4.2), life: rand(0.35, 0.85), max: 0.85,
      c: water ? '150,215,255' : (Math.random() < 0.4 ? '255,240,170' : '255,150,60')
    });
  }
  for (let k = 0; k < (big ? 14 : 8); k++) {
    part({
      t: 'p', x, y, vx: rand(-60, 60), vy: rand(-80, -10), g: -50,
      r: rand(3, 6), life: rand(0.5, 1.1), max: 1.1,
      c: water ? '200,235,255' : '110,110,125'
    });
  }
  part({ t: 'ring', x, y, r: 6, dr: big ? 300 : 170, life: big ? 0.5 : 0.4, max: 0.5, c: water ? '170,225,255' : '255,190,120' });
  part({ t: 'flash', x, y, r: big ? 26 : 15, life: 0.1, max: 0.1, c: '255,245,210' });
}

function floatText(x, y, str, col, size) {
  part({ t: 'txt', x, y, vy: -38, life: 0.95, max: 0.95, str, c: col || '#ffe36a', s: size || 2 });
}

function shake(dur, mag) {
  Game.shakeT = Math.max(Game.shakeT, dur);
  Game.shakeDur = dur; Game.shakeMag = Math.max(Game.shakeMag, mag);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (p.t === 'p') { p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    else if (p.t === 'ring' || p.t === 'flash') p.r += p.dr * dt;
    else if (p.t === 'txt') p.y += p.vy * dt;
  }
}

/* --------------------------------------------------------------- combate */
function addScore(n, x, y, col) {
  const pts = Math.max(1, Math.round(pwActive('x2') ? n * 2 : n));
  Game.score += pts;
  if (x !== undefined) floatText(x, y, '+' + pts, col || '#ffe36a', 2);
  const nr = rankFor(Game.score);
  if (nr > Game.rank) {
    Game.rank = nr;
    Game.banner = RANKS[nr].name;
    Game.bannerSub = 'ASCENSO DE RANGO';
    Game.bannerT = 2.0;
    sfx.promo();
    Game.flash = 0.35; Game.flashCol = '#8dffb9';
    if (Game.lives < 7) { Game.lives++; floatText(Game.px, PY - 40, '+1 VIDA', '#8dffb9', 2); }
  }
  while (Game.score >= Game.nextLife) {
    Game.nextLife += 12000;
    if (Game.lives < 7) { Game.lives++; floatText(Game.px, PY - 40, '+1 VIDA', '#8dffb9', 2); sfx.life(); }
  }
}

function bumpCombo(x, y) {
  Game.combo++;
  Game.comboT = 3.0;
  Game.comboMax = Math.max(Game.comboMax, Game.combo);
  if (Game.combo >= 2) {
    sfx.combo(Math.min(8, Game.combo));
    floatText(x, y - 14, 'x' + comboMult(), '#8fe3ff', 2);
  }
}
const comboMult = () => clamp(Math.max(1, Game.combo), 1, 8);
const COMBO_COLORS = ['#ffffff', '#8fe3ff', '#7dffb0', '#ffe36a', '#ffab5a', '#ff7a7a', '#ff5ad0', '#c78bff'];

function fire() {
  const doble = pwActive('double');
  if (Game.overheat > 0 || Game.fireCd > 0) return;
  if (bullets.length >= (doble ? 6 : 4)) return;
  if (doble) {
    bullets.push({ x: Game.px - 8, wy: Game.worldY + 17, vx: -55 });
    bullets.push({ x: Game.px + 8, wy: Game.worldY + 17, vx: 55 });
  } else {
    bullets.push({ x: Game.px, wy: Game.worldY + 17, vx: 0 });
  }
  Game.fireCd = doble ? 0.16 : 0.135;
  Game.shots++;
  Game.heat = Math.min(100, Game.heat + 13);
  if (Game.heat >= 100) {
    Game.overheat = 0.75;
    sfx.overheat();
    floatText(Game.px, PY - 34, 'CALOR', '#ff7a5a', 2);
  }
  if (doble) sfx.shoot2(); else sfx.shoot();
  part({ t: 'p', x: Game.px, y: PY - 17, vx: rand(-16, 16), vy: -40, g: 0, r: 2.6, life: 0.1, max: 0.1, c: '255,235,150' });
}

function destroyBridge(i) {
  const row0 = terrain.get(i);
  if (!row0 || !row0.bridge) return;
  const bl = row0.bl, br = row0.br;
  let a = i, b = i;
  for (;;) { const r = terrain.get(a - 1); if (r && r.bridge && Math.abs(r.bl - bl) < 2 && Math.abs(r.br - br) < 2) a--; else break; }
  for (;;) { const r = terrain.get(b + 1); if (r && r.bridge && Math.abs(r.bl - bl) < 2 && Math.abs(r.br - br) < 2) b++; else break; }
  for (let k = a; k <= b; k++) { const r = terrain.get(k); if (r) r.bridge = false; }

  const cy = PY + Game.worldY - ((a + b) / 2) * ROW_H;
  for (let k = 0; k < 4; k++) explosionFx(rand(bl + 20, br - 20), cy + rand(-26, 26), true, true);
  shake(0.55, 10);
  sfx.bigBoom();
  const mult = comboMult();
  addScore(500 * mult, W / 2, PLAY_TOP + PLAY_H * 0.32, '#ffd76a');
  Game.bridges++;
  Game.sector++;
  bumpCombo(W / 2, PLAY_TOP + PLAY_H * 0.40);
  Game.base = Math.min(240, 118 + Game.sector * 7);
  Game.banner = 'SECTOR ' + (Game.sector + 1);
  Game.bannerSub = 'RÍO MÁS RÁPIDO';
  Game.bannerT = 1.6;
  sfx.sector();
  musicIntensity(Game.sector >= 4 ? 2 : Game.sector >= 2 ? 1 : 0);
  if (Game.sector >= 2) musicSection(Game.sector % 2);
}

function die(reason) {
  if (Game.state !== S.PLAY) return;
  Game.state = S.DYING; Game.stateT = 0;
  explosionFx(Game.px, PY, false, true);
  shake(0.7, 12);
  sfx.crash();
  engineSet(false, 1);
  Game.flash = 0.4; Game.flashCol = '#ff5a3c';
  Game.combo = 0; Game.comboT = 0;
  Game.hitstop = 0.09;
  Game.deathReason = reason || 'CRASH';
}

function respawn() {
  const row = rowAt(Game.worldY) || { l: 0, r: W, il: -1, ir: -1 };
  const segs = waterSegs(row);
  let best = segs[0];
  for (const s of segs) if (s[1] - s[0] > best[1] - best[0]) best = s;
  Game.px = clamp((best[0] + best[1]) / 2, 44, W - 44);
  enemies = enemies.filter(e => Math.abs(e.wy - Game.worldY) > 300);
  bullets = [];
  Game.fuel = 100; Game.heat = 0; Game.overheat = 0;
  Game.invuln = 2.4; Game.ptilt = 0;
  Game.state = S.PLAY; Game.stateT = 0;
  engineSet(true, Game.throttle);
}
