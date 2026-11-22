'use strict';
/* =========================================================================
   40-update.js · lógica de juego (update de todos los estados)
   ========================================================================= */

function startGame() {
  Game.score = 0; Game.lives = 3; Game.sector = 0; Game.rank = 0;
  Game.newHi = false; Game.nextLife = 12000;
  Game.worldY = 0; Game.base = 118; Game.speed = 118; Game.throttle = 1;
  Game.fuel = 100; Game.heat = 0; Game.overheat = 0;
  Game.invuln = 2.2; Game.fireCd = 0;
  Game.combo = 0; Game.comboT = 0; Game.comboMax = 0;
  Game.kills = 0; Game.shots = 0; Game.hits = 0; Game.bridges = 0;
  Game.banner = 'SECTOR 1'; Game.bannerSub = 'ADELANTE'; Game.bannerT = 2.0;
  Game.shakeT = 0; Game.flash = 0; Game.hitstop = 0;
  Game.runT = 0; Game.px = W / 2; Game.ptilt = 0; Game.introT = 0;
  Game.fuelWarn = 0;
  resetTerrain(); ensureTerrain();
  Game.state = S.PLAY; Game.stateT = 0;
  Audio2.intensity = 0;
  musicReset(); musicStart();
  engineSet(true, Game.throttle);
  sfx.start();
}

function gameOver() {
  Game.state = S.OVER; Game.stateT = 0;
  engineSet(false, 1);
  Game.newHi = Game.score > Save.data.hi;
  Save.data.hi = Math.max(Save.data.hi, Game.score);
  Save.data.bestSector = Math.max(Save.data.bestSector, Game.sector + 1);
  Save.data.bestCombo = Math.max(Save.data.bestCombo, Game.comboMax);
  Save.data.bestRank = Math.max(Save.data.bestRank, rankFor(Game.score));
  Save.data.runs = (Save.data.runs || 0) + 1;
  Save.data.kills = (Save.data.kills || 0) + Game.kills;
  Save.data.farthest = Math.max(Save.data.farthest || 0, Math.floor(Game.worldY / 100));
  Save.data.totalTime = (Save.data.totalTime || 0) + Game.runT;
  Save.write();
  Game.hi = Save.data.hi;
  if (Game.newHi) { sfx.promo(); Game.flash = 0.3; Game.flashCol = '#ffe36a'; }
}

/* ---------------------------------------------------------------- update */
function update(dt) {
  if (Game.hitstop > 0) { Game.hitstop -= dt; return; }
  Game.T += dt;
  Game.stateT += dt;
  if (Game.shakeT > 0) Game.shakeT = Math.max(0, Game.shakeT - dt);
  if (Game.flash > 0) Game.flash = Math.max(0, Game.flash - dt * 2.6);
  updateParticles(dt);

  const st = Game.state;

  if (st === S.SPLASH) {
    if (Game.stateT > 2.9 || Game.skipSplash) {
      Game.state = S.TITLE; Game.stateT = 0;
      musicReset(); musicStart();
    }
    return;
  }

  if (st === S.TITLE) {
    Game.worldY += 52 * dt;
    ensureTerrain();
    updateEnemies(dt * 0.8);
    updateBullets(dt);
    if (Game.bannerT > 0) Game.bannerT -= dt;
    return;
  }

  if (st === S.OVER) {
    Game.worldY += 26 * dt;
    ensureTerrain();
    updateEnemies(dt * 0.4);
    return;
  }

  if (st === S.PAUSE) return;

  if (st === S.DYING) {
    Game.worldY += Game.speed * 0.22 * dt;
    updateEnemies(dt);
    if (Game.stateT > 1.5) {
      Game.lives--;
      if (Game.lives < 0) gameOver(); else respawn();
    }
    return;
  }

  /* ---------------- PLAY ---------------- */
  Game.runT += dt;
  if (Game.bannerT > 0) Game.bannerT -= dt;
  if (Game.introT < 1) Game.introT += dt;

  // combustible / calor / combo
  Game.fuel -= dt * (2.0 + Game.speed * 0.0075);
  if (Game.comboT > 0) {
    Game.comboT -= dt;
    if (Game.comboT <= 0) { Game.combo = 0; }
  }
  Game.heat = Math.max(0, Game.heat - dt * 38);
  if (Game.overheat > 0) Game.overheat = Math.max(0, Game.overheat - dt);
  Game.fireCd = Math.max(0, Game.fireCd - dt);
  Game.invuln = Math.max(0, Game.invuln - dt);
  Game.warnT = Math.max(0, Game.warnT - dt);

  // controles
  if (keys['ArrowUp'] || keys['w'] || keys['W']) Game.throttle = clamp(Game.throttle + 1.15 * dt, 0.55, 1.9);
  if (keys['ArrowDown'] || keys['s'] || keys['S']) Game.throttle = clamp(Game.throttle - 1.15 * dt, 0.55, 1.9);
  const target = Game.base * Game.throttle;
  Game.speed += (target - Game.speed) * Math.min(1, dt * 3.2);
  Game.worldY += Game.speed * dt;
  ensureTerrain();

  // El TECLADO manda: si hay una dirección pulsada, el puntero se ignora.
  // Así una pulsación de ratón/trackpad atascada no puede bloquear los controles.
  let kx = 0;
  if (keys['ArrowLeft'] || keys['a'] || keys['A']) kx -= 1;
  if (keys['ArrowRight'] || keys['d'] || keys['D']) kx += 1;
  let vx = 0;
  if (kx) {
    vx = kx * 270;
  } else if (ptr.down && ptr.x != null && isFinite(ptr.x)) {
    vx = clamp((ptr.x - Game.px) * 11, -300, 300);
  }
  Game.px = clamp(Game.px + vx * dt, 12, W - 12);
  if (!isFinite(Game.px)) { Game.px = W / 2; ptr.down = false; ptr.x = null; }  // autocuración
  Game.ptilt += ((vx / 270) * 0.32 - Game.ptilt) * Math.min(1, dt * 12);

  if (Audio2.ready) engineSet(true, Game.throttle);

  // estela del motor
  if (Math.random() < dt * (18 + Game.throttle * 22)) {
    part({
      t: 'p', x: Game.px + rand(-2, 2), y: PY + 20, vx: rand(-10, 10), vy: 70 + Game.speed * 0.45,
      g: 0, r: rand(1, 2.6), life: rand(0.18, 0.4), max: 0.4,
      c: Game.throttle > 1.35 ? '255,185,95' : '165,205,255'
    });
  }

  // disparo
  if ((keys[' '] || keys['Enter'] || ptr.down) && Game.fireCd <= 0) fire();

  // reabastecer
  let refueling = false;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (e.type === 'fuel' && Math.abs(e.x - Game.px) < 34 && Math.abs(e.wy - Game.worldY) < 34) {
      refueling = true;
      Game.fuel = Math.min(100, Game.fuel + 64 * dt);
      Game.refBlip -= dt;
      if (Game.refBlip <= 0) { Game.refBlip = 0.11; sfx.refuel(Game.fuel); }
      if (Math.random() < dt * 26) {
        part({
          t: 'p', x: e.x + rand(-11, 11), y: PY + Game.worldY - e.wy - 12, vx: 0, vy: -50,
          g: 0, r: 1.7, life: 0.3, max: 0.3, c: '140,255,170'
        });
      }
    }
  }

  // aviso de combustible
  if (Game.fuel < 25) {
    Game.lowBeep -= dt;
    if (Game.lowBeep <= 0) { Game.lowBeep = lerp(0.35, 0.9, Game.fuel / 25); sfx.beep(); }
  } else Game.lowBeep = 0;

  if (Game.fuel <= 0) { Game.fuel = 0; die('SIN COMBUSTIBLE'); return; }

  // premio por vuelo al límite (riesgo)
  if (Game.invuln <= 0) {
    const row = rowAt(Game.worldY);
    if (row) {
      const d = Math.min(
        Math.abs(Game.px - (row.l + 6)),
        Math.abs(Game.px - (row.r - 6)),
        row.il >= 0 ? Math.min(Math.abs(Game.px - row.il), Math.abs(Game.px - row.ir)) : 999
      );
      if (d > 13 && d < 26 && Game.fuelWarn <= 0) {
        Game.fuelWarn = 0.55;
        addScore(15 * comboMult(), Game.px, PY + 24, '#8fe3ff');
        Game.fuel = Math.min(100, Game.fuel + 0.8);
      }
    }
  }
  Game.fuelWarn = Math.max(0, Game.fuelWarn - dt);

  // colisiones contra el terreno
  if (Game.invuln <= 0) {
    const hit = terrainHit();
    if (hit) { die(hit === 'bridge' ? 'PUENTE' : 'ORILLA'); return; }
  }

  updateEnemies(dt);
  updateBullets(dt);

  // colisión con enemigos
  if (Game.invuln <= 0 && Game.state === S.PLAY) {
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.type === 'fuel') continue;
      const hb = HITBOX[e.type] || HITBOX.ship;
      if (Math.abs(e.x - Game.px) < hb.w + 13 && Math.abs(e.wy - Game.worldY) < hb.h + 13) {
        explosionFx(e.x, PY + Game.worldY - e.wy, false, false);
        die('IMPACTO'); return;
      }
    }
  }

  musicTick();
}

const HITBOX = {
  ship: { w: 24, h: 10 }, heli: { w: 21, h: 11 }, jet: { w: 15, h: 11 },
  fuel: { w: 17, h: 17 }, missile: { w: 10, h: 12 }
};

function updateEnemies(dt) {
  const jetSpd = 155 + Game.sector * 17;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.t += dt;

    if (e.type === 'jet') {
      e.wy -= jetSpd * dt;
      if (Math.random() < dt * 14) {
        part({ t: 'p', x: e.x, y: PY + Game.worldY - e.wy + 16, vx: 0, vy: 30, g: 0, r: 1.8, life: 0.25, max: 0.25, c: '255,170,80' });
      }
    } else if (e.type === 'missile') {
      e.wy -= (70 + Game.sector * 8) * dt;
      const dx = Game.px - e.x;
      e.x += clamp(dx, -1, 1) * (52 + Game.sector * 7) * dt;
      e.x = clamp(e.x, 16, W - 16);
      if (Math.random() < dt * 22) {
        part({ t: 'p', x: e.x, y: PY + Game.worldY - e.wy + 14, vx: rand(-14, 14), vy: 40, g: 0, r: 2.2, life: 0.35, max: 0.35, c: '255,140,90' });
      }
    } else if (e.type === 'fuel') {
      // flota
    } else if (e.vx) {
      e.x += e.vx * dt;
      const row = rowAt(e.wy);
      if (row) {
        const hw = e.type === 'ship' ? 24 : 21;
        const segs = waterSegs(row);
        let seg = segs[0];
        for (const s of segs) if (e.x > s[0] && e.x < s[1]) { seg = s; break; }
        if (e.x - hw < seg[0] + 12) { e.x = seg[0] + 12 + hw; e.vx = Math.abs(e.vx); }
        else if (e.x + hw > seg[1] - 12) { e.x = seg[1] - 12 - hw; e.vx = -Math.abs(e.vx); }
      }
    }

    if (e.wy < Game.worldY - BEHIND - 140 || e.wy > Game.worldY + AHEAD + 700) {
      enemies.splice(i, 1);
    }
  }
}

function updateBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.wy += 700 * dt;
    const sy = PY + Game.worldY - b.wy;
    if (sy < HUD_TOP - 24) { bullets.splice(i, 1); continue; }

    const row = rowAt(b.wy);
    if (row) {
      const inIsland = row.il >= 0 && b.x > row.il && b.x < row.ir;
      if (b.x < row.l + 4 || b.x > row.r - 4 || inIsland) {
        part({ t: 'p', x: b.x, y: sy, vx: rand(-40, 40), vy: 30, g: 120, r: 2.2, life: 0.22, max: 0.22, c: '200,225,255' });
        bullets.splice(i, 1); continue;
      }
      if (row.bridge && b.x > row.bl && b.x < row.br) {
        destroyBridge(Math.floor(b.wy / ROW_H));
        bullets.splice(i, 1); continue;
      }
    }

    let hit = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const hb = HITBOX[e.type] || HITBOX.ship;
      if (Math.abs(e.x - b.x) < hb.w + 2 && Math.abs(e.wy - b.wy) < hb.h + 1) {
        const esy = PY + Game.worldY - e.wy;
        const base = e.type === 'ship' ? 30 : e.type === 'heli' ? 60 : e.type === 'jet' ? 100
          : e.type === 'missile' ? 150 : 75;
        const mult = comboMult();
        Game.hits++;
        Game.kills++;
        addScore(base * mult, e.x, esy, mult > 3 ? '#ff9ae0' : '#ffe36a');
        explosionFx(e.x, esy, true, e.type === 'missile');
        bumpCombo(e.x, esy);
        enemies.splice(j, 1);
        hit = true;
        sfx.boom();
        shake(0.16, 3);
        break;
      }
    }
    if (hit) bullets.splice(i, 1);
  }
}
