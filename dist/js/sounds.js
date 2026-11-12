// Chess sounds, synthesized in the browser: no audio files.
// move · capture · castle · check · promote · illegal · hint · game start (war horn) · game end (bell) · clash
import { store } from './ui.js';

let ctx = null, master = null, verb = null, noise = null;
export const sound = {
  get on() { return store.get('got.sound', true); },
  set on(v) { store.set('got.sound', !!v); if (v) unlock(); },
};

function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12;
  master.connect(comp).connect(ctx.destination);
  verb = ctx.createConvolver();
  const len = ctx.sampleRate * 2.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  verb.buffer = ir;
  const vg = ctx.createGain(); vg.gain.value = 0.35; verb.connect(vg).connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return true;
}
// Browsers allow audio only after a user gesture.
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { if (sound.on) unlock(); }, { once: true, capture: true });

function out(node, wet = 0.15) {
  node.connect(master);
  if (wet) { const s = ctx.createGain(); s.gain.value = wet; node.connect(s).connect(verb); }
}
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function knock(t, freq, q, gain, d, wet) {
  const src = ctx.createBufferSource(); src.buffer = noise;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); env(g, t, 0.001, gain, d);
  src.connect(f).connect(g); out(g, wet); src.start(t, Math.random() * 0.5); src.stop(t + d + 0.05);
}
function tone(t, { type = 'sine', f = 440, to, gain = 0.2, a = 0.002, d = 0.2, wet = 0.2 }) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + a + d);
  const g = ctx.createGain(); env(g, t, a, gain, d); o.connect(g); out(g, wet); o.start(t); o.stop(t + a + d + 0.05);
}
function bell(t, f, gain = 0.15, d = 1.4, wet = 0.5) {
  const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
  c.frequency.value = f; m.frequency.value = f * 1.41;
  mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + d);
  m.connect(mg).connect(c.frequency); env(g, t, 0.003, gain, d); c.connect(g); out(g, wet);
  c.start(t); m.start(t); c.stop(t + d + 0.1); m.stop(t + d + 0.1);
}

function ready() { return sound.on && unlock() && ctx.state !== 'closed'; }

export function play(kind) {
  if (!ready()) return;
  const t = ctx.currentTime + 0.01;
  switch (kind) {
    case 'move': knock(t, 1150, 1.4, 0.7, 0.06, 0.08); tone(t, { f: 170, to: 90, gain: 0.45, d: 0.08, wet: 0.05 }); break;
    case 'capture': knock(t, 2300, 0.9, 0.9, 0.08, 0.12); knock(t + 0.012, 900, 1.2, 0.5, 0.07, 0.1); tone(t, { f: 230, to: 70, gain: 0.55, d: 0.12, wet: 0.08 });
      for (let k = 0; k < 5; k++) knock(t + 0.03 + k * 0.022 + Math.random() * 0.02, 4200 + Math.random() * 2600, 3, 0.22, 0.05, 0.25); break; // marble shards
    case 'castle': play('move'); setTimeout(() => play('move'), 110); break;
    case 'check': bell(t, 880, 0.16, 0.9); bell(t + 0.08, 1320, 0.1, 0.8); knock(t, 1400, 1.2, 0.5, 0.06, 0.1); break;
    case 'promote': [523, 659, 784, 1046].forEach((f, i) => bell(t + i * 0.07, f, 0.1, 1, 0.5)); break;
    case 'illegal': tone(t, { type: 'triangle', f: 140, to: 90, gain: 0.25, d: 0.12, wet: 0.05 }); break;
    case 'hint': bell(t, 1174, 0.07, 0.7, 0.6); bell(t + 0.09, 1568, 0.05, 0.7, 0.6); break;
    case 'start': horn(t); break;
    case 'clash': // two kings meet: a ringing, metallic hit
      knock(t, 3000, 4, 0.7, 0.18, 0.4); tone(t, { f: 120, to: 55, gain: 0.6, d: 0.25, wet: 0.2 });
      for (const [f, g, d] of [[1720, 0.09, 1.1], [2630, 0.07, 0.9], [3810, 0.05, 0.7], [5170, 0.03, 0.5]]) tone(t, { f, gain: g, d, wet: 0.6 });
      break;
    case 'end': bell(t, 196, 0.26, 3.2, 0.7); bell(t + 0.02, 293.7, 0.12, 2.6, 0.7); break;
    case 'win': [392, 523, 659, 784].forEach((f, i) => bell(t + i * 0.12, f, 0.14, 1.8, 0.6)); break;
    case 'steel': // blades meeting: a bright scrape and a ring
      knock(t, 5200, 2, 0.6, 0.12, 0.3); knock(t + 0.01, 2600, 3, 0.4, 0.2, 0.3);
      for (const [f, g, d] of [[2210, 0.07, 0.8], [3370, 0.05, 0.6], [4630, 0.035, 0.5]]) tone(t, { f, gain: g, d, wet: 0.5 });
      break;
    default: break;
  }
}

// Original soundscapes for the five Game of Thrones scenes on the home page (synthesized, no recordings).
function noiseBed(t, { from = 400, to = 400, q = 1, gain = 0.2, dur = 2, attack = 0.4, type = 'bandpass', wet = 0.3 }) {
  const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g); out(g, wet); src.start(t); src.stop(t + dur + 0.1);
}
function drum(t, gain = 0.6) { tone(t, { f: 95, to: 42, gain, d: 0.5, wet: 0.35 }); knock(t, 180, 1, gain * 0.6, 0.12, 0.3); }
export function scene(kind) {
  if (!ready()) return;
  const t = ctx.currentTime + 0.05;
  switch (kind) {
    case 'toll': // a great bell over a murmuring crowd
      noiseBed(t, { from: 500, to: 380, q: 0.7, gain: 0.07, dur: 4.5, attack: 1 });
      [0, 1.5, 3].forEach((k) => bell(t + k, 98, 0.22, 2.6, 0.7));
      break;
    case 'wildfire': // something catches, rushes up and bursts
      noiseBed(t, { from: 180, to: 3800, q: 0.6, gain: 0.25, dur: 1.5, attack: 1.2, type: 'lowpass' });
      tone(t + 1.3, { f: 70, to: 28, gain: 0.8, d: 1.1, wet: 0.5 });
      noiseBed(t + 1.3, { from: 1400, to: 300, q: 0.5, gain: 0.3, dur: 1.8, attack: 0.02, type: 'lowpass', wet: 0.5 });
      for (let k = 0; k < 14; k++) knock(t + 1.4 + Math.random() * 1.6, 2500 + Math.random() * 3000, 4, 0.12, 0.03, 0.2);
      break;
    case 'drums': // slow drums under a dark drone (an original figure)
      for (const f of [110, 130.8, 164.8]) tone(t, { f, gain: 0.05, a: 1.2, d: 3.4, wet: 0.6 });
      [0, 0.75, 1.5, 2.6].forEach((k, i) => drum(t + k, i === 3 ? 0.8 : 0.5));
      break;
    case 'charge': // a horn, then hooves
      horn(t);
      for (let k = 0; k < 12; k++) { const b = t + 1.2 + Math.floor(k / 3) * 0.42 + (k % 3) * 0.09; knock(b, 260 + Math.random() * 80, 1.5, 0.35, 0.05, 0.15); }
      break;
    case 'winter': // wind, then a sudden blade
      noiseBed(t, { from: 500, to: 1600, q: 1.2, gain: 0.16, dur: 2.6, attack: 1 });
      noiseBed(t + 0.6, { from: 1800, to: 700, q: 2, gain: 0.08, dur: 2, attack: 0.8 });
      setTimeout(() => play('steel'), 2100);
      break;
    default: break;
  }
}

// A short war horn: two detuned saws through a slowly opening filter.
function horn(t) {
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 3;
  f.frequency.setValueAtTime(220, t); f.frequency.exponentialRampToValueAtTime(1300, t + 0.45); f.frequency.exponentialRampToValueAtTime(400, t + 1.6);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32, t + 0.3); g.gain.setValueAtTime(0.32, t + 1.0); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.75);
  f.connect(g); out(g, 0.6);
  for (const [freq, det] of [[98, 0], [98, 9], [147, -6]]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(freq * 0.94, t); o.frequency.linearRampToValueAtTime(freq, t + 0.25); o.detune.value = det;
    const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5; vg.gain.value = 1.5; vib.connect(vg).connect(o.frequency);
    o.connect(f); o.start(t); vib.start(t); o.stop(t + 1.8); vib.stop(t + 1.8);
  }
}
