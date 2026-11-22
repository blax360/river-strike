'use strict';
/* =========================================================================
   10-audio.js · motor chiptune 2.0
   · cadena master con compresor + delay (pegada y espacio)
   · secuenciador de 4 pistas (bajo, melodía, arpegio, batería)
   · progresión Am–F–C–G con dos secciones (A/B)
   · sting orquestado para el logo AKUMU GAMES
   ========================================================================= */

const Audio2 = {
  ac: null, master: null, comp: null, sfx: null, mus: null, delay: null,
  engOsc: null, engGain: null, engFilt: null,
  on: true, ready: false,
  step: 0, nextTime: 0, bpm: 150, intensity: 0, mode: 'off',
  section: 0, pendingSting: false
};

const midiF = n => 440 * Math.pow(2, (n - 69) / 12);

function audioInit() {
  if (Audio2.ready) {
    if (Audio2.ac && Audio2.ac.state === 'suspended') {
      Audio2.ac.resume().then(() => {
        if (Audio2.pendingSting) { Audio2.pendingSting = false; audioSting(0.55); }
      }).catch(() => {});
    }
    return;
  }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  try { Audio2.ac = new C({ latencyHint: 'interactive' }); } catch (e) { Audio2.ac = new C(); }
  const ac = Audio2.ac;

  // fuentes -> master -> compresor -> salida
  Audio2.master = ac.createGain();
  Audio2.master.gain.value = Save.data.mute ? 0 : 0.78;

  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 18;
  comp.ratio.value = 3.2;
  comp.attack.value = 0.004;
  comp.release.value = 0.18;
  Audio2.comp = comp;
  Audio2.master.connect(comp);
  comp.connect(ac.destination);

  Audio2.sfx = ac.createGain(); Audio2.sfx.gain.value = 0.95; Audio2.sfx.connect(Audio2.master);
  Audio2.mus = ac.createGain(); Audio2.mus.gain.value = 0.50; Audio2.mus.connect(Audio2.master);

  // delay para dar aire a la música
  const dly = ac.createDelay(0.6);
  dly.delayTime.value = 0.21;
  const fb = ac.createGain(); fb.gain.value = 0.26;
  const wet = ac.createGain(); wet.gain.value = 0.22;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  dly.connect(fb); fb.connect(dly);
  dly.connect(lp); lp.connect(wet); wet.connect(Audio2.master);
  Audio2.delay = ac.createGain(); Audio2.delay.gain.value = 1; Audio2.delay.connect(dly);

  // dron del motor
  Audio2.engOsc = ac.createOscillator();
  Audio2.engOsc.type = 'sawtooth';
  Audio2.engOsc.frequency.value = 46;
  Audio2.engFilt = ac.createBiquadFilter();
  Audio2.engFilt.type = 'lowpass'; Audio2.engFilt.frequency.value = 260; Audio2.engFilt.Q.value = 3;
  Audio2.engGain = ac.createGain(); Audio2.engGain.gain.value = 0;
  Audio2.engOsc.connect(Audio2.engFilt);
  Audio2.engFilt.connect(Audio2.engGain);
  Audio2.engGain.connect(Audio2.master);
  Audio2.engOsc.start();

  Audio2.ready = true;
  Audio2.nextTime = ac.currentTime + 0.08;
}

function audioMute() {
  Save.data.mute = !Save.data.mute;
  if (Audio2.master && Audio2.ac) {
    Audio2.master.gain.setTargetAtTime(Save.data.mute ? 0 : 0.78, Audio2.ac.currentTime, 0.02);
  }
  Save.write();
}

function engineSet(on, throttle) {
  if (!Audio2.ready) return;
  const t = Audio2.ac.currentTime;
  Audio2.engGain.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.09);
  if (on) {
    Audio2.engOsc.frequency.setTargetAtTime(38 + (throttle || 1) * 22, t, 0.07);
    Audio2.engFilt.frequency.setTargetAtTime(220 + (throttle || 1) * 140, t, 0.1);
  }
}

/* ------------------------------------------------------------- primitivas */
function tone(f0, f1, dur, type, vol, when, dest) {
  if (!Audio2.ready || Save.data.mute) return;
  const ac = Audio2.ac, t = ac.currentTime + Math.max(0, when || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f0, t);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || Audio2.sfx);
  o.start(t); o.stop(t + dur + 0.04);
}

let _noiseBuf = null;
function noiseBuf() {
  const ac = Audio2.ac;
  if (!_noiseBuf) {
    const len = Math.floor(ac.sampleRate * 1.2);
    _noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = _noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return _noiseBuf;
}

function noiseHit(dur, vol, f0, f1, dest, q, when) {
  if (!Audio2.ready || Save.data.mute) return;
  const ac = Audio2.ac, t = ac.currentTime + Math.max(0, when || 0);
  const src = ac.createBufferSource();
  src.buffer = noiseBuf();
  const f = ac.createBiquadFilter();
  f.type = 'lowpass'; f.Q.value = q || 1;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest || Audio2.sfx);
  src.start(t); src.stop(t + dur + 0.02);
}

/* nota con envolvente suave + vibrato opcional + envío a delay */
function note(midi, dur, type, vol, when, dest, vib, send) {
  if (!Audio2.ready || Save.data.mute) return;
  const ac = Audio2.ac, t = ac.currentTime + Math.max(0, when || 0);
  const f = midiF(midi);
  const o = ac.createOscillator();
  o.type = type || 'square';
  o.frequency.setValueAtTime(f * 0.995, t);
  o.frequency.linearRampToValueAtTime(f, t + 0.012);
  if (vib) {
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 5.2; lg.gain.value = f * vib;
    lfo.connect(lg); lg.connect(o.frequency);
    lfo.start(t); lfo.stop(t + dur + 0.05);
  }
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.01);
  g.gain.linearRampToValueAtTime(vol * 0.62, t + Math.min(dur * 0.7, 0.14));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || Audio2.mus);
  if (send) { const s = ac.createGain(); s.gain.value = send; g.connect(s); s.connect(Audio2.delay); }
  o.start(t); o.stop(t + dur + 0.03);
}

function kick(when, vol) {
  if (!Audio2.ready || Save.data.mute) return;
  const ac = Audio2.ac, t = ac.currentTime + Math.max(0, when || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(135, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(vol || 0.42, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g); g.connect(Audio2.mus); o.start(t); o.stop(t + 0.2);
}
function snare(when, vol) {
  noiseHit(0.13, vol || 0.16, 5200, 1400, Audio2.mus, 2, when);
  tone(190, 120, 0.07, 'triangle', (vol || 0.16) * 0.5, when, Audio2.mus);
}
function hat(when, vol) {
  noiseHit(0.025, vol || 0.05, 12000, 8000, Audio2.mus, 1, when);
}

/* ------------------------------------------------------------------- sfx */
const sfx = {
  shoot: () => { tone(1240, 340, 0.05, 'square', 0.07); noiseHit(0.035, 0.045, 8000, 2600); },
  shoot2: () => { tone(980, 300, 0.05, 'square', 0.055); tone(1480, 420, 0.04, 'square', 0.032, 0.01); },
  hit: () => { noiseHit(0.16, 0.32, 3400, 400); tone(320, 90, 0.13, 'square', 0.11); },
  boom: () => { noiseHit(0.45, 0.45, 2000, 120); tone(150, 45, 0.34, 'sawtooth', 0.22); },
  bigBoom: () => {
    noiseHit(0.95, 0.6, 1600, 60); tone(95, 26, 0.8, 'sawtooth', 0.3);
    tone(58, 30, 1.05, 'triangle', 0.22);
  },
  refuel: v => tone(430 + v * 5, 500 + v * 5, 0.05, 'sine', 0.045),
  beep: () => tone(1180, 1180, 0.06, 'square', 0.07),
  warn: () => { tone(900, 900, 0.07, 'square', 0.065); tone(680, 680, 0.07, 'square', 0.055, 0.09); },
  life: () => [784, 988, 1319, 1568].forEach((f, i) => tone(f, f, 0.1, 'square', 0.11, i * 0.07)),
  sector: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.1, 'square', 0.11, i * 0.075)),
  crash: () => { noiseHit(0.9, 0.58, 1800, 70); tone(120, 30, 0.65, 'sawtooth', 0.28); },
  combo: n => { tone(700 + n * 85, 700 + n * 85, 0.045, 'square', 0.05); },
  overheat: () => { noiseHit(0.32, 0.24, 3200, 500); tone(230, 105, 0.26, 'square', 0.09); },
  promo: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.12, 'square', 0.1, i * 0.08)),
  coin: () => { tone(988, 1319, 0.09, 'square', 0.11); tone(1319, 1319, 0.13, 'square', 0.085, 0.09); },
  slam: () => { noiseHit(1.0, 0.5, 900, 40); tone(70, 24, 0.9, 'triangle', 0.38); },
  start: () => [392, 523, 659, 784].forEach((f, i) => tone(f, f, 0.09, 'square', 0.12, i * 0.06)),
  power: () => {
    [0, 1, 2, 3].forEach(i => tone(midiF(72 + i * 4), midiF(72 + i * 4), 0.09, 'square', 0.085, i * 0.045));
    tone(midiF(84), midiF(84), 0.22, 'triangle', 0.07, 0.19);
  },
  shield: () => {
    tone(220, 660, 0.28, 'sine', 0.11);
    tone(330, 990, 0.3, 'triangle', 0.055, 0.02);
    noiseHit(0.3, 0.07, 6000, 1200, Audio2.sfx, 3);
  },
  shieldHit: () => { noiseHit(0.25, 0.28, 5000, 900, Audio2.sfx, 3); tone(700, 180, 0.25, 'square', 0.095); },
  x2: () => [0, 4, 7, 12].forEach((n, i) => tone(midiF(69 + n), midiF(69 + n), 0.12, 'square', 0.07, i * 0.05)),
  pickup: () => { tone(1319, 1760, 0.07, 'square', 0.065); tone(1760, 1760, 0.09, 'square', 0.048, 0.07); }
};

/* --------------------------------------------------------- música: datos */
/* Am – F – C – G */
const PROG = [
  { root: 45, chord: [69, 72, 76], arp: [0, 12, 7, 12, 15, 12, 7, 12] },
  { root: 41, chord: [65, 69, 72], arp: [0, 12, 7, 12, 16, 12, 7, 12] },
  { root: 48, chord: [67, 72, 76], arp: [0, 12, 7, 12, 16, 12, 7, 12] },
  { root: 43, chord: [67, 71, 74], arp: [0, 12, 7, 14, 19, 14, 7, 12] }
];

const MEL_A = [
  69, 0, 72, 0, 76, 0, 74, 0, 72, 0, 69, 0, 72, 0, 74, 0,
  65, 0, 69, 0, 72, 0, 69, 0, 65, 0, 64, 0, 65, 0, 69, 0,
  67, 0, 72, 0, 76, 0, 72, 0, 71, 0, 72, 0, 67, 0, 65, 0,
  67, 0, 71, 0, 74, 0, 79, 0, 76, 0, 74, 0, 71, 0, 0, 0
];
const MEL_B = [
  81, 0, 79, 0, 76, 0, 79, 0, 81, 0, 84, 0, 81, 0, 79, 0,
  77, 0, 76, 0, 72, 0, 76, 0, 77, 0, 79, 0, 76, 0, 72, 0,
  79, 0, 76, 0, 72, 0, 76, 0, 79, 0, 84, 0, 81, 0, 79, 0,
  74, 0, 71, 0, 74, 0, 79, 0, 81, 0, 79, 0, 74, 0, 71, 0
];

function musicStart() { if (Audio2.ready) Audio2.mode = 'game'; }
function musicStop() { Audio2.mode = 'off'; }
function musicTitle() { if (Audio2.ready) { Audio2.mode = 'title'; Audio2.step = 0; } }
function musicReset() { Audio2.step = 0; if (Audio2.ac) Audio2.nextTime = Audio2.ac.currentTime + 0.06; }
function musicSection(n) { Audio2.section = n ? 1 : 0; }
function musicIntensity(n) { Audio2.intensity = n; }

/* ------------------------------------------------------ música: secuencia */
function musicTick() {
  if (!Audio2.ready || Audio2.mode === 'off' || Save.data.mute) return;
  const ac = Audio2.ac;
  const title = Audio2.mode === 'title';
  const bpm = title ? 128 : Audio2.bpm;
  const spb = 60 / bpm / 4;                       // semicorchea
  if (Audio2.nextTime < ac.currentTime - 0.35) Audio2.nextTime = ac.currentTime + 0.05;
  const horizon = ac.currentTime + 0.22;
  let guard = 0;

  while (Audio2.nextTime < horizon && guard++ < 40) {
    const s = Audio2.step % 64;
    const bar = Math.floor(s / 16);
    const p = PROG[bar % 4];
    const mel = Audio2.section ? MEL_B : MEL_A;
    const when = Audio2.nextTime - ac.currentTime;

    // melodía
    const m = mel[s];
    if (m) note(m, spb * 1.75, 'square', title ? 0.055 : 0.062, when, Audio2.mus, 0.004, 0.32);

    // bajo (corcheas con salto de octava)
    if (s % 2 === 0) {
      const alt = (s % 8 === 4) ? 12 : 0;
      note(p.root + alt, spb * 1.65, 'triangle', 0.17, when, Audio2.mus, 0, 0.04);
    }

    // arpegio al subir la intensidad
    if (!title && Audio2.intensity >= 1) {
      const an = p.chord[0] + p.arp[s % 8] - 12;
      note(an, spb * 0.7, 'square', 0.026, when, Audio2.mus, 0, 0.5);
    }

    // batería
    if (!title) {
      if (s % 8 === 0) kick(when, 0.4);
      if (s % 8 === 4) snare(when, 0.15);
      if (Audio2.intensity >= 1 && s % 2 === 1) hat(when, 0.042);
      else if (s % 4 === 2) hat(when, 0.028);
      if (Audio2.intensity >= 2 && s % 8 === 6) kick(when, 0.2);
    } else {
      if (s % 4 === 2) hat(when, 0.02);
      if (s === 0) kick(when, 0.18);
    }

    Audio2.nextTime += spb;
    Audio2.step++;
  }
}

/* -------------------------------------------- sting del logo AKUMU GAMES */
function riser(dur, f0, f1, vol) {
  if (!Audio2.ready || Save.data.mute) return;
  const ac = Audio2.ac, t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(400, t);
  f.frequency.exponentialRampToValueAtTime(9000, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.85);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
  o.connect(f); f.connect(g); g.connect(Audio2.master);
  o.start(t); o.stop(t + dur + 0.08);
}

function audioSting(vol) {
  if (!Audio2.ready || Audio2.ac.state === 'suspended') { Audio2.pendingSting = true; return; }
  const v = vol === undefined ? 1 : vol;
  const at = 0.06;

  // 1) subida
  riser(0.5, 70, 1500, 0.15 * v);
  noiseHit(0.55, 0.1 * v, 400, 9000, Audio2.master, 6);

  // 2) impacto del logo
  noiseHit(0.7, 0.32 * v, 2400, 70, Audio2.master, 1, at + 0.42);
  tone(70, 26, 0.9, 'sine', 0.38 * v, at + 0.42, Audio2.master);
  tone(140, 52, 0.5, 'triangle', 0.13 * v, at + 0.42, Audio2.master);
  kick(at + 0.42, 0.3 * v);

  // 3) acorde sostenido (la menor) ligeramente desafinado
  [57, 60, 64, 69].forEach((n, i) => {
    note(n, 1.5, 'sawtooth', 0.07 * v, at + 0.44 + i * 0.012, Audio2.mus, 0.01, 0.5);
    note(n + 12, 1.2, 'square', 0.02 * v, at + 0.45 + i * 0.012, Audio2.mus, 0.008, 0.4);
  });

  // 4) fanfarria
  [69, 72, 76, 81, 84].forEach((n, i) => {
    note(n, 0.22, 'square', 0.068 * v, at + 0.95 + i * 0.11, Audio2.mus, 0.006, 0.45);
    note(n - 12, 0.22, 'triangle', 0.045 * v, at + 0.95 + i * 0.11, Audio2.mus, 0, 0.2);
  });
  tone(69, 69, 0.8, 'triangle', 0.09 * v, at + 1.5, Audio2.mus);
  kick(at + 0.95, 0.18 * v);
}
