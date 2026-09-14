// WebAudio 합성 효과음 (외부 파일 없음)
let ctx = null;
let muted = false;
try {
  muted = localStorage.getItem('kuorido3d.muted') === '1';
} catch {
  /* 무시 */
}

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try {
    localStorage.setItem('kuorido3d.muted', m ? '1' : '0');
  } catch {
    /* 무시 */
  }
}

function noiseBuffer(a, dur) {
  const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  return buf;
}

// 나무 두드리는 소리
function knock({ freq = 420, q = 6, gain = 0.6, body = 160, dur = 0.18 } = {}) {
  if (muted) return;
  const a = ac();
  const t = a.currentTime;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a, dur);
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(bp).connect(g).connect(a.destination);
  src.start(t);

  const osc = a.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(body, t);
  osc.frequency.exponentialRampToValueAtTime(body * 0.55, t + 0.12);
  const og = a.createGain();
  og.gain.setValueAtTime(gain * 0.7, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  osc.connect(og).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.16);
}

function tone(freq, start, dur, { type = 'triangle', gain = 0.18 } = {}) {
  const a = ac();
  const t = a.currentTime + start;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  unlock: () => ac(),
  pawn: () => knock({ freq: 900, q: 3, gain: 0.45, body: 220, dur: 0.12 }),
  wall: () => knock({ freq: 520, q: 4, gain: 0.8, body: 130, dur: 0.22 }),
  click: () => knock({ freq: 1800, q: 8, gain: 0.18, body: 600, dur: 0.05 }),
  error: () => {
    if (muted) return;
    tone(220, 0, 0.12, { type: 'square', gain: 0.06 });
    tone(165, 0.1, 0.18, { type: 'square', gain: 0.06 });
  },
  turn: () => {
    if (muted) return;
    tone(660, 0, 0.18, { gain: 0.07 });
    tone(990, 0.08, 0.25, { gain: 0.05 });
  },
  win: () => {
    if (muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => tone(f, i * 0.12, 0.5, { gain: 0.14 }));
    tone(261.63, 0, 1.4, { type: 'sine', gain: 0.12 });
  },
};
