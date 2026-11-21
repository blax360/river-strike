'use strict';
/* =========================================================================
   20-sprites.js · sprites pixel-art estilo FAMICOM generados en runtime
   ========================================================================= */

const PX = 3;
const PAL = {
  A: '#101724', B: '#cfdcea', C: '#5ad8ff', S: '#8798ad', R: '#e04a4a',
  G: '#4fc84f', K: '#1c6a24', Y: '#f7d84a', O: '#a35f24', W: '#f4f8ff',
  D: '#5f6f85', M: '#b8c8dc'
};

const mirrorRow = half => half + half.slice(0, -1).split('').reverse().join('');

function buildSprite(rows, pal, px, mirror) {
  const src = mirror ? rows.map(mirrorRow) : rows;
  const w = Math.max.apply(null, src.map(r => r.length)), h = src.length;
  const cv = document.createElement('canvas');
  cv.width = w * px; cv.height = h * px;
  const g = cv.getContext('2d');
  for (let y = 0; y < h; y++) {
    const row = src[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      g.fillStyle = pal[ch] || '#f0f';
      g.fillRect(x * px, y * px, px, px);
    }
  }
  cv.uw = w; cv.uh = h;
  return cv;
}

const SPR = {};

function buildSprites() {
  // ---- caza del jugador (13x13) ----
  SPR.player = buildSprite([
    '......A',
    '.....AB',
    '.....BC',
    '.....BC',
    '....ABB',
    '...AASB',
    '..A.ASB',
    '.AA..SB',
    'AA...SB',
    'AA...AB',
    '.....AB',
    '......B',
    '......A'
  ], PAL, PX, true);

  // ---- llamas del motor (5x4) ----
  const flamePal = { Y: '#ffe066', O: '#ff9a2e', W: '#fff6d0', R: '#ff5a2e' };
  SPR.flame = [
    buildSprite(['.Y.', 'YOY', 'YOY', '.O.'], flamePal, PX, true),
    buildSprite(['..Y', 'YOY', 'YOY', 'OWO', '.O.'], flamePal, PX, true)
  ];

  // ---- carguero (15x9) ----
  SPR.ship = buildSprite([
    '.......A',
    '......AS',
    '......AS',
    'AAAAAAAS',
    'ASBBBBBB',
    'ASRRRRRR',
    'ASBBBBBB',
    'AAAAAAAS',
    '..AA..AS'
  ], PAL, PX, true);

  // ---- helicóptero (13x7) ----
  SPR.heli = buildSprite([
    '......A',
    '.....AS',
    'AAGGGCB',
    '.AGWWGB',
    '.AGGGGB',
    '..AGGGG',
    '...AAA.'
  ], PAL, PX, true);

  // ---- caza enemigo (11x11) ----
  SPR.ejet = buildSprite([
    '.....A',
    '....AC',
    '....AC',
    '...AAC',
    '..AARD',
    '.AARDD',
    'AARRRR',
    '.AARDD',
    '..AARD',
    '...AAR',
    '....AA'
  ], PAL, PX, true);

  // ---- bidón de combustible (11x11) ----
  SPR.fuel = buildSprite([
    '....AA',
    '..AAAB',
    '.ABBBB',
    '.ABRRR',
    '.ABBBB',
    '.ABRRR',
    '.ABWWW',
    '.ABBBB',
    '.ABRRR',
    '..AAAB',
    '...AAA'
  ], PAL, PX, true);

  // ---- árbol (7x8) ----
  SPR.tree = buildSprite([
    '..KKK..',
    '.KKKKK.',
    '.KGGGK.',
    'KKGGGKK',
    '.KGGGK.',
    '..KGK..',
    '...O...',
    '..OOO..'
  ], PAL, PX, false);

  // ---- vida extra (7x6) ----
  SPR.life = buildSprite([
    '..AAA..',
    '.AWMWA.',
    'AWMMWMA',
    '.AAAAA.',
    '..A.A..'
  ], PAL, PX, false);

  // ---- misil enemigo (7x9) ----
  SPR.missile = buildSprite([
    '...A...',
    '..AWA..',
    '..ARA..',
    '.ARRRA.',
    '.ARRRA.',
    '.ARRRA.',
    '..ARA..',
    '...Y...',
    '...Y...'
  ], PAL, PX, true);
}

function blit(c, spr, x, y) {
  c.drawImage(spr, Math.round(x - spr.width / 2), Math.round(y - spr.height / 2));
}
