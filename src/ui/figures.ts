import { GodId } from '../engine/gods';

// ---------------------------------------------------------------------------
// Masada oturan tanrı figürleri. viewBox 600x560; masanın kenarı y=372.
// Her figür iki katmandır: gövde (masanın arkasında) ve kollar/eller (masanın üstünde).
// Ruh hali: .mood-neutral / .mood-smug / .mood-angry / .mood-think (CSS ile seçilir)
// ---------------------------------------------------------------------------

export type Mood = 'neutral' | 'smug' | 'angry' | 'think';

let uidc = 0;
const U = () => `f${++uidc}`;

interface FaceOpts {
  skin: string;
  shade: string;
  iris: string;
  ink: string; // kaş/çizgi rengi
  lip: string;
  cx?: number;
  eyeY?: number;
  eyeDX?: number;
  eyeW?: number;
  eyeH?: number;
  mouthY?: number;
  browW?: number;
  noEyes?: boolean;
}

function eyes(o: FaceOpts): string {
  const cx = o.cx ?? 300;
  const y = o.eyeY ?? 160;
  const dx = o.eyeDX ?? 25;
  const w = o.eyeW ?? 13;
  const hh = o.eyeH ?? 8;
  const one = (x: number) => `
    <ellipse cx="${x}" cy="${y}" rx="${w}" ry="${hh}" fill="#f3ede2"/>
    <g class="pupils"><circle cx="${x}" cy="${y}" r="${hh * 0.85}" fill="${o.iris}"/><circle cx="${x}" cy="${y}" r="${hh * 0.42}" fill="#0c0a10"/><circle cx="${x - 2}" cy="${y - 2.5}" r="${hh * 0.22}" fill="#fff" opacity=".9"/></g>
    <path class="halflid" d="M${x - w - 1} ${y} Q${x} ${y - hh * 1.6} ${x + w + 1} ${y} L${x + w + 1} ${y - hh - 2} L${x - w - 1} ${y - hh - 2}Z" fill="${o.skin}"/>
    <ellipse class="lid" cx="${x}" cy="${y}" rx="${w + 1.5}" ry="${hh + 1.5}" fill="${o.skin}"/>
    <path d="M${x - w - 1} ${y} Q${x} ${y - hh * 1.5} ${x + w + 1} ${y}" stroke="${o.ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  return `<g class="eyes">${one(cx - dx)}${one(cx + dx)}</g>`;
}

function moods(o: FaceOpts, custom: Partial<Record<Mood, string>> = {}): string {
  const cx = o.cx ?? 300;
  const ey = o.eyeY ?? 160;
  const dx = o.eyeDX ?? 25;
  const by = ey - 17;
  const bw = o.browW ?? 15;
  const my = o.mouthY ?? 214;
  const ink = o.ink;
  const brow = (x: number, tiltIn: number, lift = 0) =>
    `<path d="M${x - bw} ${by + (x < cx ? -tiltIn : tiltIn) * 0 + lift} Q${x} ${by - 6 + lift} ${x + bw} ${by + lift}" transform="rotate(${x < cx ? tiltIn : -tiltIn} ${x} ${by})" stroke="${ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  const lip = o.lip;
  const def: Record<Mood, string> = {
    neutral: `${brow(cx - dx, 0)}${brow(cx + dx, 0)}<path d="M${cx - 17} ${my} Q${cx} ${my + 3} ${cx + 17} ${my}" stroke="${lip}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    smug: `${brow(cx - dx, -4, 1)}${brow(cx + dx, 10, -5)}<path d="M${cx - 20} ${my - 1} Q${cx - 2} ${my + 9} ${cx + 22} ${my - 8}" stroke="${lip}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    angry: `${brow(cx - dx, 16, 4)}${brow(cx + dx, 16, 4)}<path d="M${cx - 18} ${my + 5} Q${cx} ${my - 5} ${cx + 18} ${my + 5}" stroke="${lip}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
    think: `${brow(cx - dx, -6, -4)}${brow(cx + dx, 8, 2)}<path d="M${cx - 8} ${my + 2} Q${cx + 2} ${my - 1} ${cx + 13} ${my + 3}" stroke="${lip}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  };
  return (Object.keys(def) as Mood[]).map((m) => `<g class="mood mood-${m}">${custom[m] ?? def[m]}</g>`).join('');
}

/** Masaya dayanmış el (yukarıdan, karşıdan görünüm) */
function hand(x: number, y: number, skin: string, shade: string, mirror = false, extra = ''): string {
  return `<g transform="translate(${x} ${y}) scale(${mirror ? -1 : 1} 1)">
    <path d="M-30 -20 C-30 -34 22 -36 30 -18 L34 8 C35 20 29 26 23 25 C21 32 12 33 10 26 C8 34 -1 34 -3 26 C-5 33 -14 33 -15 25 C-24 27 -31 20 -32 9 Z" fill="${skin}"/>
    <path d="M-30 -20 C-30 -34 22 -36 30 -18 L34 8 C35 20 29 26 23 25" fill="none" stroke="${shade}" stroke-width="2" opacity=".5"/>
    <path d="M10 6 L10 24 M-3 6 L-3 25 M-15 6 L-15 23" stroke="${shade}" stroke-width="1.6" opacity=".7"/>
    <path d="M28 -12 C44 -10 46 6 36 12" fill="${skin}" stroke="${shade}" stroke-width="1.5"/>
    ${extra}
  </g>`;
}

/** Dirsekten bileğe kol (kumaş) */
function forearm(side: 'l' | 'r', fill: string, trim: string, cuffY = 0): string {
  const l = side === 'l';
  const pts = l
    ? 'M88 372 L170 372 L248 412 L196 442 Z'
    : 'M512 372 L430 372 L352 412 L404 442 Z';
  const cuff = l ? `M232 404 L190 436` : `M368 404 L410 436`;
  return `<path d="${pts}" fill="${fill}"/><path d="${pts}" fill="url(#armShade)" opacity=".55"/><path d="${cuff}" stroke="${trim}" stroke-width="9" stroke-linecap="round" transform="translate(0 ${cuffY})"/>`;
}

const COMMON_DEFS = `
  <linearGradient id="armShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
  <radialGradient id="faceShade" cx="45%" cy="35%" r="70%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
  <linearGradient id="goldG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".45" stop-color="#e2b955"/><stop offset="1" stop-color="#8a5d16"/></linearGradient>
  <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="bigGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="14"/></filter>`;

function wrap(body: string, defs = ''): string {
  return `<svg viewBox="0 0 600 560" class="fig-svg" xmlns="http://www.w3.org/2000/svg"><defs>${COMMON_DEFS}${defs}</defs>${body}</svg>`;
}

/** Kafa: oval + gölge + ruh hali */
function head(o: FaceOpts, shapeExtra = '', faceExtra = '', custom: Partial<Record<Mood, string>> = {}) {
  return `<g class="head">
    ${shapeExtra}
    <ellipse cx="300" cy="168" rx="60" ry="72" fill="${o.skin}"/>
    <ellipse cx="300" cy="168" rx="60" ry="72" fill="url(#faceShade)"/>
    ${o.noEyes ? '' : eyes(o)}
    <path d="M300 172 L294 196 Q300 201 307 196" stroke="${o.shade}" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    ${moods(o, custom)}
    ${faceExtra}
  </g>`;
}

function torso(fill: string, extra = '') {
  return `<path d="M84 400 C86 300 156 262 236 254 L364 254 C444 262 514 300 516 400 Z" fill="${fill}"/>
  <path d="M84 400 C86 300 156 262 236 254 L364 254 C444 262 514 300 516 400 Z" fill="#000" opacity=".12"/>
  ${extra}`;
}

function neck(skin: string, shade: string) {
  return `<path d="M266 220 L266 270 Q300 284 334 270 L334 220 Z" fill="${skin}"/><path d="M266 230 Q300 256 334 230 L334 220 L266 220Z" fill="${shade}" opacity=".55"/>`;
}

// ---------------------------------------------------------------------------
function nadir() {
  const o: FaceOpts = { skin: '#ead8f1', shade: '#a98bbd', iris: '#6b3fa0', ink: '#2a1840', lip: '#7a3a6a' };
  const ermine = [...Array(9)].map((_, i) => `<path d="M${150 + i * 37} ${292 + (i % 2) * 6} l3 8 l-3 -2 l-3 2z" fill="#1a1020"/>`).join('');
  const body = `
    <g class="breath">
      ${torso('#4a2672', `
        <path d="M200 270 L300 400 L400 270" fill="#2e1650"/>
        <path d="M110 330 C150 286 220 276 300 300 C380 276 450 286 490 330 L486 352 C440 312 380 312 300 326 C220 312 160 312 114 352Z" fill="#f4eef6"/>
        ${ermine}
        <path d="M200 270 L300 400 L400 270" fill="none" stroke="url(#goldG)" stroke-width="5"/>
        <circle cx="300" cy="356" r="13" fill="url(#goldG)"/><circle cx="300" cy="356" r="6" fill="#b0174a"/>`)}
      ${neck(o.skin, o.shade)}
      ${head(o, `<path d="M236 150 Q236 86 300 82 Q364 86 364 150 Q350 112 300 110 Q250 112 236 150Z" fill="#2a1840"/>`,
        `<path d="M284 232 Q300 252 316 232 Q300 238 284 232Z" fill="#2a1840"/>
         <polygon points="238,176 246,176 242,192" fill="url(#goldG)"/><polygon points="354,176 362,176 358,192" fill="url(#goldG)"/>`)}
      <g class="fx-float" filter="url(#softGlow)">
        <path d="M244 34 L356 34 L356 50 L244 50Z" fill="url(#goldG)"/>
        <path d="M244 50 L256 92 L272 50 L286 98 L300 50 L314 98 L328 50 L344 92 L356 50Z" fill="url(#goldG)"/>
        <circle cx="286" cy="92" r="5" fill="#d62e5c"/><circle cx="314" cy="92" r="5" fill="#2ec4d6"/><circle cx="300" cy="42" r="6" fill="#7b2fd0"/>
      </g>
    </g>`;
  const hands = `
    ${forearm('l', '#4a2672', '#f4eef6')}${forearm('r', '#4a2672', '#f4eef6')}
    ${hand(214, 446, o.skin, o.shade, false, '<circle cx="-3" cy="12" r="4" fill="url(#goldG)"/>')}
    ${hand(386, 446, o.skin, o.shade, true, '<circle cx="10" cy="12" r="4" fill="#b0174a" stroke="url(#goldG)" stroke-width="2"/>')}
    <g transform="translate(424 300) rotate(12)"><rect x="-4" y="0" width="8" height="140" fill="url(#goldG)"/><circle cx="0" cy="150" r="14" fill="#7b2fd0" stroke="url(#goldG)" stroke-width="4"/><path d="M-12 0 L12 0 L0 -18Z" fill="url(#goldG)"/></g>`;
  return { body: wrap(body), hands: wrap(hands) };
}

function kesh() {
  const o: FaceOpts = { skin: '#c98d5c', shade: '#8e5a32', iris: '#e2b955', ink: '#2b170a', lip: '#5a2a14', noEyes: true };
  const coinEye = (x: number) => `<g class="coin-eye"><circle cx="${x}" cy="160" r="13" fill="url(#goldG)" stroke="#6a4410" stroke-width="2"/><circle cx="${x}" cy="160" r="7" fill="none" stroke="#6a4410" stroke-width="1.6"/><rect class="glint" x="${x - 2}" y="146" width="4" height="28" fill="#fff" opacity=".0" transform="rotate(25 ${x} 160)"/></g>`;
  const mustache = `<path d="M262 206 Q280 194 300 204 Q320 194 338 206 Q352 214 360 204 Q356 222 334 218 Q318 214 300 212 Q282 214 266 218 Q244 222 240 204 Q248 214 262 206Z" fill="#2b170a"/>`;
  const body = `
    <g class="breath">
      ${torso('#14514d', `
        <path d="M240 270 Q300 330 360 270" fill="#c98d5c"/>
        ${[0, 1, 2].map((i) => `<path d="M${226 - i * 8} ${284 + i * 14} Q300 ${352 + i * 16} ${374 + i * 8} ${284 + i * 14}" stroke="url(#goldG)" stroke-width="${4 - i}" fill="none"/>`).join('')}
        <circle cx="300" cy="352" r="11" fill="#e63946" stroke="url(#goldG)" stroke-width="3"/>
        <path d="M120 340 L170 300 M480 340 L430 300" stroke="url(#goldG)" stroke-width="5"/>`)}
      <g class="fx-arm-l"><path d="M150 300 Q96 250 112 182" stroke="#14514d" stroke-width="34" fill="none" stroke-linecap="round"/><path d="M112 190 Q104 160 116 140" stroke="#c98d5c" stroke-width="22" fill="none" stroke-linecap="round"/>
        <g transform="translate(104 108) rotate(-16)">${[-1, 0, 1].map((k) => `<g transform="rotate(${k * 14} 0 40)"><rect x="-17" y="0" width="34" height="48" rx="3" fill="#fbf6ea" stroke="#3a2a10" stroke-width="1"/><text x="0" y="31" font-size="20" text-anchor="middle" fill="${k ? '#b51d2a' : '#1b1726'}" font-family="serif">${['♥', '♠', '♦'][k + 1]}</text></g>`).join('')}</g></g>
      <g class="fx-arm-r"><path d="M450 300 Q504 250 488 182" stroke="#14514d" stroke-width="34" fill="none" stroke-linecap="round"/><path d="M488 190 Q496 160 484 140" stroke="#c98d5c" stroke-width="22" fill="none" stroke-linecap="round"/>
        <g class="fx-coin" transform="translate(486 112)"><circle r="17" fill="url(#goldG)" stroke="#6a4410" stroke-width="2"/><text y="6" font-size="17" text-anchor="middle" fill="#6a4410" font-family="serif">✦</text></g></g>
      ${neck(o.skin, o.shade)}
      ${head(o, '', `${coinEye(275)}${coinEye(325)}${mustache}`)}
      <g>
        <path d="M232 132 Q226 64 300 58 Q374 64 368 132 Q340 114 300 116 Q260 114 232 132Z" fill="#1f7a74"/>
        <path d="M236 120 Q300 92 364 120" stroke="url(#goldG)" stroke-width="5" fill="none"/>
        <path d="M250 84 Q300 108 350 84" stroke="#155e59" stroke-width="4" fill="none"/>
        <circle cx="300" cy="96" r="11" fill="#e63946" stroke="url(#goldG)" stroke-width="4"/>
        <path class="fx-feather" d="M300 86 Q320 40 352 22 Q330 50 312 90Z" fill="#e2b955"/>
      </g>
    </g>`;
  const hands = `
    ${forearm('l', '#14514d', '#e2b955')}${forearm('r', '#14514d', '#e2b955')}
    ${hand(214, 446, o.skin, o.shade, false, '<circle cx="-14" cy="12" r="4" fill="url(#goldG)"/><circle cx="-2" cy="12" r="4" fill="url(#goldG)"/>')}
    ${hand(386, 446, o.skin, o.shade, true, '<circle cx="10" cy="12" r="4" fill="url(#goldG)"/>')}
    ${[0, 1, 2, 3].map((i) => `<ellipse cx="${150 + i * 7}" cy="${468 - i * 6}" rx="16" ry="6" fill="url(#goldG)" stroke="#6a4410"/>`).join('')}`;
  return { body: wrap(body), hands: wrap(hands) };
}

function veyla() {
  const id = U();
  const o: FaceOpts = { skin: '#cfd9e6', shade: '#8ea0b8', iris: '#5a7fa8', ink: '#2c3c58', lip: '#5a7fa8', noEyes: true, mouthY: 218 };
  const defs = `<linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".4" stop-color="#c4d3e4"/><stop offset=".7" stop-color="#8ea6c0"/><stop offset="1" stop-color="#e8f0f8"/></linearGradient>
    <clipPath id="${id}c"><ellipse cx="300" cy="168" rx="58" ry="70"/></clipPath>`;
  const body = `
    <g class="breath">
      <path class="fx-hair" d="M220 140 Q200 60 300 52 Q400 60 380 140 Q410 240 420 400 L180 400 Q190 240 220 140Z" fill="#1b2c4a"/>
      ${torso('#2c4a74', `
        <path d="M200 280 Q300 360 400 280 L410 400 L190 400Z" fill="#22385e"/>
        ${[...Array(7)].map((_, i) => `<polygon points="${210 + i * 30},${318 + (i % 2) * 18} ${222 + i * 30},${300 + (i % 2) * 18} ${232 + i * 30},${322 + (i % 2) * 18}" fill="#d9e7f5" opacity=".55"/>`).join('')}
        <path d="M150 316 Q300 268 450 316" stroke="#d9e7f5" stroke-width="2" fill="none" opacity=".6"/>`)}
      ${neck(o.skin, o.shade)}
      <g class="head">
        <ellipse cx="300" cy="168" rx="60" ry="72" fill="url(#${id}m)" stroke="#eef3f9" stroke-width="3"/>
        <g clip-path="url(#${id}c)"><g transform="rotate(22 300 168)"><rect class="fx-sweep" x="200" y="60" width="30" height="240" fill="#fff" opacity=".55"/></g>
          <text x="318" y="230" font-size="34" fill="#5a7fa8" opacity=".35" font-family="serif">♠</text></g>
        <path d="M236 148 Q300 132 364 148 L366 176 Q300 162 234 176Z" fill="#14213a"/>
        <path class="fx-ribbon" d="M364 154 Q392 168 404 210 Q388 192 366 176Z" fill="#14213a"/>
        <path class="fx-ribbon2" d="M364 162 Q384 196 384 236 Q374 206 362 178Z" fill="#1b2c4a"/>
        ${moods(o)}
        <path d="M226 112 Q244 62 300 58 Q270 76 262 112 Q250 160 246 214 Q226 170 226 112Z" fill="#22385e"/>
        <path d="M374 112 Q356 62 300 58 Q330 76 338 112 Q350 160 354 214 Q374 170 374 112Z" fill="#22385e"/>
      </g>
      <g class="fx-orbit">${[0, 1, 2, 3].map((i) => `<polygon points="0,-12 7,0 0,14 -6,0" fill="#e8f0f8" opacity=".75" transform="translate(${300 + 150 * Math.cos(i * 1.57)} ${190 + 60 * Math.sin(i * 1.57)})"/>`).join('')}</g>
    </g>`;
  const hands = `
    ${forearm('l', '#2c4a74', '#d9e7f5')}${forearm('r', '#2c4a74', '#d9e7f5')}
    ${hand(214, 446, o.skin, o.shade)}${hand(386, 446, o.skin, o.shade, true)}`;
  return { body: wrap(body, defs), hands: wrap(hands, defs) };
}

function kronvel() {
  const id = U();
  const o: FaceOpts = { skin: '#dcc3a0', shade: '#a2835b', iris: '#5c7f96', ink: '#efe9df', lip: '#8a6a3c', eyeH: 7, mouthY: 212 };
  const defs = `<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e2b0"/><stop offset="1" stop-color="#c49a4c"/></linearGradient>`;
  const beard = `<path d="M240 180 Q244 232 268 252 Q300 292 332 252 Q356 232 360 180 Q344 214 300 210 Q256 214 240 180Z" fill="#efe9df"/>
    <path class="fx-beard" d="M262 250 Q272 330 300 372 Q328 330 338 250 Q300 270 262 250Z" fill="#e6dfd2"/>
    <path d="M300 268 L300 360 M284 262 L290 340 M316 262 L310 340" stroke="#cfc6b6" stroke-width="2"/>`;
  const sad: Partial<Record<Mood, string>> = {
    neutral: `<path d="M262 138 Q275 128 290 140 M310 140 Q325 128 338 138" stroke="#f5f2ec" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M286 214 Q300 208 314 214" stroke="${o.lip}" stroke-width="3" fill="none"/>`,
    smug: `<path d="M262 134 Q275 126 290 136 M310 136 Q325 126 338 134" stroke="#f5f2ec" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M284 210 Q300 220 316 210" stroke="${o.lip}" stroke-width="3" fill="none"/>`,
    angry: `<path d="M262 132 Q276 140 292 146 M308 146 Q324 140 338 132" stroke="#f5f2ec" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M286 216 Q300 208 314 216" stroke="${o.lip}" stroke-width="3" fill="none"/>`,
    think: `<path d="M262 132 Q275 124 290 132 M310 142 Q325 136 338 140" stroke="#f5f2ec" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M290 214 Q300 211 312 215" stroke="${o.lip}" stroke-width="3" fill="none"/>`,
  };
  const body = `
    <g class="fx-rings" opacity=".55">
      <circle cx="300" cy="168" r="128" fill="none" stroke="#f0d9a6" stroke-width="2" stroke-dasharray="4 10"/>
      <circle cx="300" cy="168" r="112" fill="none" stroke="#f0d9a6" stroke-width="1"/>
      ${[...Array(12)].map((_, i) => { const a = (i * Math.PI) / 6; return `<line x1="${300 + 116 * Math.cos(a)}" y1="${168 + 116 * Math.sin(a)}" x2="${300 + 128 * Math.cos(a)}" y2="${168 + 128 * Math.sin(a)}" stroke="#f0d9a6" stroke-width="4"/>`; }).join('')}
    </g>
    <g class="breath">
      ${torso('#5a3d1e', `
        <path d="M150 300 Q300 250 450 300 L470 400 L130 400Z" fill="#6b4a26"/>
        <path d="M100 400 C110 330 150 300 210 286 L200 400Z M500 400 C490 330 450 300 390 286 L400 400Z" fill="#3f2a12"/>
        <g transform="translate(300 330)">
          <path d="M-40 -46 L40 -46 L40 -40 L6 -2 L40 36 L40 42 L-40 42 L-40 36 L-6 -2 L-40 -40Z" fill="#a0d8ef" opacity=".35" stroke="url(#goldG)" stroke-width="4"/>
          <path d="M-32 -38 L32 -38 L4 -6 L-4 -6Z" fill="url(#${id}s)" opacity=".8"/>
          <path d="M-26 38 Q0 18 26 38Z" fill="url(#${id}s)"/>
          <line class="fx-sand" x1="0" y1="-6" x2="0" y2="34" stroke="#f6e2b0" stroke-width="3" stroke-dasharray="3 4"/>
          <rect x="-48" y="-52" width="96" height="8" rx="3" fill="url(#goldG)"/><rect x="-48" y="40" width="96" height="8" rx="3" fill="url(#goldG)"/>
        </g>`)}
      <path d="M190 120 Q190 40 300 34 Q410 40 410 120 Q420 220 400 300 L200 300 Q180 220 190 120Z" fill="#4a3216" opacity=".95"/>
      ${neck(o.skin, o.shade)}
      ${head(o, '', beard + `<path d="M250 108 Q300 84 350 108 Q300 98 250 108Z" fill="#efe9df" opacity=".7"/><path d="M268 170 Q275 176 284 172 M316 172 Q325 176 332 170" stroke="#9fc6dc" stroke-width="1.5" fill="none" opacity=".7"/>`, sad)}
    </g>`;
  const hands = `
    ${forearm('l', '#5a3d1e', '#f0d9a6')}${forearm('r', '#5a3d1e', '#f0d9a6')}
    ${hand(214, 446, o.skin, o.shade)}${hand(386, 446, o.skin, o.shade, true)}
    <g transform="translate(140 440) rotate(-8)"><rect x="-12" y="-26" width="24" height="4" fill="url(#goldG)"/><path d="M-10 -22 L10 -22 L2 -2 L10 18 L-10 18 L-2 -2Z" fill="#a0d8ef" opacity=".5" stroke="url(#goldG)" stroke-width="2"/><rect x="-12" y="18" width="24" height="4" fill="url(#goldG)"/></g>`;
  return { body: wrap(body, defs), hands: wrap(hands, defs) };
}

function oris() {
  const id = U();
  const o: FaceOpts = { skin: '#8fa3c8', shade: '#4e6290', iris: '#5ee6ff', ink: '#1c2c55', lip: '#33507f', mouthY: 218, eyeY: 166 };
  const defs = `<radialGradient id="${id}orb" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#e6fdff"/><stop offset=".45" stop-color="#5ee6ff" stop-opacity=".7"/><stop offset="1" stop-color="#1c3f7a" stop-opacity=".85"/></radialGradient>`;
  // gözler hep kapalı: kapakları sabit
  const closed: Partial<Record<Mood, string>> = {};
  const lids = `<path d="M262 166 Q275 174 288 166 M312 166 Q325 174 338 166" stroke="#1c2c55" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const body = `
    <g class="breath">
      <path d="M160 400 Q150 240 196 150 Q236 60 300 52 Q364 60 404 150 Q450 240 440 400Z" fill="#0f2550"/>
      ${torso('#132c5e', `
        ${[...Array(14)].map((_, i) => `<circle class="tw" cx="${150 + ((i * 67) % 300)}" cy="${300 + ((i * 41) % 90)}" r="${1.5 + (i % 3)}" fill="#bff6ff" style="animation-delay:${(i % 5) * 0.6}s"/>`).join('')}
        <path d="M190 330 L240 310 L280 340 L330 318 L380 336" stroke="#5ee6ff" stroke-width="1" fill="none" opacity=".5"/>`)}
      <path d="M196 400 Q200 260 232 190 Q260 112 300 108 Q340 112 368 190 Q400 260 404 400Z" fill="#081633"/>
      ${neck(o.skin, o.shade)}
      ${head({ ...o, noEyes: true }, '', `${lids}<ellipse cx="300" cy="168" rx="60" ry="72" fill="#081633" opacity=".22"/>`, closed)}
      <g class="fx-eye" filter="url(#softGlow)">
        <path d="M282 128 Q300 114 318 128 Q300 142 282 128Z" fill="#dffbff" stroke="#5ee6ff" stroke-width="2.5"/>
        <circle cx="300" cy="128" r="6" fill="#5ee6ff"/><circle cx="300" cy="128" r="2.5" fill="#081633"/>
      </g>
      <path d="M200 400 Q204 220 252 140 Q276 96 300 94 Q324 96 348 140 Q396 220 400 400" fill="none" stroke="#5ee6ff" stroke-width="2" opacity=".35"/>
    </g>`;
  const hands = `
    ${forearm('l', '#132c5e', '#5ee6ff')}${forearm('r', '#132c5e', '#5ee6ff')}
    <g transform="translate(112 432) scale(.85)"><ellipse cx="0" cy="34" rx="34" ry="8" fill="#000" opacity=".4"/><path d="M-22 30 L22 30 L14 18 L-14 18Z" fill="url(#goldG)"/>
      <circle class="fx-orb" cx="0" cy="-6" r="28" fill="url(#${id}orb)"/><path class="fx-swirl" d="M-14 -8 Q0 -26 14 -6 Q0 10 -10 -4" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/></g>
    ${hand(226, 446, o.skin, o.shade)}${hand(374, 446, o.skin, o.shade, true)}`;
  return { body: wrap(body, defs), hands: wrap(hands, defs) };
}

function barbaz() {
  const o: FaceOpts = { skin: '#cc4f34', shade: '#7e2412', iris: '#ffcf4a', ink: '#2a0c05', lip: '#2a0c05', eyeW: 14, eyeH: 10, mouthY: 214 };
  const die = (x: number, y: number, s: number, n: number, rot = 0) => {
    const P: Record<number, number[][]> = { 1: [[.5, .5]], 2: [[.28, .28], [.72, .72]], 3: [[.25, .25], [.5, .5], [.75, .75]], 4: [[.28, .28], [.72, .28], [.28, .72], [.72, .72]], 5: [[.26, .26], [.74, .26], [.5, .5], [.26, .74], [.74, .74]], 6: [[.28, .22], [.72, .22], [.28, .5], [.72, .5], [.28, .78], [.72, .78]] };
    return `<g transform="rotate(${rot} ${x + s / 2} ${y + s / 2})"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.18}" fill="#fff8ec" stroke="#3a1208" stroke-width="1.2"/>${P[n].map(([px, py]) => `<circle cx="${x + px * s}" cy="${y + py * s}" r="${s * 0.09}" fill="#3a1208"/>`).join('')}</g>`;
  };
  const grin = (open: number) => `<path d="M256 ${206 - open} Q300 ${244 + open} 344 ${206 - open} Q300 ${222} 256 ${206 - open}Z" fill="#2a0c05"/>
    ${die(268, 208, 13, 1, -8)}${die(282, 212, 13, 2)}${die(296, 212, 13, 3)}${die(310, 210, 13, 4, 8)}`;
  const moodsB: Partial<Record<Mood, string>> = {
    neutral: `<path d="M258 136 L290 148 M342 136 L310 148" stroke="#2a0c05" stroke-width="6" stroke-linecap="round"/>${grin(0)}`,
    smug: `<path d="M258 130 L290 144 M342 126 L310 142" stroke="#2a0c05" stroke-width="6" stroke-linecap="round"/>${grin(6)}`,
    angry: `<path d="M260 132 L292 154 M340 132 L308 154" stroke="#2a0c05" stroke-width="7" stroke-linecap="round"/><path d="M262 220 L338 220" stroke="#2a0c05" stroke-width="10" stroke-linecap="round"/>${die(276, 214, 11, 6)}${die(300, 214, 11, 5)}`,
    think: `<path d="M258 130 L290 140 M342 140 L310 146" stroke="#2a0c05" stroke-width="6" stroke-linecap="round"/><path d="M276 216 Q300 226 330 210" stroke="#2a0c05" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  };
  const body = `
    <g class="fx-flames">${[...Array(7)].map((_, i) => `<path class="fl" style="animation-delay:${i * 0.17}s" d="M${210 + i * 30} 120 Q${200 + i * 30} ${60 - (i % 3) * 20} ${222 + i * 30} ${20 + (i % 2) * 20} Q${240 + i * 30} 70 ${236 + i * 30} 120Z" fill="${i % 2 ? '#ffb347' : '#ff6a2e'}"/>`).join('')}</g>
    <g class="breath">
      ${torso('#c0452c', `
        <path d="M96 400 C98 318 160 282 240 270 L250 400Z M504 400 C502 318 440 282 360 270 L350 400Z" fill="#3a1208"/>
        <path d="M240 270 Q300 300 360 270 L350 400 L250 400Z" fill="#cc4f34"/>
        <path d="M270 310 Q300 330 330 310 M276 350 Q300 366 324 350" stroke="#7e2412" stroke-width="3" fill="none"/>
        ${[...Array(5)].map((_, i) => `<circle cx="${140 + i * 10}" cy="${336 + (i % 2) * 10}" r="3" fill="#ffb347"/>`).join('')}
        <path d="M240 270 L250 400 M360 270 L350 400" stroke="url(#goldG)" stroke-width="5"/>`)}
      ${neck(o.skin, o.shade)}
      ${head(o, `<path d="M248 112 Q206 80 214 26 Q226 68 262 92Z" fill="#2a0c05" stroke="#ffb347" stroke-width="2"/><path d="M352 112 Q394 80 386 26 Q374 68 338 92Z" fill="#2a0c05" stroke="#ffb347" stroke-width="2"/>`,
        `<circle cx="238" cy="196" r="8" fill="none" stroke="url(#goldG)" stroke-width="4"/>`, moodsB)}
    </g>`;
  const hands = `
    ${forearm('l', '#cc4f34', '#3a1208')}${forearm('r', '#cc4f34', '#3a1208')}
    ${hand(214, 446, o.skin, o.shade)}
    <g class="fx-dice">${die(366, 404, 26, 5, -14)}${die(394, 410, 26, 6, 10)}</g>
    ${hand(386, 452, o.skin, o.shade, true)}`;
  return { body: wrap(body), hands: wrap(hands) };
}

function prisma() {
  const id = U();
  const o: FaceOpts = { skin: '#f5d9f0', shade: '#b98fc9', iris: '#b0408f', ink: '#6a1d58', lip: '#b0408f', noEyes: true, mouthY: 218 };
  const defs = `<linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe9fb"/><stop offset=".5" stop-color="#e0b8f0"/><stop offset="1" stop-color="#9fe9ff"/></linearGradient>`;
  const facets = `
    <polygon points="300,96 352,122 360,168 340,212 300,240 260,212 240,168 248,122" fill="url(#${id}g)"/>
    <polygon points="300,96 352,122 300,150" fill="#fff" opacity=".45"/><polygon points="300,96 248,122 300,150" fill="#e8c4ee" opacity=".7"/>
    <polygon points="248,122 240,168 276,160" fill="#d7b0e6" opacity=".8"/><polygon points="352,122 360,168 324,160" fill="#fbe6ff" opacity=".8"/>
    <polygon points="240,168 260,212 282,190" fill="#caa0dc" opacity=".8"/><polygon points="360,168 340,212 318,190" fill="#f0d0f7" opacity=".8"/>
    <polygon points="260,212 300,240 340,212 300,222" fill="#e2bdee"/>`;
  const eyesP = `<polygon points="262,160 286,152 290,166 266,170" fill="#b0408f"/><polygon points="338,160 314,152 310,166 334,170" fill="#b0408f"/>
    <circle class="fx-spark" cx="275" cy="162" r="3" fill="#fff"/><circle class="fx-spark" cx="325" cy="162" r="3" fill="#fff" style="animation-delay:.7s"/>`;
  const mouthsP: Partial<Record<Mood, string>> = {
    neutral: `<path d="M286 214 L300 218 L314 214" stroke="#b0408f" stroke-width="3" fill="none"/>`,
    smug: `<path d="M282 212 L300 222 L320 208" stroke="#b0408f" stroke-width="3" fill="none"/>`,
    angry: `<path d="M284 220 L300 212 L316 220" stroke="#b0408f" stroke-width="3" fill="none"/><path d="M262 146 L288 154 M338 146 L312 154" stroke="#6a1d58" stroke-width="3"/>`,
    think: `<path d="M290 216 L304 216 L314 220" stroke="#b0408f" stroke-width="3" fill="none"/>`,
  };
  const body = `
    <g class="fx-beams" opacity=".5">
      ${['#ff5d8f', '#ffb347', '#fff35c', '#5cf0ff', '#7d6bff', '#8ff7e0'].map((c, i) => `<path d="M300 170 L${-100 + i * 160} -40 L${-40 + i * 160} -40Z" fill="${c}" opacity=".35"/>`).join('')}
    </g>
    <g class="breath">
      ${torso('#5a1a4a', `
        ${[...Array(6)].map((_, i) => `<polygon points="${170 + i * 50},400 ${195 + i * 50},${300 + (i % 2) * 20} ${220 + i * 50},400" fill="url(#${id}g)" opacity="${0.25 + (i % 3) * 0.1}"/>`).join('')}
        <path d="M150 312 Q300 270 450 312" stroke="#8ff7e0" stroke-width="2" fill="none"/>`)}
      ${neck('#e8c4ee', '#b98fc9')}
      <g class="head">
        ${facets}${eyesP}${moods(o, mouthsP)}
        <g class="fx-crown" filter="url(#softGlow)"><path d="M244 108 L254 50 L268 102 L282 26 L300 96 L318 26 L332 102 L346 50 L356 108Z" fill="#e8fffa" stroke="#8ff7e0" stroke-width="2" opacity=".95"/></g>
      </g>
    </g>`;
  const hands = `
    ${forearm('l', '#5a1a4a', '#8ff7e0')}${forearm('r', '#5a1a4a', '#8ff7e0')}
    ${hand(214, 446, '#efd3f0', '#b98fc9')}${hand(386, 446, '#efd3f0', '#b98fc9', true)}
    <g transform="translate(150 450)"><g class="fx-crystal"><polygon points="0,-30 12,0 0,16 -12,0" fill="url(#${id}g)" stroke="#8ff7e0"/></g></g>`;
  return { body: wrap(body, defs), hands: wrap(hands, defs) };
}

const MAKERS: Record<GodId, () => { body: string; hands: string }> = { nadir, kesh, veyla, kronvel, oris, barbaz, prisma };

export function godFigure(id: GodId) {
  return MAKERS[id]();
}
