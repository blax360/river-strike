'use strict';
/* =========================================================================
   60-screens.js · splash ARCADE "AKUMU GAMES", título, game over, pausa
   ========================================================================= */

let LOGO = {};
let _gradCache = new Map();

function gradTextSprite(str, s, stops, glow, glowColor) {
  const key = str + s + stops.map(x => x[1]).join('') + glow;
  const hit = _gradCache.get(key);
  if (hit) return hit;
  const base = pxSprite(str, s, '#ffffff', 0);
  const pad = glow ? glow : 0;
  const cv = document.createElement('canvas');
  cv.width = base.width + pad * 2; cv.height = base.height + pad * 2;
  const g = cv.getContext('2d');
  const tmp = document.createElement('canvas');
  tmp.width = base.width; tmp.height = base.height;
  const t = tmp.getContext('2d');
  t.drawImage(base, 0, 0);
  t.globalCompositeOperation = 'source-in';
  const lg = t.createLinearGradient(0, 0, 0, tmp.height);
  stops.forEach(st => lg.addColorStop(st[0], st[1]));
  t.fillStyle = lg; t.fillRect(0, 0, tmp.width, tmp.height);
  if (glow) { g.shadowColor = glowColor; g.shadowBlur = glow; }
  g.drawImage(tmp, pad, pad);
  _gradCache.set(key, cv);
  return cv;
}

function buildUI() {
  LOGO.river = gradTextSprite('RIVER', 9,
    [[0, '#f2fbff'], [0.35, '#9fe4ff'], [0.5, '#3fb6ff'], [0.52, '#1a5fd0'], [1, '#0a1e4a']],
    22, 'rgba(70,190,255,0.75)');
  LOGO.strike = gradTextSprite('STRIKE', 9,
    [[0, '#fff8d8'], [0.35, '#ffd24a'], [0.5, '#ff8a1e'], [0.52, '#a82a08'], [1, '#4a0f04']],
    22, 'rgba(255,140,60,0.7)');
  LOGO.akumu = gradTextSprite('AKUMU GAMES', 6,
    [[0, '#ffffff'], [0.5, '#cfe3f5'], [1, '#5d7c9e']], 16, 'rgba(150,200,255,0.55)');
}

/* --------------------------------------------------------------- splash */
const ONI = [
  '..A.......A..',
  '.AWA.....AWA.',
  '.AWA.....AWA.',
  '..AWAAAAAWA..',
  '..ARAAAAARA..',
  '.AARRRRRRRAA.',
  'AARWWWRAWWWRA',
  'AARWWRRRRWWRAA',
  'AARRRRRRRRRAA',
  '.AARWWWWWRAA.',
  '.AA.RRRRR.AA.',
  '..A.A...A.A..'
];
const ONI_PAL = { A: '#f2f6ff', W: '#0b0e16', R: '#e03a2a' };

function drawSplash() {
  const c = ctx, t = Game.stateT;
  c.fillStyle = '#04060c';
  c.fillRect(0, 0, W, H);

  // rejilla de fondo
  c.strokeStyle = 'rgba(40,90,140,0.16)';
  c.lineWidth = 1;
  const off = (Game.T * 26) % 40;
  for (let x = -40 + off; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = -40 + off; y < H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

  const fade = t > 2.35 ? clamp((2.9 - t) / 0.55, 0, 1) : 1;
  c.save();
  c.globalAlpha = fade;

  // destello de entrada
  if (t < 0.5) {
    c.fillStyle = 'rgba(200,235,255,' + (0.55 * (1 - t / 0.5)).toFixed(3) + ')';
    c.fillRect(0, 0, W, H);
  }

  const pop = t < 0.3 ? lerp(1.5, 1, clamp(t / 0.3, 0, 1)) : 1;
  const bob = Math.sin(Game.T * 1.6) * 3;

  // máscara oni (se dibuja con barrido)
  const px = 9, mw = 13 * px, mh = 12 * px;
  const mx = (W - mw) / 2, my = H * 0.22 + bob;
  const wipe = clamp((t - 0.18) / 0.55, 0, 1);
  c.save();
  c.globalAlpha = fade * clamp((t - 0.15) / 0.25, 0, 1);
  for (let r = 0; r < ONI.length; r++) {
    if (r / ONI.length > wipe + 0.001 && wipe < 1) continue;
    for (let b = 0; b < ONI[r].length; b++) {
      const ch = ONI[r][b];
      if (ch === '.') continue;
      c.fillStyle = ONI_PAL[ch] || '#f0f';
      c.fillRect(mx + b * px, my + r * px, px, px);
    }
  }
  c.restore();

  // resplandor rojo bajo la máscara
  const g = c.createRadialGradient(W / 2, my + mh * 0.5, 10, W / 2, my + mh * 0.5, 260);
  g.addColorStop(0, 'rgba(220,50,30,0.22)');
  g.addColorStop(1, 'rgba(220,50,30,0)');
  c.fillStyle = g;
  c.fillRect(0, my - 200, W, 460);

  // AKUMU GAMES
  c.save();
  c.translate(W / 2, H * 0.62);
  c.scale(pop, pop);
  c.drawImage(LOGO.akumu, -LOGO.akumu.width / 2, -LOGO.akumu.height / 2);
  c.restore();

  // línea + PRESENTA
  const lw = 190 * clamp((t - 0.7) / 0.5, 0, 1);
  c.fillStyle = 'rgba(120,190,255,0.5)';
  c.fillRect(W / 2 - lw, H * 0.62 + 48, lw * 2, 2);

  if (t > 1.0 && Math.sin(Game.T * 5) > -0.4) {
    pxText(c, 'PRESENTA', W / 2, H * 0.62 + 60, 2, '#9fd8ff', 8, 'center', 'rgba(110,200,255,0.8)');
  }

  // chispa de moneda
  if (t > 0.35 && t < 2.3) pxText(c, 'INSERT COIN', W / 2, H * 0.84, 1, 'rgba(120,150,190,0.55)', 0, 'center');

  pxText(c, '(C) 2026 AKUMU GAMES · v' + APP_VERSION, W / 2, H - 46, 1, 'rgba(90,115,150,0.5)', 0, 'center');
  c.restore();

  // scanlines
  drawScanlines();
}

/* ---------------------------------------------------------------- título */
function drawTitle() {
  const c = ctx;
  const T2 = Game.T;

  // fondo atract
  drawWorld();
  drawEnemies();
  c.fillStyle = 'rgba(3,7,16,0.70)';
  c.fillRect(0, 0, W, H);

  // brillo superior
  const g = c.createRadialGradient(W / 2, 180, 20, W / 2, 180, 380);
  g.addColorStop(0, 'rgba(40,130,220,0.22)');
  g.addColorStop(1, 'rgba(10,20,40,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, 520);

  pxText(c, 'AKUMU GAMES', W / 2, 26, 2, '#7fa8cc', 5, 'center', 'rgba(110,190,255,0.6)');

  // logo
  const jitter = Math.sin(T2 * 22) * 0.6;
  c.drawImage(LOGO.river, Math.round(W / 2 - LOGO.river.width / 2 + jitter), 58);
  c.drawImage(LOGO.strike, Math.round(W / 2 - LOGO.strike.width / 2 - jitter), 122);

  // subtítulo
  pxText(c, 'EL RÍO NO PERDONA', W / 2, 196, 2, '#c8ddf0', 0, 'center');
  c.fillStyle = 'rgba(120,190,255,0.35)';
  c.fillRect(W / 2 - 140, 224, 280, 1);

  // nave flotando
  const bob = Math.sin(T2 * 2) * 5;
  c.save();
  c.translate(W / 2, 288 + bob);
  c.scale(2.6, 2.6);
  const f = Math.floor(T2 * 12) % 2;
  c.drawImage(SPR.flame[f], -SPR.flame[f].width / 2, 14);
  c.drawImage(SPR.player, -SPR.player.width / 2, -SPR.player.height / 2 - 2);
  c.restore();

  // estadísticas
  const sy = 372;
  c.fillStyle = 'rgba(8,14,26,0.72)';
  c.fillRect(70, sy, W - 140, 62);
  c.strokeStyle = 'rgba(90,180,255,0.25)'; c.lineWidth = 1;
  c.strokeRect(70, sy, W - 140, 62);
  pxText(c, 'RECORD', 96, sy + 12, 1, '#6d86a8');
  pxText(c, pad6(Save.data.hi), 96, sy + 26, 2, '#ffd76a');
  pxText(c, 'MEJOR SECTOR', W - 96, sy + 12, 1, '#6d86a8', 0, 'right');
  pxText(c, String(Save.data.bestSector || 1), W - 96, sy + 26, 2, '#8fe3ff', 0, 'right');
  pxText(c, 'RANGO ' + RANKS[clamp(Save.data.bestRank || 0, 0, RANKS.length - 1)].name,
    W / 2, sy + 50, 1, '#9fb4d8', 0, 'center');

  // créditos / insert coin
  if (Math.sin(T2 * 4) > -0.35) {
    pxText(c, 'PULSA ESPACIO PARA JUGAR', W / 2, 462, 2, '#eaf6ff', 10, 'center', 'rgba(120,200,255,0.8)');
  }
  pxText(c, 'CREDITOS 01', W / 2, 490, 1, 'rgba(255,120,90,' + (0.4 + 0.4 * Math.sin(T2 * 6)).toFixed(2) + ')', 0, 'center');

  // controles
  const cy = 540;
  const lines = [
    ['← →', 'GIRAR'],
    ['↑ ↓', 'ACELERAR / FRENAR'],
    ['ESPACIO', 'DISPARAR'],
    ['P', 'PAUSA'],
    ['M', 'SONIDO']
  ];
  lineBox(c, 74, cy, W - 148, 128);
  for (let i = 0; i < lines.length; i++) {
    pxText(c, lines[i][0], 96, cy + 14 + i * 22, 1, '#8fe3ff');
    pxText(c, lines[i][1], W - 96, cy + 14 + i * 22, 1, '#9fb4d8', 0, 'right');
  }

  pxText(c, 'MANTÉN EL COMBO · NO TOQUES LA ORILLA', W / 2, 692, 1, '#5f7794', 0, 'center');
  pxText(c, 'AKUMU GAMES · 2026 · HECHO CON TAURI', W / 2, H - 22, 1, 'rgba(90,115,150,0.6)', 0, 'center');
}

function lineBox(c, x, y, w, h) {
  c.fillStyle = 'rgba(6,10,20,0.66)';
  c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(90,180,255,0.18)';
  c.lineWidth = 1;
  c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/* ------------------------------------------------------------- game over */
function drawOver() {
  const c = ctx;
  c.fillStyle = 'rgba(3,5,12,0.76)';
  c.fillRect(0, 0, W, H);

  const pw = 430, ph = 380, x = (W - pw) / 2, y = (H - ph) / 2 - 20;
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.7)'; c.shadowBlur = 30;
  c.fillStyle = 'rgba(8,12,22,0.96)';
  c.fillRect(x, y, pw, ph);
  c.restore();
  c.strokeStyle = 'rgba(255,90,60,0.5)'; c.lineWidth = 2;
  c.strokeRect(x + 1, y + 1, pw - 2, ph - 2);
  c.strokeStyle = 'rgba(90,180,255,0.18)'; c.lineWidth = 1;
  c.strokeRect(x + 7, y + 7, pw - 14, ph - 14);

  pxText(c, 'GAME OVER', W / 2, y + 34, 4, '#ff5a3c', 14, 'center', 'rgba(255,90,60,0.8)');
  if (Game.deathReason) pxText(c, Game.deathReason, W / 2, y + 76, 1, '#a06050', 0, 'center');

  pxText(c, 'PUNTOS', W / 2, y + 100, 1, '#6d86a8', 0, 'center');
  pxText(c, pad6(Game.score), W / 2, y + 114, 3, '#eaf6ff', 0, 'center');

  if (Game.newHi && Math.sin(Game.T * 7) > -0.2) {
    pxText(c, '¡NUEVO RÉCORD!', W / 2, y + 158, 2, '#ffe36a', 12, 'center', 'rgba(255,220,90,0.9)');
  } else {
    pxText(c, 'RECORD ' + pad6(Math.max(Game.hi, Game.score)), W / 2, y + 158, 1, '#8a9cb8', 0, 'center');
  }

  // estadísticas de la partida
  const st = y + 186;
  c.fillStyle = 'rgba(4,8,16,0.9)';
  c.fillRect(x + 24, st, pw - 48, 96);
  const rows = [
    ['SECTOR', String(Game.sector + 1)],
    ['RANGO', RANKS[rankFor(Game.score)].name],
    ['MEJOR COMBO', 'x' + comboMultMax() + ' (' + Game.comboMax + ')'],
    ['PRECISIÓN', (Game.shots ? Math.round(100 * Game.hits / Game.shots) : 0) + '%'],
    ['DISTANCIA', (Game.worldY / 100).toFixed(1) + ' KM']
  ];
  for (let i = 0; i < rows.length; i++) {
    const ry = st + 8 + i * 18;
    pxText(c, rows[i][0], x + 40, ry, 1, '#6d86a8');
    pxText(c, rows[i][1], x + pw - 40, ry, 1, '#dff0ff', 0, 'right');
  }

  if (Game.stateT > 0.7 && Math.sin(Game.T * 5) > -0.3) {
    pxText(c, 'ESPACIO PARA REINTENTAR', W / 2, y + ph - 44, 2, '#eaf6ff', 8, 'center', 'rgba(120,200,255,0.7)');
  }
  pxText(c, 'ESC · MENÚ', W / 2, y + ph - 20, 1, '#5f7794', 0, 'center');
}

function comboMultMax() { return clamp(Math.max(1, Game.comboMax), 1, 8); }

/* ----------------------------------------------------------------- pausa */
function drawPause() {
  const c = ctx;
  c.fillStyle = 'rgba(3,6,14,0.72)';
  c.fillRect(0, 0, W, H);
  const pw = 380, ph = 226, x = (W - pw) / 2, y = (H - ph) / 2 - 10;
  c.fillStyle = 'rgba(8,12,22,0.96)';
  c.fillRect(x, y, pw, ph);
  c.strokeStyle = 'rgba(90,200,255,0.45)'; c.lineWidth = 2;
  c.strokeRect(x + 1, y + 1, pw - 2, ph - 2);

  pxText(c, 'PAUSA', W / 2, y + 30, 4, '#8dffb9', 14, 'center', 'rgba(90,255,160,0.7)');
  pxText(c, 'ESPACIO  ·  CONTINUAR', W / 2, y + 96, 1, '#cfe3f5', 0, 'center');
  pxText(c, 'M  ·  SONIDO ' + (Save.data.mute ? 'OFF' : 'ON'), W / 2, y + 120, 1, '#cfe3f5', 0, 'center');
  pxText(c, 'ESC  ·  REINICIAR PARTIDA', W / 2, y + 144, 1, '#ff9a8a', 0, 'center');
  pxText(c, 'SECTOR ' + (Game.sector + 1) + '  ·  ' + pad6(Game.score) + ' PTS', W / 2, y + 186, 1, '#6d86a8', 0, 'center');
  pxText(c, 'RANGO ' + RANKS[rankFor(Game.score)].name, W / 2, y + 202, 1, '#5f7794', 0, 'center');
}

/* ------------------------------------------------------------ frame total */
function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.textBaseline = 'middle';

  if (Game.state === S.SPLASH) { drawSplash(); drawVignette(); return; }

  let ox = 0, oy = 0;
  if (Game.shakeT > 0) {
    const k = Game.shakeT / Math.max(0.001, Game.shakeDur);
    ox = rand(-1, 1) * Game.shakeMag * k;
    oy = rand(-1, 1) * Game.shakeMag * k;
  }

  if (Game.state === S.TITLE) {
    drawTitle();
    drawScanlines();
    drawFlash();
    return;
  }

  ctx.save();
  ctx.translate(Math.round(ox), Math.round(oy));
  drawWorld();
  drawEnemies();
  drawPowerups();
  drawBullets();
  if (Game.state === S.PLAY || Game.state === S.PAUSE) drawPlayer();
  drawParticles();
  ctx.restore();

  drawHUD();
  drawPowerHUD();
  drawBanner();
  if (Game.state === S.OVER) drawOver();
  if (Game.state === S.PAUSE) drawPause();

  // "SISTEMAS" del avión muerto
  if (Game.state === S.DYING && Game.stateT > 0.25) {
    pxText(ctx, Game.deathReason || 'PERDIDO', W / 2, PLAY_TOP + PLAY_H * 0.30, 3,
      'rgba(255,110,80,' + (0.55 + 0.45 * Math.sin(Game.T * 10)).toFixed(2) + ')', 0, 'center');
  }

  drawVignette();
  drawScanlines();
  drawFlash();
}
