'use strict';
/* =========================================================================
   RIVER STRIKE — AKUMU GAMES
   00-core.js · constantes, utilidades, guardado, tipografía pixel
   ========================================================================= */

const W = 540, H = 800;
const HUD_TOP = 54, HUD_BOT = 62;
const PLAY_TOP = HUD_TOP, PLAY_H = H - HUD_TOP - HUD_BOT;
const ROW_H = 10;

const S = { SPLASH: 0, TITLE: 1, PLAY: 2, DYING: 3, OVER: 4, PAUSE: 5 };

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const pad6 = n => String(Math.max(0, Math.floor(n))).padStart(6, '0');

/* ---------------------------------------------------------------- guardado */
const SAVE_KEY = 'riverstrike.save.v2';
const TAURI = (typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.core)
  ? window.__TAURI__.core : null;
const APP_VERSION = '1.1.0';

const DEFAULT_SAVE = {
  hi: 0, bestSector: 1, bestCombo: 0, runs: 0, kills: 0, mute: false,
  bestRank: 0, farthest: 0, totalTime: 0
};

const Save = {
  data: Object.assign({}, DEFAULT_SAVE),
  read() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* almacenamiento no disponible */ }
  },
  async readDisk() {
    if (!TAURI) return;
    try {
      const raw = await TAURI.invoke('load_save');
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d && typeof d === 'object') {
        const merged = Object.assign({}, DEFAULT_SAVE, d);
        for (const k in merged) {
          const cur = this.data[k], next = merged[k];
          if (typeof next === 'number') this.data[k] = Math.max(cur || 0, next);
          else this.data[k] = next;
        }
      }
    } catch (e) { /* primer arranque */ }
  },
  write() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* noop */ }
    if (TAURI) {
      try { TAURI.invoke('save_data', { json: JSON.stringify(this.data) }).catch(() => {}); } catch (e) { /* noop */ }
    }
  }
};
Save.read();

/* ------------------------------------------------------------------ rango */
const RANKS = [
  { at: 0,     name: 'CADETE' },
  { at: 4000,  name: 'PILOTO' },
  { at: 12000, name: 'CAPITAN' },
  { at: 26000, name: 'AS' },
  { at: 45000, name: 'LEYENDA' },
  { at: 80000, name: 'AKUMU' }
];
function rankFor(score) {
  let r = 0;
  for (let i = 0; i < RANKS.length; i++) if (score >= RANKS[i].at) r = i;
  return r;
}

/* -------------------------------------------------------------- tipografía
   Fuente bitmap 5x7 en hex (7 filas, 5 bits). Cada glifo = 14 caracteres. */
const FONT = {
  'A': '0E11111F111111', 'B': '1E11111E11111E', 'C': '0E11101010110E', 'D': '1E11111111111E',
  'E': '1F10101E10101F', 'F': '1F10101E101010', 'G': '0E11101711110E', 'H': '1111111F111111',
  'I': '0E04040404040E', 'J': '0702020202120C', 'K': '11121418141211', 'L': '1010101010101F',
  'M': '111B1515111111', 'N': '11191513111111', 'O': '0E11111111110E', 'P': '1E11111E101010',
  'Q': '0E11111115120D', 'R': '1E11111E141211', 'S': '0F10100E01011E', 'T': '1F040404040404',
  'U': '1111111111110E', 'V': '11111111110A04', 'W': '11111115151B11', 'X': '11110A040A1111',
  'Y': '11110A04040404', 'Z': '1F01020408101F',
  '0': '0E11131519110E', '1': '040C040404040E', '2': '0E11010204081F', '3': '1F02040201110E',
  '4': '02060A121F0202', '5': '1F101E0101110E', '6': '0608101E11110E', '7': '1F010204080808',
  '8': '0E11110E11110E', '9': '0E11110F01020C',
  ' ': '00000000000000', '.': '00000000000C0C', ':': '000C0C000C0C00', '-': '0000001F000000',
  '!': '04040404040004', '/': '01020204080810', '+': '0004041F040400', '?': '0E110102040004',
  "'": '04040000000000', '(': '02040808080402', ')': '08040202020408', '>': '08040201020408',
  '<': '02040810080402', '=': '00001F001F0000', '*': '000A041F040A00', '#': '0A0A1F0A1F0A0A',
  ',': '00000000000C04', '%': '11020404081100', '"': '0A0A0000000000', '_': '0000000000001F',
  '↑': '040E1504040404', '↓': '04040404150E04', '←': '0004081F080400', '→': '0004021F020400',
  '×': '00110A040A1100', '·': '0000000C0C0000', '★': '040E1F0E0A0A00', '♥': '000A1F1F0E0400',
  '[': '0E08080808080E', ']': '0E02020202020E'
};

const _txtCache = new Map();
const TXT_CACHE_MAX = 90;

/* Devuelve un canvas con el texto pixel dibujado a escala s (1px lógico = s px). */
function pxSprite(str, s, color, glow, glowColor) {
  const key = str + '|' + s + '|' + color + '|' + (glow ? (glowColor || color) + glow : '');
  let cv = _txtCache.get(key);
  if (cv) return cv;
  const chars = str.toUpperCase().split('');
  const w = Math.max(1, chars.length * 6 - 1), h = 7;
  cv = document.createElement('canvas');
  cv.width = Math.ceil(w * s + (glow ? glow * 3 : 0));
  cv.height = Math.ceil(h * s + (glow ? glow * 3 : 0));
  const g = cv.getContext('2d');
  const ox = glow ? glow * 1.5 : 0, oy = ox;
  g.fillStyle = color;
  if (glow) { g.shadowColor = glowColor || color; g.shadowBlur = glow * s; }
  for (let i = 0; i < chars.length; i++) {
    const data = FONT[chars[i]];
    if (!data) continue;
    for (let r = 0; r < 7; r++) {
      const bits = parseInt(data.substr(r * 2, 2), 16);
      if (!bits) continue;
      for (let b = 0; b < 5; b++) {
        if (bits & (1 << (4 - b))) g.fillRect(ox + (i * 6 + b) * s, oy + r * s, s, s);
      }
    }
  }
  if (_txtCache.size > TXT_CACHE_MAX) _txtCache.clear();
  _txtCache.set(key, cv);
  return cv;
}
function pxText(c, str, x, y, s, color, glow, align, glowColor) {
  const spr = pxSprite(str, s, color, glow, glowColor);
  const gw = (str.length * 6 - 1) * s;
  let dx = x;
  if (align === 'center') dx = x - gw / 2; else if (align === 'right') dx = x - gw;
  c.drawImage(spr, Math.round(dx - (glow ? glow * 1.5 : 0)), Math.round(y - (glow ? glow * 1.5 : 0)));
}
function pxWidth(str, s) { return (str.length * 6 - 1) * s; }

/* Texto con degradado vertical (para los logos grandes). */
function pxTextGrad(c, str, x, y, s, stops, glow, glowColor) {
  const spr = pxSprite(str, s, '#ffffff', 0);
  const tmp = document.createElement('canvas');
  tmp.width = spr.width; tmp.height = spr.height;
  const t = tmp.getContext('2d');
  t.drawImage(spr, 0, 0);
  t.globalCompositeOperation = 'source-in';
  const g = t.createLinearGradient(0, 0, 0, tmp.height);
  stops.forEach(st => g.addColorStop(st[0], st[1]));
  t.fillStyle = g; t.fillRect(0, 0, tmp.width, tmp.height);
  c.save();
  if (glow) { c.shadowColor = glowColor; c.shadowBlur = glow; }
  c.drawImage(tmp, Math.round(x - tmp.width / 2), Math.round(y));
  c.restore();
}

/* ------------------------------------------------------------------ color */
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}
function mixHex(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}
