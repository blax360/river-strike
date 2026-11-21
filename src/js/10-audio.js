'use strict';
/* =========================================================================
   10-audio.js · motor de audio chiptune 100% sintetizado (sin assets)
   ========================================================================= */

const Audio2 = {
  ac: null, master: null, sfx: null, mus: null,
  engOsc: null, engGain: null, engFilt: null,
  on: true, ready: false,
  step: 0, nextTime: 0, bpm: 148, intensity: 0, playing: false
};

function audioInit() {
  if (Audio2.ready) {
    if (Audio2.ac && Audio2.ac.state === 'suspended') Audio2.ac.resume();
    return;
  }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  try { Audio2.ac = new C({ latencyHint: 'interactive' }); } catch (e) { Audio2.ac = new C(); }
  const ac = Audio2.ac;
  Audio2.master = ac.createGain();
  Audio2.master.gain.value = Save.data.mute ? 0 : 0.72;
  Audio2.master.connect(ac.destination);
  Audio2.sfx = ac.createGain(); Audio2.sfx.gain.value = 0.9; Audio2.sfx.connect(Audio2.master);
  Audio2.mus = ac.createGain(); Audio2.mus.gain.value = 0.30; Audio2.mus.connect(Audio2.master);

  // dron del motor
  Audio2.engOsc = ac.createOscillator();
  Audio2.engOsc.type = 'sawtooth';
  Audio2.engOsc.frequency.value = 46;
  Audio2.engFilt = ac.createBiquadFilter();
  Audio2.engFilt.type = 'lowpass';
  Audio2.engFilt.frequency.value = 260;
  Audio2.engFilt.Q.value = 3;
  Audio2.engGain = ac.createGain();
  Audio2.engGain.gain.value = 0;
  Audio2.engOsc.connect(Audio2.engFilt);
  Audio2.engFilt.connect(Audio2.engGain);
  Audio2.engGain.connect(Audio2.master);
  Audio2.engOsc.start();
  Audio2.ready = true;
  Audio2.nextTime = ac.currentTime + 0.08;
}

function audioMute() {
  Save.data.mute = !Save.data.mute;
  if (Audio2.master) Audio2.master.gain.value = Save.data.mute ? 0 : 0.72;
  Save.write();
}
function engineSet(on, throttle) {
  if (!Audio2.ready) return;
  const t = Audio2.ac.currentTime;
  Audio2.engGain.gain.setTargetAtTime(on ? 0.055 : 0, t, 0.09);
  if (on) {
    Audio2.engOsc.frequency.setTargetAtTime(38 + (throttle || 1) * 22, t, 0.07);
    Audio2.engFilt.frequency.setTargetAtTime(220 + (throttle || 1) * 140, t, 0.1);
  }
}

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
function noiseHit(dur, vol, f0, f1, dest, q) {
  if (!Audio2.ready || Save.data.mute) return;
  const ac = Audio2.ac, t = ac.currentTime;
  if (!_noiseBuf) {
    const len = Math.floor(ac.sampleRate * 1.0);
    _noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const d = _noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource();
  src.buffer = _noiseBuf;
  src.playbackRate.value = 1;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = q || 1;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest || Audio2.sfx);
  src.start(t); src.stop(t + dur + 0.02);
}

/* ------------------------------------------------------------------- sfx */
const sfx = {
  shoot: () => { tone(1180, 320, 0.055, 'square', 0.085); noiseHit(0.04, 0.05, 7000, 2500); },
  hit: () => { noiseHit(0.16, 0.35, 3200, 400); tone(320, 90, 0.14, 'square', 0.12); },
  boom: () => { noiseHit(0.45, 0.5, 1900, 120); tone(140, 45, 0.35, 'sawtooth', 0.24); },
  bigBoom: () => {
    noiseHit(0.9, 0.62, 1500, 60); tone(90, 26, 0.75, 'sawtooth', 0.34);
    tone(60, 30, 1.0, 'triangle', 0.2);
  },
  refuel: v => tone(420 + v * 5, 480 + v * 5, 0.05, 'sine', 0.05),
  beep: () => tone(1180, 1180, 0.06, 'square', 0.075),
  warn: () => { tone(880, 880, 0.07, 'square', 0.07); tone(660, 660, 0.07, 'square', 0.06, 0.09); },
  life: () => [784, 988, 1319, 1568].forEach((f, i) => tone(f, f, 0.09, 'square', 0.12, i * 0.07)),
  sector: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.1, 'square', 0.12, i * 0.075)),
  crash: () => { noiseHit(0.85, 0.6, 1700, 70); tone(120, 30, 0.6, 'sawtooth', 0.3, 0, Audio2.sfx); },
  combo: n => { tone(660 + n * 90, 660 + n * 90, 0.05, 'square', 0.06); },
  overheat: () => { noiseHit(0.3, 0.25, 3000, 500); tone(220, 110, 0.25, 'square', 0.1); },
  promo: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.11, 'square', 0.11, i * 0.08)),
  coin: () => { tone(988, 1319, 0.09, 'square', 0.12); tone(1319, 1319, 0.12, 'square', 0.09, 0.09); },
  slam: () => { noiseHit(1.0, 0.5, 900, 40); tone(70, 24, 0.9, 'triangle', 0.4); },
  start: () => [392, 523, 659, 784].forEach((f, i) => tone(f, f, 0.09, 'square', 0.13, i * 0.06))
};

/* ---------------------------------------------------------------- música */
const midiF = n => 440 * Math.pow(2, (n - 69) / 12);
const ROOTS = [45, 41, 43, 45];            // A2 F2 G2 A2
const MEL = [
  69, 0, 0, 72, 0, 0, 76, 0, 74, 0, 72, 0, 69, 0, 0, 0,
  69, 0, 0, 72, 0, 0, 76, 0, 79, 0, 81, 0, 79, 0, 76, 0,
  77, 0, 0, 74, 0, 0, 72, 0, 74, 0, 76, 0, 79, 0, 76, 0,
  81, 0, 79, 0, 76, 0, 74, 0, 72, 0, 74, 0, 69, 0, 0, 0
];
const ARP = [0, 7, 12, 7, 15, 7, 12, 7];

function musicStart() {
  if (!Audio2.ready) return;
  Audio2.playing = true;
}
function musicStop() { Audio2.playing = false; }
function musicReset() { Audio2.step = 0; if (Audio2.ac) Audio2.nextTime = Audio2.ac.currentTime + 0.06; }

function musicTick() {
  if (!Audio2.ready || !Audio2.playing || Save.data.mute) return;
  const ac = Audio2.ac;
  const spb = 60 / Audio2.bpm / 4;              // semicorchea
  if (Audio2.nextTime < ac.currentTime - 0.35) Audio2.nextTime = ac.currentTime + 0.05;
  const horizon = ac.currentTime + 0.22;
  let guard = 0;
  while (Audio2.nextTime < horizon && guard++ < 32) {
    const s = Audio2.step % 64;
    const when = Audio2.nextTime - ac.currentTime;
    const m = MEL[s];
    if (m) tone(midiF(m), midiF(m), spb * 0.9, 'square', 0.055, when, Audio2.mus);
    if (s % 4 === 0) {
      const root = ROOTS[Math.floor(s / 16) % 4];
      tone(midiF(root), midiF(root), spb * 2.2, 'triangle', 0.13, when, Audio2.mus);
    }
    if (s % 8 === 4) {
      const root = ROOTS[Math.floor(s / 16) % 4] + 12;
      tone(midiF(root), midiF(root), spb * 0.8, 'triangle', 0.06, when, Audio2.mus);
    }
    // arpegio extra cuando sube la intensidad
    if (Audio2.intensity >= 1 && s % 2 === 0) {
      const root = ROOTS[Math.floor(s / 16) % 4] + 12 + ARP[(s / 2) % 8];
      tone(midiF(root), midiF(root), spb * 0.5, 'square', 0.028, when, Audio2.mus);
    }
    if (s % 4 === 0) tone(120, 45, 0.07, 'sine', 0.16, when, Audio2.mus);
    if (s % 4 === 2) noiseHit(0.06, 0.09, 6000, 2200, Audio2.mus, 2);
    if (s % 2 === 1) noiseHit(0.02, 0.035, 11000, 7000, Audio2.mus, 1);
    Audio2.nextTime += spb;
    Audio2.step++;
  }
}
