// Tiny synthesised sound effects (Web Audio). No sound files needed.
let ctx = null;
let muted = false;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
  } catch { /* no audio available */ }
}
export function setMuted(m) { muted = m; }
export function isMuted() { return muted; }

function tone(freq, start, dur, { type = "sine", gain = 0.18, slide = 0 } = {}) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + start;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(start, dur, gain = 0.12, freq = 900) {
  if (!ctx || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "bandpass"; f.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(ctx.destination);
  src.start(ctx.currentTime + start);
}

export const sfx = {
  /** sahi rep */
  ding() { tone(988, 0, 0.35, { gain: 0.16 }); tone(1319, 0.09, 0.45, { gain: 0.14 }); },
  /** ring collected / small reward */
  pop() { tone(660, 0, 0.12, { type: "triangle", gain: 0.14, slide: 1.6 }); },
  /** form problem */
  buzz() { tone(150, 0, 0.22, { type: "sawtooth", gain: 0.07 }); tone(142, 0.02, 0.2, { type: "square", gain: 0.04 }); },
  /** water */
  splash() { noise(0, 0.45, 0.14, 1200); },
  pour() { noise(0, 0.7, 0.06, 500); },
  /** set complete / level up */
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.4, { type: "triangle", gain: 0.13 })); },
  tick() { tone(1200, 0, 0.06, { type: "square", gain: 0.05 }); },
};
