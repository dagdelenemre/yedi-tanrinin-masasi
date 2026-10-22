// Küçük sentezlenmiş ses efektleri (harici dosya yok)

let ctx: AudioContext | null = null;
let muted = false;
try {
  muted = localStorage.getItem('ytm-muted') === '1';
} catch {}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem('ytm-muted', m ? '1' : '0');
  } catch {}
  if (m) stopAmbient(true);
  else if (ambBase) startAmbient(ambBase);
}

// ---------------------------------------------------------------------------
// Ortam sesi: alçak, yavaş nefes alan bir uğultu
// ---------------------------------------------------------------------------
let amb: { stop: () => void } | null = null;
let ambBase = 0;

export function startAmbient(base: number) {
  ambBase = base;
  stopAmbient(true);
  const c = ac();
  if (!c) return;
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, c.currentTime);
  out.gain.exponentialRampToValueAtTime(0.05, c.currentTime + 3);
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.value = 500;
  filt.Q.value = 2;
  const lfo = c.createOscillator();
  const lfoG = c.createGain();
  lfo.frequency.value = 0.07;
  lfoG.gain.value = 260;
  lfo.connect(lfoG).connect(filt.frequency);
  const oscs = [base, base * 1.5, base * 2.003, base * 0.5].map((f, i) => {
    const o = c.createOscillator();
    o.type = i % 2 ? 'triangle' : 'sawtooth';
    o.frequency.value = f;
    o.detune.value = (i - 1.5) * 6;
    const g = c.createGain();
    g.gain.value = [0.5, 0.25, 0.12, 0.6][i];
    o.connect(g).connect(filt);
    o.start();
    return o;
  });
  filt.connect(out).connect(c.destination);
  lfo.start();
  amb = {
    stop: () => {
      const t = c.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      setTimeout(() => {
        oscs.forEach((o) => o.stop());
        lfo.stop();
      }, 1300);
    },
  };
}

export function stopAmbient(keepBase = false) {
  amb?.stop();
  amb = null;
  if (!keepBase) ambBase = 0;
}

function noise(c: AudioContext, dur: number) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  return src;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, delay = 0, slideTo?: number) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function burst(dur: number, freq: number, q = 1, vol = 0.25, type: BiquadFilterType = 'bandpass', delay = 0) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + delay;
  const n = noise(c, dur);
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = vol;
  n.connect(f).connect(g).connect(c.destination);
  n.start(t);
}

export const sfx = {
  card() {
    burst(0.09, 3200, 0.8, 0.35);
  },
  flip() {
    burst(0.06, 4500, 1.2, 0.28);
    burst(0.05, 2000, 1, 0.12, 'bandpass', 0.03);
  },
  chip() {
    tone(2600, 0.05, 'triangle', 0.08);
    tone(3400, 0.04, 'triangle', 0.06, 0.035);
  },
  chips() {
    for (let i = 0; i < 5; i++) tone(2400 + Math.random() * 1400, 0.05, 'triangle', 0.06, i * 0.045);
  },
  dice() {
    for (let i = 0; i < 7; i++) burst(0.04, 900 + Math.random() * 800, 3, 0.3, 'bandpass', i * 0.07 + Math.random() * 0.03);
  },
  click() {
    tone(900, 0.04, 'square', 0.03);
  },
  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'triangle', 0.12, i * 0.09));
  },
  bigWin() {
    [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.5, 'triangle', 0.12, i * 0.11));
  },
  lose() {
    [440, 392, 330, 262].forEach((f, i) => tone(f, 0.38, 'sine', 0.1, i * 0.12));
  },
  magic() {
    for (let i = 0; i < 8; i++) tone(800 + i * 180, 0.25, 'sine', 0.05, i * 0.04);
    tone(400, 0.6, 'sine', 0.05, 0, 1600);
  },
  burn() {
    burst(0.6, 600, 0.6, 0.35, 'lowpass');
    tone(200, 0.5, 'sawtooth', 0.03, 0, 60);
  },
  steal() {
    tone(300, 0.25, 'square', 0.05, 0, 900);
    this.chips();
  },
  alert() {
    tone(660, 0.12, 'triangle', 0.08);
    tone(880, 0.16, 'triangle', 0.08, 0.1);
  },
};
