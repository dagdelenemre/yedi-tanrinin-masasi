import { GodId } from '../engine/gods';

// ---------------------------------------------------------------------------
// Tanrıların mekânları (1280x720) + ortam parçacıkları
// ---------------------------------------------------------------------------

const W = 1280;
const H = 720;

function svg(inner: string, defs = '') {
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" class="scene-svg" xmlns="http://www.w3.org/2000/svg"><defs>${defs}</defs>${inner}</svg>`;
}

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function nadir() {
  const pillar = (x: number, h: number) => `
    <g transform="translate(${x} 0)">
      <rect x="-34" y="0" width="68" height="${h}" fill="url(#nP)"/>
      ${[...Array(5)].map((_, i) => `<rect x="${-30 + i * 14}" y="0" width="4" height="${h}" fill="#000" opacity=".18"/>`).join('')}
      <path d="M-52 ${h} L52 ${h} L44 ${h + 20} L-44 ${h + 20}Z" fill="#3a1d5c"/>
      <path d="M-44 ${h + 20} Q0 ${h + 44} 44 ${h + 20}" fill="#2a1442"/>
      <rect x="-56" y="${h - 6}" width="112" height="8" fill="#d4af6a" opacity=".5"/>
    </g>`;
  return svg(`
    <rect width="${W}" height="${H}" fill="url(#nBg)"/>
    <ellipse cx="640" cy="250" rx="420" ry="300" fill="#7b4cc0" opacity=".25" filter="url(#nBlur)"/>
    <g opacity=".85">${pillar(150, 300)}${pillar(380, 220)}${pillar(900, 220)}${pillar(1130, 300)}</g>
    <g transform="translate(640 120)" opacity=".35">
      <path d="M-120 -40 L120 -40 L120 -10 L-120 -10Z M-120 -10 L-96 70 L-60 -10 L-30 90 L0 -10 L30 90 L60 -10 L96 70 L120 -10Z" fill="url(#nG)"/>
    </g>
    ${[260, 1020].map((x) => `<g transform="translate(${x} 0)"><line x1="0" y1="0" x2="0" y2="90" stroke="#d4af6a" stroke-width="2" opacity=".6"/>
      <path d="M-46 90 L46 90 L30 130 L-30 130Z" fill="#3a1d5c" stroke="#d4af6a" stroke-width="2"/>
      ${[-36, -12, 12, 36].map((dx) => `<g class="flicker"><rect x="${dx - 3}" y="62" width="6" height="28" fill="#f4eef6"/><ellipse cx="${dx}" cy="56" rx="5" ry="9" fill="#ffd27a"/><circle cx="${dx}" cy="56" r="18" fill="#ffb347" opacity=".25"/></g>`).join('')}</g>`).join('')}
    <path d="M0 0 Q120 220 60 520 L0 520Z M${W} 0 Q${W - 120} 220 ${W - 60} 520 L${W} 520Z" fill="#2a0f45"/>
    <path d="M0 0 Q140 200 90 520 M${W} 0 Q${W - 140} 200 ${W - 90} 520" stroke="#d4af6a" stroke-width="2" fill="none" opacity=".4"/>
    <rect y="460" width="${W}" height="260" fill="url(#floor)"/>`,
    `<linearGradient id="nBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0a2e"/><stop offset=".6" stop-color="#2b1250"/><stop offset="1" stop-color="#0c0516"/></linearGradient>
     <linearGradient id="nP" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#231038"/><stop offset=".5" stop-color="#4a2672"/><stop offset="1" stop-color="#1a0a2e"/></linearGradient>
     <linearGradient id="nG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset="1" stop-color="#8a5d16"/></linearGradient>
     <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".8"/></linearGradient>
     <filter id="nBlur"><feGaussianBlur stdDeviation="40"/></filter>`);
}

function kesh() {
  const r = rng(7);
  const stripes = [...Array(16)].map((_, i) => {
    const x = -200 + i * 110;
    return `<path d="M640 -40 L${x} 520 L${x + 110} 520Z" fill="${i % 2 ? '#0f4743' : '#6b4d18'}" opacity=".9"/>`;
  }).join('');
  const lantern = (x: number, y: number, s: number) => `<g class="sway" style="transform-origin:${x}px 0px;animation-delay:${(x % 7) * 0.3}s">
    <line x1="${x}" y1="0" x2="${x}" y2="${y - 20 * s}" stroke="#d4af6a" stroke-width="1.5" opacity=".7"/>
    <circle cx="${x}" cy="${y}" r="${60 * s}" fill="#ffb347" opacity=".18"/>
    <path d="M${x - 14 * s} ${y - 18 * s} Q${x} ${y - 30 * s} ${x + 14 * s} ${y - 18 * s} L${x + 18 * s} ${y + 14 * s} Q${x} ${y + 26 * s} ${x - 18 * s} ${y + 14 * s}Z" fill="#e8892f"/>
    <path d="M${x - 14 * s} ${y - 18 * s} L${x + 14 * s} ${y - 18 * s} M${x - 17 * s} ${y + 4 * s} L${x + 17 * s} ${y + 4 * s}" stroke="#6a3a10" stroke-width="${2 * s}"/>
    <ellipse class="flicker" cx="${x}" cy="${y}" rx="${7 * s}" ry="${10 * s}" fill="#fff1b8"/></g>`;
  return svg(`
    <rect width="${W}" height="${H}" fill="#0b1a19"/>
    <g opacity=".55">${stripes}</g>
    <rect width="${W}" height="${H}" fill="url(#kV)"/>
    ${lantern(180, 150, 1.2)}${lantern(360, 90, .8)}${lantern(930, 100, .9)}${lantern(1110, 170, 1.3)}${lantern(640, 40, .7)}
    ${[...Array(30)].map(() => `<ellipse cx="${r() * W}" cy="${470 + r() * 60}" rx="${10 + r() * 8}" ry="4" fill="#d4af6a" opacity="${0.2 + r() * 0.3}"/>`).join('')}
    <path d="M0 520 Q160 440 320 500 L320 720 L0 720Z M${W} 520 Q${W - 160} 440 ${W - 320} 500 L${W - 320} 720 L${W} 720Z" fill="#1a1006" opacity=".8"/>`,
    `<radialGradient id="kV" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#ffb347" stop-opacity=".18"/><stop offset=".6" stop-color="#000" stop-opacity=".2"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>`);
}

function veyla() {
  const mirror = (x: number, w: number, h: number, y: number) => `
    <g transform="translate(${x} ${y})">
      <path d="M${-w / 2} ${h} L${-w / 2} ${w / 2} Q${-w / 2} 0 0 0 Q${w / 2} 0 ${w / 2} ${w / 2} L${w / 2} ${h}Z" fill="url(#vM)" stroke="#c7d6e6" stroke-width="5"/>
      <path d="M${-w / 2 + 14} ${h} L${-w / 2 + 14} ${w / 2} Q${-w / 2 + 14} 14 0 14 Q${w / 2 - 14} 14 ${w / 2 - 14} ${w / 2} L${w / 2 - 14} ${h}Z" fill="none" stroke="#8ea6c0" stroke-width="1.5"/>
      <path class="shine" d="M${-w / 4} ${h} L${-w / 8} ${w / 3} L${w / 16} ${w / 3} L${-w / 16} ${h}Z" fill="#fff" opacity=".12"/>
    </g>`;
  return svg(`
    <rect width="${W}" height="${H}" fill="url(#vBg)"/>
    <path d="M640 -20 L520 720 L760 720Z" fill="#e8f0f8" opacity=".06"/>
    ${mirror(120, 170, 520, 60)}${mirror(330, 150, 420, 110)}${mirror(950, 150, 420, 110)}${mirror(1160, 170, 520, 60)}
    <circle cx="640" cy="90" r="46" fill="#e8f0f8" opacity=".85"/><circle cx="656" cy="80" r="44" fill="#13213b"/>
    <rect y="420" width="${W}" height="300" fill="url(#vMist)"/>`,
    `<linearGradient id="vBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1426"/><stop offset=".6" stop-color="#13213b"/><stop offset="1" stop-color="#05080f"/></linearGradient>
     <linearGradient id="vM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2c4a74"/><stop offset=".5" stop-color="#5a7fa8" stop-opacity=".7"/><stop offset="1" stop-color="#1b2c4a"/></linearGradient>
     <linearGradient id="vMist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c7d6e6" stop-opacity="0"/><stop offset=".5" stop-color="#c7d6e6" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".8"/></linearGradient>`);
}

function kronvel() {
  const ticks = [...Array(60)].map((_, i) => {
    const a = (i * Math.PI) / 30;
    const r1 = i % 5 === 0 ? 250 : 264;
    return `<line x1="${640 + r1 * Math.cos(a)}" y1="${250 + r1 * Math.sin(a)}" x2="${640 + 275 * Math.cos(a)}" y2="${250 + 275 * Math.sin(a)}" stroke="#d9b56c" stroke-width="${i % 5 === 0 ? 6 : 2}"/>`;
  }).join('');
  const nums = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].map((n, i) => {
    const a = (i * Math.PI) / 6 - Math.PI / 2;
    return `<text x="${640 + 222 * Math.cos(a)}" y="${258 + 222 * Math.sin(a)}" font-family="Cinzel, serif" font-size="30" fill="#d9b56c" text-anchor="middle">${n}</text>`;
  }).join('');
  const gear = (x: number, y: number, r: number, cls: string) => {
    const teeth = [...Array(16)].map((_, i) => `<rect x="${-r * 0.12}" y="${-r - r * 0.18}" width="${r * 0.24}" height="${r * 0.3}" transform="rotate(${i * 22.5})" fill="#3a2810"/>`).join('');
    return `<g transform="translate(${x} ${y})"><g class="${cls}">${teeth}<circle r="${r}" fill="#3a2810"/><circle r="${r * 0.35}" fill="#1a1006"/></g></g>`;
  };
  return svg(`
    <rect width="${W}" height="${H}" fill="url(#kBg)"/>
    ${gear(120, 180, 120, 'spin-slow')}${gear(1170, 260, 150, 'spin-rev')}${gear(260, 520, 80, 'spin-rev')}${gear(1020, 560, 90, 'spin-slow')}
    <g opacity=".75">
      <circle cx="640" cy="250" r="290" fill="#1f1508" stroke="#8a6a3c" stroke-width="10"/>
      <circle cx="640" cy="250" r="280" fill="url(#kFace)"/>
      ${ticks}${nums}
      <g class="clock-h" style="transform-origin:640px 250px"><path d="M634 250 L640 120 L646 250Z" fill="#d9b56c"/></g>
      <g class="clock-m" style="transform-origin:640px 250px"><path d="M637 250 L640 40 L643 250Z" fill="#f0d9a6"/></g>
    </g>
    <rect width="${W}" height="${H}" fill="url(#kV2)"/>`,
    `<linearGradient id="kBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1a08"/><stop offset="1" stop-color="#0a0603"/></linearGradient>
     <radialGradient id="kFace" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#5a4020"/><stop offset="1" stop-color="#1f1508"/></radialGradient>
     <radialGradient id="kV2" cx="50%" cy="35%" r="75%"><stop offset=".4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></radialGradient>`);
}

function oris() {
  const r = rng(3);
  const stars = [...Array(160)].map(() => `<circle cx="${r() * W}" cy="${r() * 520}" r="${0.6 + r() * 1.6}" fill="#e6fdff" opacity="${0.3 + r() * 0.7}"/>`).join('');
  const constel = (pts: number[][]) => `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#5ee6ff" stroke-width="1" opacity=".35"/>${pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#bff6ff"/>`).join('')}`;
  return svg(`
    <rect width="${W}" height="${H}" fill="url(#oBg)"/>
    ${stars}
    ${constel([[140, 120], [210, 90], [260, 150], [330, 130], [380, 200]])}
    ${constel([[920, 80], [980, 140], [1060, 120], [1120, 190], [1080, 250]])}
    <g transform="translate(1040 300)" opacity=".8"><circle r="80" fill="url(#oPl)"/><ellipse rx="140" ry="22" fill="none" stroke="#9fe9ff" stroke-width="3" opacity=".5" transform="rotate(-18)"/></g>
    <circle cx="200" cy="330" r="34" fill="#c7d6e6" opacity=".25"/>
    <path d="M0 720 L0 380 Q640 -40 1280 380 L1280 720Z" fill="none" stroke="#1c3f7a" stroke-width="6" opacity=".6"/>
    ${[...Array(9)].map((_, i) => `<line x1="${640 + 760 * Math.cos(Math.PI + (i * Math.PI) / 8)}" y1="${720 + 640 * Math.sin(Math.PI + (i * Math.PI) / 8)}" x2="640" y2="720" stroke="#1c3f7a" stroke-width="2" opacity=".3"/>`).join('')}
    <rect y="460" width="${W}" height="260" fill="url(#oFloor)"/>`,
    `<radialGradient id="oBg" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#16306a"/><stop offset=".6" stop-color="#081633"/><stop offset="1" stop-color="#02050f"/></radialGradient>
     <radialGradient id="oPl" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#5ee6ff"/><stop offset="1" stop-color="#0d2550"/></radialGradient>
     <linearGradient id="oFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></linearGradient>`);
}

function barbaz() {
  const r = rng(11);
  const rocks = (y0: number, flip: boolean) => {
    let d = `M0 ${y0}`;
    for (let x = 0; x <= W; x += 40) d += ` L${x} ${y0 + (flip ? -1 : 1) * (r() * 90)}`;
    d += flip ? ` L${W} 0 L0 0Z` : ` L${W} ${H} L0 ${H}Z`;
    return d;
  };
  const die = (x: number, y: number, s: number, rot: number) => `<g class="float-die" style="animation-delay:${(x % 5) * 0.4}s"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.18}" fill="#2a0c05" stroke="#ff6a2e" stroke-width="2" transform="rotate(${rot} ${x + s / 2} ${y + s / 2})" opacity=".8"/></g>`;
  return svg(`
    <rect width="${W}" height="${H}" fill="url(#bBg)"/>
    <ellipse cx="640" cy="720" rx="800" ry="260" fill="#ff4a1a" opacity=".35" filter="url(#bBlur)"/>
    <path d="${rocks(110, true)}" fill="#1a0603"/>
    <path d="M0 200 L90 120 L160 260 L230 160 L300 330 L0 380Z M${W} 200 L${W - 90} 120 L${W - 160} 260 L${W - 230} 160 L${W - 300} 330 L${W} 380Z" fill="#240804"/>
    ${die(140, 240, 60, 20)}${die(1060, 200, 70, -16)}${die(980, 60, 40, 30)}${die(240, 70, 36, -24)}
    <path d="M0 470 Q200 430 360 480 Q520 420 640 470 Q800 420 940 480 Q1100 430 1280 470 L1280 720 L0 720Z" fill="#1a0603"/>
    <path d="M0 470 Q200 430 360 480 Q520 420 640 470 Q800 420 940 480 Q1100 430 1280 470" stroke="#ff6a2e" stroke-width="3" fill="none" opacity=".7" class="lava"/>`,
    `<radialGradient id="bBg" cx="50%" cy="60%" r="80%"><stop offset="0" stop-color="#5a160b"/><stop offset=".7" stop-color="#2a0603"/><stop offset="1" stop-color="#0a0201"/></radialGradient>
     <filter id="bBlur"><feGaussianBlur stdDeviation="50"/></filter>`);
}

function prisma() {
  const r = rng(5);
  const crystal = (x: number, y: number, h: number, w: number, rot: number, c: string) => `<g transform="translate(${x} ${y}) rotate(${rot})"><polygon points="0,${-h} ${w},${-h * 0.75} ${w},0 0,${h * 0.15} ${-w},0 ${-w},${-h * 0.75}" fill="${c}" opacity=".75"/><polygon points="0,${-h} ${w},${-h * 0.75} 0,${-h * 0.6}" fill="#fff" opacity=".35"/></g>`;
  const cols = ['#e46fc2', '#8ff7e0', '#7d6bff', '#ffb3e6', '#5cf0ff'];
  return svg(`
    <rect width="${W}" height="${H}" fill="url(#pBg)"/>
    <g class="beams" opacity=".25">${cols.map((c, i) => `<path d="M640 -60 L${100 + i * 260} 720 L${200 + i * 260} 720Z" fill="${c}"/>`).join('')}</g>
    ${[...Array(14)].map((_, i) => crystal(r() < .5 ? r() * 320 : W - r() * 320, 300 + r() * 280, 120 + r() * 220, 24 + r() * 30, -20 + r() * 40, cols[i % 5])).join('')}
    ${[...Array(8)].map((_, i) => crystal(r() * W, -20, -(80 + r() * 120), 18 + r() * 20, 180 - 20 + r() * 40, cols[(i + 2) % 5])).join('')}
    <rect y="460" width="${W}" height="260" fill="url(#pFloor)"/>`,
    `<radialGradient id="pBg" cx="50%" cy="35%" r="80%"><stop offset="0" stop-color="#4a1a4a"/><stop offset=".6" stop-color="#1e0a26"/><stop offset="1" stop-color="#07030c"/></radialGradient>
     <linearGradient id="pFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".85"/></linearGradient>`);
}

/** Tapınak (menüler için) */
export function templeScene(): string {
  const col = (x: number) => `<g transform="translate(${x} 0)">
    <rect x="-38" y="60" width="76" height="560" fill="url(#tP)"/>
    ${[...Array(6)].map((_, i) => `<rect x="${-34 + i * 13}" y="60" width="3" height="560" fill="#000" opacity=".22"/>`).join('')}
    <rect x="-50" y="40" width="100" height="22" fill="#2a2016"/><rect x="-50" y="610" width="100" height="24" fill="#2a2016"/></g>`;
  const brazier = (x: number) => `<g transform="translate(${x} 560)"><circle cy="-40" r="90" fill="#ff9a3c" opacity=".14"/><path d="M-30 0 L30 0 L20 30 L-20 30Z" fill="#2a2016" stroke="#d4af6a" stroke-width="1.5"/>
    <path class="fl" d="M-18 0 Q-22 -40 0 -70 Q22 -40 18 0Z" fill="#ff8a2e"/><path class="fl" style="animation-delay:.3s" d="M-9 0 Q-10 -26 0 -46 Q10 -26 9 0Z" fill="#ffe08a"/></g>`;
  return svg(`
    <rect width="${W}" height="${H}" fill="url(#tBg)"/>
    <path d="M440 720 L440 300 Q640 120 840 300 L840 720Z" fill="#000" opacity=".35"/>
    <path d="M440 720 L440 300 Q640 120 840 300 L840 720" fill="none" stroke="#d4af6a" stroke-width="2" opacity=".3"/>
    ${col(110)}${col(300)}${col(980)}${col(1170)}
    ${brazier(205)}${brazier(1075)}
    <rect y="0" width="${W}" height="70" fill="#120d08"/><rect y="64" width="${W}" height="4" fill="#d4af6a" opacity=".35"/>
    <rect y="560" width="${W}" height="160" fill="url(#tFloor)"/>`,
    `<linearGradient id="tBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a130c"/><stop offset=".55" stop-color="#2a1d12"/><stop offset="1" stop-color="#080503"/></linearGradient>
     <linearGradient id="tP" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a130c"/><stop offset=".5" stop-color="#4a3a28"/><stop offset="1" stop-color="#14100a"/></linearGradient>
     <linearGradient id="tFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".9"/></linearGradient>`);
}

const SCENES: Record<GodId, () => string> = { nadir, kesh, veyla, kronvel, oris, barbaz, prisma };

export function godScene(id: GodId): string {
  return SCENES[id]();
}

// ---------------------------------------------------------------------------
// Parçacıklar
// ---------------------------------------------------------------------------
export type ParticleTheme = 'dust' | 'coins' | 'mist' | 'sand' | 'stars' | 'embers' | 'sparkles' | 'ash';

export const GOD_PARTICLES: Record<GodId, ParticleTheme> = {
  nadir: 'dust',
  kesh: 'coins',
  veyla: 'mist',
  kronvel: 'sand',
  oris: 'stars',
  barbaz: 'embers',
  prisma: 'sparkles',
};

interface P { x: number; y: number; vx: number; vy: number; r: number; a: number; life: number; max: number; hue: number }

export class Particles {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private ps: P[] = [];
  private raf = 0;
  private last = 0;
  constructor(private theme: ParticleTheme, count = 70) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.className = 'particles';
    this.ctx = this.canvas.getContext('2d')!;
    for (let i = 0; i < count; i++) this.ps.push(this.spawn(true));
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  private spawn(initial = false): P {
    const t = this.theme;
    const p: P = { x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, r: 1.5, a: 1, life: 0, max: 6 + Math.random() * 8, hue: Math.random() * 360 };
    if (t === 'embers') { p.y = initial ? Math.random() * H : H + 10; p.vx = (Math.random() - 0.5) * 20; p.vy = -30 - Math.random() * 60; p.r = 1 + Math.random() * 2.2; }
    else if (t === 'sand') { p.y = initial ? Math.random() * H : -10; p.vx = 6 + Math.random() * 10; p.vy = 18 + Math.random() * 22; p.r = 0.8 + Math.random() * 1.4; }
    else if (t === 'coins') { p.vy = 4 + Math.random() * 8; p.vx = (Math.random() - 0.5) * 4; p.r = 1 + Math.random() * 2; }
    else if (t === 'stars') { p.vx = (Math.random() - 0.5) * 3; p.vy = (Math.random() - 0.5) * 3; p.r = 0.6 + Math.random() * 1.6; p.max = 3 + Math.random() * 5; }
    else if (t === 'mist') { p.vx = 4 + Math.random() * 8; p.vy = -2 - Math.random() * 4; p.r = 1 + Math.random() * 2; }
    else if (t === 'sparkles') { p.vx = (Math.random() - 0.5) * 8; p.vy = -4 - Math.random() * 8; p.r = 1 + Math.random() * 2.2; p.max = 3 + Math.random() * 4; }
    else { p.vx = (Math.random() - 0.5) * 6; p.vy = -4 - Math.random() * 8; p.r = 0.8 + Math.random() * 1.8; }
    if (!initial) p.life = 0;
    else p.life = Math.random() * p.max;
    return p;
  }

  private loop(t: number) {
    const dt = Math.min(0.05, (t - (this.last || t)) / 1000);
    this.last = t;
    const c = this.ctx;
    c.clearRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.ps.length; i++) {
      const p = this.ps[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (this.theme === 'embers') p.vx += (Math.random() - 0.5) * 40 * dt;
      const k = p.life / p.max;
      if (k >= 1 || p.y < -20 || p.y > H + 20 || p.x < -20 || p.x > W + 20) {
        this.ps[i] = this.spawn();
        continue;
      }
      const fade = Math.sin(Math.PI * k);
      let col: string;
      switch (this.theme) {
        case 'embers': col = `rgba(255,${120 + Math.floor(100 * (1 - k))},40,${0.9 * fade})`; break;
        case 'sand': col = `rgba(240,210,150,${0.6 * fade})`; break;
        case 'coins': col = `rgba(255,215,120,${(0.4 + 0.6 * Math.abs(Math.sin(p.life * 3))) * fade})`; break;
        case 'stars': col = `rgba(190,245,255,${(0.3 + 0.7 * Math.abs(Math.sin(p.life * 2))) * fade})`; break;
        case 'mist': col = `rgba(220,232,248,${0.5 * fade})`; break;
        case 'sparkles': col = `hsla(${(p.hue + p.life * 60) % 360},90%,75%,${fade})`; break;
        default: col = `rgba(230,200,255,${0.55 * fade})`;
      }
      c.fillStyle = col;
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fill();
      if (this.theme === 'embers' || this.theme === 'sparkles' || this.theme === 'coins') {
        c.fillStyle = col.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.25})`);
        c.beginPath();
        c.arc(p.x, p.y, p.r * 3.5, 0, Math.PI * 2);
        c.fill();
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.remove();
  }
}
