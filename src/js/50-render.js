'use strict';
/* =========================================================================
   50-render.js · dibujo del mundo, entidades y HUD
   ========================================================================= */

let ctx, cvs, dpr = 1, viewScale = 1;
let _waterGrad = null, _crtPat = null, _vigGrad = null;

const C_WATER_TOP = '#0d5590';
const C_WATER_BOT = '#062a4d';
const C_GRASS = '#2e7d38';
const C_GRASS_DARK = '#1d5526';
const C_SAND = '#b99b62';
const C_EDGE = '#0a2a1a';

function makeGradients() {
  _waterGrad = ctx.createLinearGradient(0, PLAY_TOP, 0, PLAY_TOP + PLAY_H);
  _waterGrad.addColorStop(0, '#072744');
  _waterGrad.addColorStop(0.45, C_WATER_TOP);
  _waterGrad.addColorStop(1, C_WATER_BOT);

  const p = document.createElement('canvas');
  p.width = 4; p.height = 4;
  const g = p.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.34)';
  g.fillRect(0, 0, 4, 2);
  _crtPat = ctx.createPattern(p, 'repeat');

  _vigGrad = ctx.createRadialGradient(W / 2, H / 2, H * 0.30, W / 2, H / 2, H * 0.78);
  _vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
  _vigGrad.addColorStop(1, 'rgba(0,2,8,0.55)');
}

/* ---------------------------------------------------------------- mundo */
function drawWorld() {
  const c = ctx;
  c.fillStyle = _waterGrad;
  c.fillRect(0, PLAY_TOP, W, PLAY_H);

  const i0 = Math.floor((Game.worldY - BEHIND - 24) / ROW_H);
  const i1 = Math.floor((Game.worldY + AHEAD + 24) / ROW_H) + 1;

  for (let i = i0; i <= i1; i++) {
    const row = terrain.get(i);
    if (!row) continue;
    const sy = PY + Game.worldY - (i + 1) * ROW_H;
    const h = ROW_H + 1;

    // agua con bandas
    if (i % 2 === 0) { c.fillStyle = 'rgba(3,20,48,0.18)'; c.fillRect(0, sy, W, h); }

    // orillas (tierra)
    c.fillStyle = C_GRASS;
    if (row.l > 0) c.fillRect(0, sy, row.l + 0.6, h);
    if (row.r < W) c.fillRect(row.r, sy, W - row.r, h);

    // franja de arena
    c.fillStyle = C_SAND;
    if (row.l > 0) c.fillRect(row.l - 3, sy, 3, h);
    if (row.r < W) c.fillRect(row.r, sy, 3, h);

    // borde oscuro
    c.fillStyle = C_EDGE;
    if (row.l > 0) c.fillRect(row.l - 4, sy, 1, h);
    if (row.r < W) c.fillRect(row.r + 3, sy, 1, h);

    // isla
    if (row.il >= 0) {
      c.fillStyle = C_GRASS;
      c.fillRect(row.il, sy, row.ir - row.il, h);
      c.fillStyle = C_SAND;
      c.fillRect(row.il - 2, sy, 2, h);
      c.fillRect(row.ir, sy, 2, h);
      c.fillStyle = C_EDGE;
      c.fillRect(row.il - 3, sy, 1, h);
      c.fillRect(row.ir + 2, sy, 1, h);
    }

    // textura del pasto
    for (let k = 0; k < 2; k++) {
      c.fillStyle = 'rgba(0,0,0,0.16)';
      const mx = Math.floor(hash(i * 3.7 + k) * Math.max(1, row.l - 10));
      const my = Math.floor(hash(i * 5.3 + k) * ROW_H);
      c.fillRect(mx, sy + my, 3, 2);
      const nx = Math.floor(row.r + 6 + hash(i * 7.9 + k) * Math.max(1, W - row.r - 12));
      c.fillRect(nx, sy + my, 3, 2);
    }

    // árboles
    if (hash(i * 11.3 + 2) < 0.26 && row.l > 46) {
      const tx = Math.floor(14 + hash(i * 13.7 + 4) * (row.l - 34));
      blit(c, SPR.tree, tx, sy + 10);
    }
    if (hash(i * 19.1 + 2) < 0.26 && W - row.r > 46) {
      const tx = Math.floor(row.r + 22 + hash(i * 23.3 + 4) * (W - row.r - 40));
      blit(c, SPR.tree, tx, sy + 10);
    }
    if (row.il >= 0 && hash(i * 29.7 + 5) < 0.30 && row.ir - row.il > 44) {
      blit(c, SPR.tree, Math.floor((row.il + row.ir) / 2), sy + 10);
    }

    // puente
    if (row.bridge) {
      c.fillStyle = '#6e7b8b';
      c.fillRect(row.bl, sy, row.br - row.bl, h);
      c.fillStyle = '#93a2b4';
      c.fillRect(row.bl, sy, row.br - row.bl, 2);
      if (i % 2 === 0) { c.fillStyle = 'rgba(255,205,60,0.92)'; c.fillRect(row.bl, sy + 3, row.br - row.bl, 4); }
      c.fillStyle = '#39434f';
      c.fillRect(row.bl - 7, sy, 10, h);
      c.fillRect(row.br - 3, sy, 10, h);
      c.fillStyle = 'rgba(255,255,255,0.16)';
      c.fillRect(row.bl - 7, sy, 10, 1);
      c.fillRect(row.br - 3, sy, 10, 1);
    }
  }

  // reflejos animados en el agua
  c.fillStyle = 'rgba(190,228,255,0.055)';
  for (let k = 0; k < 14; k++) {
    const sy = PLAY_TOP + ((k * (PLAY_H / 14) + Game.T * 46) % PLAY_H);
    const row = rowAt(Game.worldY + (PY - sy));
    if (!row) continue;
    for (const s of waterSegs(row)) {
      const wd = s[1] - s[0];
      if (wd > 44) c.fillRect(s[0] + 12, sy, wd - 24, 2);
    }
  }

  // líneas de velocidad
  if (Game.state === S.PLAY) {
    const a = clamp((Game.speed - 150) / 90, 0, 1) * 0.16;
    if (a > 0.01) {
      c.fillStyle = 'rgba(190,225,255,' + a.toFixed(3) + ')';
      for (let k = 0; k < 14; k++) {
        const rx = Math.floor(hash(k * 3.1) * W);
        const ry = PLAY_TOP + ((hash(k * 7.7) * PLAY_H + Game.T * 900) % PLAY_H);
        c.fillRect(rx, ry, 1, 16 + hash(k) * 20);
      }
    }
  }
}

function drawEnemies() {
  const c = ctx;
  for (const e of enemies) {
    const sy = PY + Game.worldY - e.wy;
    if (sy < PLAY_TOP - 60 || sy > H - HUD_BOT + 60) continue;
    const bob = Math.sin(Game.T * 3 + e.bob) * 1.3;

    // sombra
    if (e.type !== 'jet' && e.type !== 'missile') {
      c.fillStyle = 'rgba(0,10,20,0.28)';
      c.beginPath();
      c.ellipse(e.x, sy + 12, e.type === 'ship' ? 22 : e.type === 'heli' ? 17 : 12, 4, 0, 0, TAU);
      c.fill();
    }

    if (e.type === 'ship') {
      const dir = e.vx < 0 ? -1 : 1;
      c.save(); c.translate(e.x, sy + bob); if (dir < 0) c.scale(-1, 1);
      blit(c, SPR.ship, 0, 0); c.restore();
      c.fillStyle = 'rgba(225,245,255,0.35)';
      c.fillRect(e.x - 27, sy + 4 + bob, 4, 6);
      c.fillRect(e.x + 23, sy + 4 + bob, 4, 6);
    } else if (e.type === 'heli') {
      const dir = e.vx < 0 ? -1 : 1;
      c.save(); c.translate(e.x, sy + bob); if (dir < 0) c.scale(-1, 1);
      blit(c, SPR.heli, 0, 2); c.restore();
      const f = Math.floor(Game.T * 20 + e.bob * 7) % 2;
      c.fillStyle = 'rgba(230,248,235,0.9)';
      if (f) { c.fillRect(e.x - 16, sy - 13 + bob, 32, 2); c.fillRect(e.x - 1, sy - 15 + bob, 2, 3); }
      else { c.fillRect(e.x - 9, sy - 13 + bob, 18, 2); c.fillRect(e.x - 1, sy - 15 + bob, 2, 3); }
    } else if (e.type === 'jet') {
      blit(c, SPR.ejet, e.x, sy);
      if (Math.floor(Game.T * 22) % 2) {
        c.fillStyle = 'rgba(255,205,90,0.95)';
        c.fillRect(e.x - 3, sy - SPR.ejet.height / 2 - 5, 6, 5);
      }
    } else if (e.type === 'missile') {
      blit(c, SPR.missile, e.x, sy + Math.sin(Game.T * 14) * 1.2);
      if (Math.floor(Game.T * 16) % 2) {
        c.fillStyle = 'rgba(255,120,60,0.9)';
        c.fillRect(e.x - 2, sy + SPR.missile.height / 2, 4, 6);
      }
    } else if (e.type === 'fuel') {
      blit(c, SPR.fuel, e.x, sy + bob);
      const pulse = 0.35 + 0.35 * Math.sin(Game.T * 6 + e.bob);
      c.strokeStyle = 'rgba(120,255,170,' + pulse.toFixed(2) + ')';
      c.lineWidth = 2;
      c.strokeRect(e.x - 19, sy + bob - 19, 38, 38);
    }
  }
}

function drawBullets() {
  const c = ctx;
  for (const b of bullets) {
    const sy = PY + Game.worldY - b.wy;
    c.fillStyle = 'rgba(255,220,120,0.35)';
    c.fillRect(b.x - 2, sy - 2, 5, 16);
    c.fillStyle = '#fffbe0';
    c.fillRect(b.x - 1, sy - 8, 3, 12);
  }
}

function drawPlayer() {
  const c = ctx;
  const blink = Game.invuln > 0 && Math.sin(Game.T * 30) > 0;
  c.save();
  c.translate(Game.px, PY);
  c.rotate(Game.ptilt);
  if (blink) c.globalAlpha = 0.42;

  // halo del motor
  const f = Math.floor(Game.T * 20) % 2;
  const fl = SPR.flame[f];
  const boost = Game.throttle > 1.35;
  if (boost) { c.shadowColor = 'rgba(255,170,70,0.9)'; c.shadowBlur = 14; }
  c.drawImage(fl, Math.round(-fl.width / 2), 14);
  c.shadowBlur = 0;

  blit(c, SPR.player, 0, -2);
  c.globalAlpha = 1;
  c.restore();

  // escudo de invulnerabilidad
  if (Game.invuln > 0) {
    const a = 0.22 + 0.16 * Math.sin(Game.T * 12);
    c.strokeStyle = 'rgba(110,220,255,' + a.toFixed(2) + ')';
    c.lineWidth = 2;
    c.beginPath(); c.arc(Game.px, PY, 26, 0, TAU); c.stroke();
  }
}

function drawParticles() {
  const c = ctx;
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    if (p.t === 'p') {
      c.fillStyle = 'rgba(' + p.c + ',' + a.toFixed(3) + ')';
      c.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    } else if (p.t === 'ring') {
      c.strokeStyle = 'rgba(' + p.c + ',' + (a * 0.8).toFixed(3) + ')';
      c.lineWidth = 2;
      c.strokeRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    } else if (p.t === 'flash') {
      c.fillStyle = 'rgba(' + p.c + ',' + a.toFixed(3) + ')';
      c.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
    } else if (p.t === 'txt') {
      c.globalAlpha = a;
      pxText(c, p.str, p.x, p.y, p.s || 2, p.c, 0, 'center');
      c.globalAlpha = 1;
    }
  }
}

/* ------------------------------------------------------------------ HUD */
function bar(c, x, y, w, h, ratio, col1, col2) {
  c.fillStyle = 'rgba(6,10,20,0.95)';
  c.fillRect(x - 1, y - 1, w + 2, h + 2);
  c.fillStyle = 'rgba(90,120,170,0.35)';
  c.fillRect(x - 1, y - 1, w + 2, 1);
  c.fillRect(x - 1, y + h, w + 2, 1);
  c.fillRect(x - 1, y - 1, 1, h + 2);
  c.fillRect(x + w, y - 1, 1, h + 2);
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, col2); g.addColorStop(1, col1);
  c.fillStyle = g;
  c.fillRect(x, y, Math.max(0, w * clamp(ratio, 0, 1)), h);
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.fillRect(x, y, Math.max(0, w * clamp(ratio, 0, 1)), 1);
}

function drawHUD() {
  const c = ctx;
  c.fillStyle = '#060a14';
  c.fillRect(0, 0, W, HUD_TOP);
  c.fillRect(0, H - HUD_BOT, W, HUD_BOT);
  c.fillStyle = '#122238';
  c.fillRect(0, HUD_TOP - 2, W, 2);
  c.fillRect(0, H - HUD_BOT, W, 2);

  // puntos
  pxText(c, 'PUNTOS', 12, 8, 1, '#6d86a8');
  pxText(c, pad6(Game.score), 12, 22, 2, '#eaf6ff');

  // record
  pxText(c, 'RECORD', W / 2, 8, 1, '#6d86a8', 0, 'center');
  const hi = Math.max(Game.hi, Game.score);
  pxText(c, pad6(hi), W / 2, 22, 2, Game.score > Game.hi ? '#8dffb9' : '#ffd76a', 0, 'center');

  // sector
  pxText(c, 'SECTOR ' + (Game.sector + 1), W - 12, 8, 1, '#6d86a8', 0, 'right');
  for (let i = 0; i < Game.lives; i++) c.drawImage(SPR.life, W - 14 - i * 24, 20, 21, 18);

  // barras inferiores
  const by = H - HUD_BOT + 30;
  const fuelRatio = Game.fuel / 100;
  const low = Game.fuel < 25;
  const pulse = low && Math.sin(Game.T * 12) > 0;
  pxText(c, 'COMBUSTIBLE', 14, H - HUD_BOT + 8, 1, low ? (pulse ? '#ff5a4a' : '#c0603c') : '#6d86a8');
  bar(c, 14, by, 232, 13, fuelRatio, low ? '#ff3a2a' : '#1f9e4a', low ? '#ff9a6a' : '#6dff9a');

  const heatRatio = Game.heat / 100;
  pxText(c, Game.overheat > 0 ? 'SOBRECALENTADO' : 'CALOR', 292, H - HUD_BOT + 8, 1,
    Game.overheat > 0 ? '#ff6a5a' : '#6d86a8');
  bar(c, 292, by, 148, 13, heatRatio, '#8a3a10', '#ffb040');

  // combo
  if (Game.combo > 1 && Game.state === S.PLAY) {
    const t = clamp(Game.comboT / 3.0, 0, 1);
    const col = COMBO_COLORS[clamp(Game.combo - 1, 0, 7)];
    pxText(c, 'COMBO x' + comboMult(), W / 2, HUD_TOP + 10, 2, col, 6, 'center', col);
    c.fillStyle = 'rgba(0,0,0,0.5)';
    c.fillRect(W / 2 - 60, HUD_TOP + 34, 120, 5);
    c.fillStyle = col;
    c.fillRect(W / 2 - 60, HUD_TOP + 34, 120 * t, 5);
    pxText(c, Game.combo + ' SEGUIDOS', W / 2, HUD_TOP + 46, 1, 'rgba(190,215,240,0.65)', 0, 'center');
  }

  // altavoz
  pxText(c, Save.data.mute ? 'X' : '♪', W - 16, H - HUD_BOT + 44, 2,
    Save.data.mute ? '#4a5a70' : '#7ddcff', 0, 'right');

  // aviso combustible bajo en el borde
  if (low && Game.state === S.PLAY) {
    const a = 0.10 + 0.10 * Math.sin(Game.T * 10);
    c.strokeStyle = 'rgba(255,60,40,' + a.toFixed(3) + ')';
    c.lineWidth = 10;
    c.strokeRect(5, PLAY_TOP + 3, W - 10, PLAY_H - 6);
  }
}

function drawBanner() {
  if (Game.bannerT <= 0 || !Game.banner) return;
  const c = ctx;
  const t = Game.bannerT;
  const a = t > 1.6 ? clamp((2.0 - t) / 0.4, 0, 1) : clamp(t / 0.4, 0, 1);
  c.save();
  c.globalAlpha = a;
  const y = PLAY_TOP + PLAY_H * 0.24;
  pxText(c, Game.banner, W / 2, y, 4, '#8dffb9', 10, 'center', 'rgba(90,255,160,0.9)');
  if (Game.bannerSub) pxText(c, Game.bannerSub, W / 2, y + 40, 1, '#bfe9ff', 0, 'center');
  c.restore();
}

function drawScanlines() {
  if (!_crtPat) return;
  const c = ctx;
  c.save();
  c.globalAlpha = 0.30;
  c.fillStyle = _crtPat;
  c.fillRect(0, 0, W, H);
  c.restore();
}

function drawVignette() {
  ctx.fillStyle = _vigGrad;
  ctx.fillRect(0, 0, W, H);
}

function drawFlash() {
  if (Game.flash <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(Game.flash, 0, 0.65);
  ctx.fillStyle = Game.flashCol;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}
