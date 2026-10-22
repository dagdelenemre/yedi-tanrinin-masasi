import { EntrantId } from '../engine/match';

let idc = 0;
const uid = () => `a${++idc}`;

function starPoints(cx: number, cy: number, n: number, ro: number, ri: number, rot = -Math.PI / 2): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = rot + (i * Math.PI) / n;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** Yedi köşeli yıldız — oyunun amblemi */
export function sevenStar(size = 64, color = '#e9c46a'): string {
  const id = uid();
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" class="seven-star">
    <defs><radialGradient id="${id}" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#fff6d6"/><stop offset=".55" stop-color="${color}"/><stop offset="1" stop-color="#8a6420"/></radialGradient></defs>
    <circle cx="50" cy="50" r="46" fill="none" stroke="${color}" stroke-width="1.5" opacity=".55"/>
    <polygon points="${starPoints(50, 50, 7, 40, 17)}" fill="url(#${id})" stroke="#5b3f10" stroke-width="1"/>
    <circle cx="50" cy="50" r="7" fill="#1a1230" stroke="${color}" stroke-width="1.5"/>
  </svg>`;
}

export function cardBackSVG(): string {
  const id = uid();
  return `<svg viewBox="0 0 100 140" preserveAspectRatio="none" class="back-svg">
    <defs>
      <radialGradient id="${id}g" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="#3a2470"/><stop offset="1" stop-color="#160c33"/></radialGradient>
      <pattern id="${id}p" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="10" height="10" fill="none"/><path d="M0 5 H10" stroke="#e9c46a" stroke-width=".4" opacity=".25"/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="100" height="140" rx="8" fill="url(#${id}g)"/>
    <rect x="0" y="0" width="100" height="140" rx="8" fill="url(#${id}p)"/>
    <rect x="6" y="6" width="88" height="128" rx="5" fill="none" stroke="#e9c46a" stroke-width="1.6" opacity=".85"/>
    <rect x="10" y="10" width="80" height="120" rx="3" fill="none" stroke="#e9c46a" stroke-width=".6" opacity=".5"/>
    <polygon points="${starPoints(50, 70, 7, 26, 11)}" fill="#e9c46a" opacity=".9"/>
    <circle cx="50" cy="70" r="5" fill="#1a1230"/>
    <circle cx="50" cy="70" r="33" fill="none" stroke="#e9c46a" stroke-width=".8" opacity=".6"/>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Portreler (200x200)
// ---------------------------------------------------------------------------

function frame(id: string, c1: string, c2: string, inner: string, rim = '#e9c46a'): string {
  return `<svg viewBox="0 0 200 200" class="portrait-svg" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="${id}bg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
    <clipPath id="${id}clip"><circle cx="100" cy="100" r="96"/></clipPath>
    <filter id="${id}glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <linearGradient id="${id}gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#e9c46a"/><stop offset="1" stop-color="#9a6b1c"/></linearGradient>
  </defs>
  <g clip-path="url(#${id}clip)">
    <rect width="200" height="200" fill="url(#${id}bg)"/>
    ${inner}
  </g>
  <circle cx="100" cy="100" r="96" fill="none" stroke="${rim}" stroke-width="4"/>
  <circle cx="100" cy="100" r="90" fill="none" stroke="${rim}" stroke-width="1" opacity=".5"/>
</svg>`;
}

function nadir(): string {
  const id = uid();
  // Ters Kral: baş aşağı taç, mor kaftan, kibirli bakış
  const inner = `
    <g opacity=".25">${[...Array(9)].map((_, i) => `<path d="M${i * 25} 0 L${i * 25 + 12} 200" stroke="#f2c14e" stroke-width="1"/>`).join('')}</g>
    <path d="M18 200 Q30 150 100 138 Q170 150 182 200 Z" fill="#4a2672"/>
    <path d="M70 146 L100 200 L130 146" fill="#f2c14e" opacity=".9"/>
    <path d="M78 148 L100 192 L122 148" fill="#6b3fa0"/>
    <path d="M18 200 Q30 150 100 138 Q170 150 182 200" fill="none" stroke="url(#${id}gold)" stroke-width="4"/>
    <rect x="88" y="118" width="24" height="24" fill="#e8d3f0"/>
    <ellipse cx="100" cy="96" rx="33" ry="39" fill="#efdcf5"/>
    <path d="M67 92 Q66 60 100 56 Q134 60 133 92 Q128 72 100 70 Q72 72 67 92Z" fill="#2a1840"/>
    <path d="M78 94 Q86 90 93 95" stroke="#2a1840" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M107 95 Q114 90 122 94" stroke="#2a1840" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M79 99 Q86 101 92 99" stroke="#6b3fa0" stroke-width="2" fill="none"/>
    <path d="M108 99 Q114 101 121 99" stroke="#6b3fa0" stroke-width="2" fill="none"/>
    <path d="M76 88 L93 86" stroke="#2a1840" stroke-width="2.5"/><path d="M107 86 L124 88" stroke="#2a1840" stroke-width="2.5"/>
    <path d="M100 100 L97 112 L103 112" stroke="#b79ac4" stroke-width="2" fill="none"/>
    <path d="M89 121 Q100 125 113 118" stroke="#7a3a6a" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M86 128 Q100 150 114 128 Q100 136 86 128Z" fill="#2a1840"/>
    <polygon points="64,108 70,108 67,118" fill="#f2c14e"/><polygon points="130,108 136,108 133,118" fill="#f2c14e"/>
    <g filter="url(#${id}glow)" transform="translate(0,-2)">
      <path d="M62 18 L138 18 L138 30 L62 30 Z" fill="url(#${id}gold)"/>
      <path d="M62 30 L70 56 L80 30 L90 60 L100 30 L110 60 L120 30 L130 56 L138 30 Z" fill="url(#${id}gold)"/>
      <circle cx="90" cy="54" r="3.5" fill="#d62e5c"/><circle cx="110" cy="54" r="3.5" fill="#2ec4d6"/>
      <circle cx="100" cy="24" r="4" fill="#7b2fd0"/><circle cx="76" cy="24" r="2.5" fill="#fff"/><circle cx="124" cy="24" r="2.5" fill="#fff"/>
    </g>`;
  return frame(id, '#8a5cc4', '#1e0d36', inner);
}

function kesh(): string {
  const id = uid();
  const coin = (x: number, y: number, r: number) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${id}gold)" stroke="#7a5212" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="none" stroke="#7a5212" stroke-width="1"/>`;
  const inner = `
    ${[...Array(14)].map((_, i) => coin(15 + ((i * 53) % 180), 20 + ((i * 37) % 170), 5 + (i % 3) * 2).replace(/<circle/g, '<circle opacity=".25"')).join('')}
    <path d="M14 200 Q28 150 100 140 Q172 150 186 200 Z" fill="#14514d"/>
    <path d="M100 142 L100 200" stroke="url(#${id}gold)" stroke-width="5"/>
    <path d="M30 170 Q10 140 22 112" stroke="#c99a6a" stroke-width="13" fill="none" stroke-linecap="round"/>
    <path d="M170 170 Q190 140 178 112" stroke="#c99a6a" stroke-width="13" fill="none" stroke-linecap="round"/>
    <g transform="rotate(-14 18 100)"><rect x="6" y="80" width="24" height="34" rx="3" fill="#fff" stroke="#333"/><text x="18" y="102" font-size="16" text-anchor="middle" fill="#c0262d" font-family="serif">♦</text></g>
    ${coin(180, 104, 11)}
    <rect x="89" y="118" width="22" height="24" fill="#b88458"/>
    <ellipse cx="100" cy="98" rx="32" ry="37" fill="#d4a373"/>
    <path d="M64 80 Q64 40 100 38 Q136 40 136 80 Q120 70 100 72 Q80 70 64 80Z" fill="#1f7a74"/>
    <path d="M64 80 Q100 60 136 80" stroke="url(#${id}gold)" stroke-width="4" fill="none"/>
    <path d="M78 52 Q100 66 122 52" stroke="#145a55" stroke-width="3" fill="none"/>
    <circle cx="100" cy="62" r="7" fill="#e63946" stroke="url(#${id}gold)" stroke-width="2.5"/>
    ${coin(86, 96, 8)}${coin(114, 96, 8)}
    <path d="M100 100 L96 112 L104 112" stroke="#9c6b44" stroke-width="2" fill="none"/>
    <path d="M78 118 Q90 110 100 116 Q110 110 122 118 Q112 122 100 119 Q88 122 78 118Z" fill="#3b2412"/>
    <path d="M90 126 Q100 132 110 126" stroke="#6b3a1e" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  return frame(id, '#2fa39a', '#06231f', inner);
}

function veyla(): string {
  const id = uid();
  const inner = `
    <defs>
      <linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#c7d6e6"/><stop offset=".6" stop-color="#8ea6c0"/><stop offset="1" stop-color="#e8f0f8"/></linearGradient>
    </defs>
    ${[...Array(10)].map((_, i) => `<circle cx="${(i * 47) % 200}" cy="${(i * 71) % 200}" r="${1 + (i % 3)}" fill="#fff" opacity=".5"/>`).join('')}
    <path d="M40 200 Q30 120 50 80 Q60 40 100 34 Q140 40 150 80 Q170 120 160 200 Z" fill="#1b2c4a"/>
    <path d="M24 200 Q36 152 100 142 Q164 152 176 200 Z" fill="#2c4a74"/>
    <path d="M60 200 Q80 160 100 150 Q120 160 140 200" fill="#d9e7f5" opacity=".3"/>
    <rect x="90" y="118" width="20" height="26" fill="#c9d6e4"/>
    <ellipse cx="100" cy="96" rx="33" ry="40" fill="url(#${id}m)" stroke="#e9eef5" stroke-width="2"/>
    <path d="M78 70 L92 130" stroke="#fff" stroke-width="4" opacity=".7"/>
    <path d="M90 66 L100 110" stroke="#fff" stroke-width="2" opacity=".6"/>
    <text x="114" y="122" font-size="20" fill="#5a7fa8" opacity=".45" font-family="serif">♠</text>
    <path d="M64 86 Q100 78 136 86 L136 100 Q100 94 64 100Z" fill="#14213a"/>
    <path d="M136 90 Q152 96 160 116 Q150 108 138 100" fill="#14213a"/>
    <path d="M136 94 Q148 110 150 130 Q142 116 136 104" fill="#1b2c4a"/>
    <path d="M64 88 Q100 82 136 88" stroke="#d9e7f5" stroke-width="1" opacity=".5" fill="none"/>
    <path d="M92 122 Q100 127 108 122" stroke="#5a7fa8" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M56 70 Q70 40 100 38 Q86 50 80 70 Q70 90 66 120 Q56 100 56 70Z" fill="#22385e"/>
    <path d="M144 70 Q130 40 100 38 Q114 50 120 70 Q130 90 134 120 Q144 100 144 70Z" fill="#22385e"/>
    <polygon points="${starPoints(100, 34, 4, 9, 3)}" fill="#d9e7f5"/>`;
  return frame(id, '#7ea6cf', '#0d1830', inner, '#d9e7f5');
}

function kronvel(): string {
  const id = uid();
  const inner = `
    <defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0d9a6"/><stop offset="1" stop-color="#c59a52"/></linearGradient></defs>
    <g opacity=".22" stroke="#f0d9a6" fill="none"><circle cx="100" cy="100" r="80"/><circle cx="100" cy="100" r="64"/>${[...Array(12)].map((_, i) => { const a = (i * Math.PI) / 6; return `<line x1="${100 + 72 * Math.cos(a)}" y1="${100 + 72 * Math.sin(a)}" x2="${100 + 80 * Math.cos(a)}" y2="${100 + 80 * Math.sin(a)}" stroke-width="3"/>`; }).join('')}</g>
    <path d="M52 140 L148 140 L148 146 L108 172 L148 198 L148 204 L52 204 L52 198 L92 172 L52 146Z" fill="#a0d8ef" opacity=".35" stroke="url(#${id}gold)" stroke-width="3"/>
    <path d="M60 148 L140 148 L104 170 L96 170Z" fill="url(#${id}s)" opacity=".5"/>
    <path d="M70 200 Q100 180 130 200Z" fill="url(#${id}s)"/>
    <line x1="100" y1="170" x2="100" y2="196" stroke="#f0d9a6" stroke-width="2" stroke-dasharray="2 3"/>
    <rect x="46" y="136" width="108" height="8" rx="3" fill="url(#${id}gold)"/>
    <ellipse cx="100" cy="88" rx="31" ry="36" fill="#e2c9a4"/>
    <path d="M70 80 Q68 50 100 48 Q132 50 130 80 Q124 60 100 60 Q76 60 70 80Z" fill="#ece6dc"/>
    <path d="M74 86 Q84 78 94 84" stroke="#f5f2ec" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M106 84 Q116 78 126 86" stroke="#f5f2ec" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M80 94 Q86 98 92 94" stroke="#5a4020" stroke-width="2.5" fill="none"/>
    <path d="M108 94 Q114 98 120 94" stroke="#5a4020" stroke-width="2.5" fill="none"/>
    <path d="M82 99 Q86 103 88 108" stroke="#9fc6dc" stroke-width="1.5" fill="none" opacity=".8"/>
    <path d="M100 96 L97 106 L103 106" stroke="#a88b62" stroke-width="2" fill="none"/>
    <path d="M70 104 Q72 130 86 140 Q100 152 114 140 Q128 130 130 104 Q120 118 100 116 Q80 118 70 104Z" fill="#f5f2ec"/>
    <path d="M92 118 Q100 114 108 118" stroke="#8a6a3c" stroke-width="2" fill="none"/>
    <path d="M86 140 Q100 168 114 140" fill="#f5f2ec"/>`;
  return frame(id, '#b48a50', '#2a1a08', inner);
}

function oris(): string {
  const id = uid();
  const inner = `
    ${[...Array(18)].map((_, i) => `<circle cx="${(i * 61 + 13) % 200}" cy="${(i * 43 + 7) % 200}" r="${0.8 + (i % 3) * 0.7}" fill="#bff6ff" opacity="${0.4 + (i % 4) * 0.15}"/>`).join('')}
    <path d="M20 200 Q20 120 46 80 Q66 30 100 26 Q134 30 154 80 Q180 120 180 200 Z" fill="#0f2550"/>
    <path d="M44 200 Q50 130 66 100 Q80 60 100 56 Q120 60 134 100 Q150 130 156 200 Z" fill="#081633"/>
    <path d="M20 200 Q20 120 46 80 Q66 30 100 26 Q134 30 154 80 Q180 120 180 200" fill="none" stroke="#5ee6ff" stroke-width="2" opacity=".5"/>
    <ellipse cx="100" cy="104" rx="29" ry="35" fill="#9fb4d6"/>
    <ellipse cx="100" cy="104" rx="29" ry="35" fill="#081633" opacity=".25"/>
    <path d="M80 104 Q87 108 94 104" stroke="#1c3f7a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M106 104 Q113 108 120 104" stroke="#1c3f7a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M100 108 L98 118 L102 118" stroke="#6d84ad" stroke-width="1.6" fill="none"/>
    <path d="M93 126 L107 126" stroke="#33507f" stroke-width="2.4" stroke-linecap="round"/>
    <g filter="url(#${id}glow)">
      <path d="M86 84 Q100 72 114 84 Q100 96 86 84Z" fill="#dffbff" stroke="#5ee6ff" stroke-width="2"/>
      <circle cx="100" cy="84" r="5" fill="#5ee6ff"/><circle cx="100" cy="84" r="2" fill="#081633"/>
    </g>
    <g stroke="#5ee6ff" stroke-width="1.2" opacity=".6">${[...Array(8)].map((_, i) => { const a = (i * Math.PI) / 4; return `<line x1="${100 + 16 * Math.cos(a)}" y1="${84 + 16 * Math.sin(a)}" x2="${100 + 24 * Math.cos(a)}" y2="${84 + 24 * Math.sin(a)}"/>`; }).join('')}</g>
    <path d="M100 150 L100 200" stroke="#5ee6ff" stroke-width="1" opacity=".5"/>
    <polygon points="${starPoints(100, 165, 7, 10, 4)}" fill="#5ee6ff" opacity=".7"/>`;
  return frame(id, '#2b5bb0', '#030a1c', inner, '#5ee6ff');
}

function barbaz(): string {
  const id = uid();
  const die = (x: number, y: number, s: number, pips: number[][], rot = 0) =>
    `<g transform="rotate(${rot} ${x + s / 2} ${y + s / 2})"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.18}" fill="#fff8ec" stroke="#3a1208" stroke-width="1"/>${pips.map(([px, py]) => `<circle cx="${x + px * s}" cy="${y + py * s}" r="${s * 0.09}" fill="#3a1208"/>`).join('')}</g>`;
  const inner = `
    <g opacity=".5">${[...Array(7)].map((_, i) => `<path d="M${i * 32 - 10} 200 Q${i * 32 + 6} ${150 - (i % 3) * 20} ${i * 32 + 2} ${120 - (i % 2) * 30} Q${i * 32 + 18} 160 ${i * 32 + 22} 200Z" fill="#ff7b2e"/>`).join('')}</g>
    <path d="M16 200 Q30 148 100 138 Q170 148 184 200 Z" fill="#5a160b"/>
    <path d="M60 200 L100 140 L140 200" fill="#ffb347" opacity=".25"/>
    <path d="M70 70 Q40 50 44 16 Q56 40 78 56Z" fill="#2a0c05" stroke="#ffb347" stroke-width="1.5"/>
    <path d="M130 70 Q160 50 156 16 Q144 40 122 56Z" fill="#2a0c05" stroke="#ffb347" stroke-width="1.5"/>
    <rect x="89" y="118" width="22" height="24" fill="#c0563b"/>
    <ellipse cx="100" cy="96" rx="35" ry="38" fill="#d9694a"/>
    <path d="M66 78 Q72 54 100 52 Q128 54 134 78 Q118 64 100 66 Q82 64 66 78Z" fill="#2a0c05"/>
    <path d="M74 80 L94 88" stroke="#2a0c05" stroke-width="4" stroke-linecap="round"/><path d="M126 80 L106 88" stroke="#2a0c05" stroke-width="4" stroke-linecap="round"/>
    <circle cx="86" cy="94" r="7" fill="#fff8ec"/><circle cx="114" cy="94" r="7" fill="#fff8ec"/>
    <circle cx="87" cy="95" r="3.5" fill="#2a0c05"/><circle cx="113" cy="95" r="3.5" fill="#2a0c05"/>
    <path d="M70 108 Q100 140 130 108 Q100 118 70 108Z" fill="#2a0c05"/>
    ${die(78, 109, 10, [[0.5, 0.5]], -6)}${die(89, 112, 10, [[0.3, 0.3], [0.7, 0.7]], 0)}${die(100, 112, 10, [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]], 0)}${die(111, 109, 10, [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]], 6)}
    ${die(20, 140, 22, [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]], -18)}
    ${die(156, 148, 22, [[0.25, 0.25], [0.75, 0.25], [0.25, 0.5], [0.75, 0.5], [0.25, 0.75], [0.75, 0.75]], 14)}`;
  return frame(id, '#e0542e', '#2a0603', inner, '#ffb347');
}

function prisma(): string {
  const id = uid();
  const inner = `
    <g opacity=".55">
      <path d="M100 100 L0 40 L0 70Z" fill="#ff5d8f"/><path d="M100 100 L0 70 L0 100Z" fill="#ffb347"/>
      <path d="M100 100 L0 100 L0 130Z" fill="#fff35c"/><path d="M100 100 L200 60 L200 90Z" fill="#5cf0ff"/>
      <path d="M100 100 L200 90 L200 120Z" fill="#7d6bff"/><path d="M100 100 L200 120 L200 150Z" fill="#8ff7e0"/>
    </g>
    <path d="M18 200 Q32 150 100 140 Q168 150 182 200 Z" fill="#5a1a4a"/>
    <path d="M60 200 L80 150 L100 200 L120 150 L140 200" fill="#8ff7e0" opacity=".25"/>
    <path d="M70 60 L78 26 L86 58 L94 14 L100 54 L106 14 L114 58 L122 26 L130 60Z" fill="#e8fffa" stroke="#8ff7e0" stroke-width="1.5" opacity=".9"/>
    <rect x="90" y="118" width="20" height="24" fill="#d9b8e8"/>
    <polygon points="100,56 132,74 136,108 118,134 100,140 82,134 64,108 68,74" fill="#f5d9f0"/>
    <polygon points="100,56 132,74 100,92" fill="#ffe3f6"/><polygon points="100,56 68,74 100,92" fill="#e8c4ee"/>
    <polygon points="68,74 64,108 86,100" fill="#d7b0e6"/><polygon points="132,74 136,108 114,100" fill="#fbe6ff"/>
    <polygon points="64,108 82,134 92,116" fill="#caa0dc"/><polygon points="136,108 118,134 108,116" fill="#f0d0f7"/>
    <polygon points="82,134 100,140 118,134 100,124" fill="#e2bdee"/>
    <polygon points="80,94 92,90 94,98 82,100" fill="#b0408f"/><polygon points="120,94 108,90 106,98 118,100" fill="#b0408f"/>
    <circle cx="87" cy="95" r="2" fill="#fff"/><circle cx="113" cy="95" r="2" fill="#fff"/>
    <path d="M90 120 L100 124 L110 120" stroke="#b0408f" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    <g filter="url(#${id}glow)"><polygon points="${starPoints(100, 40, 4, 8, 2.5)}" fill="#fff"/><polygon points="${starPoints(146, 66, 4, 5, 1.5)}" fill="#fff"/><polygon points="${starPoints(56, 120, 4, 5, 1.5)}" fill="#fff"/></g>`;
  return frame(id, '#e46fc2', '#2a0624', inner, '#8ff7e0');
}

function joker(): string {
  const id = uid();
  const inner = `
    <g opacity=".18">${[...Array(6)].map((_, i) => `<rect x="${i * 40 - 20}" y="-20" width="20" height="260" fill="#e9c46a" transform="rotate(20 100 100)"/>`).join('')}</g>
    <path d="M18 200 Q32 148 100 138 Q168 148 182 200 Z" fill="#1c1430"/>
    <path d="M60 148 L72 166 L86 150 L100 168 L114 150 L128 166 L140 148 L140 156 L128 176 L114 160 L100 178 L86 160 L72 176 L60 156Z" fill="#e9c46a"/>
    <rect x="90" y="118" width="20" height="24" fill="#e8e0d0"/>
    <path d="M62 82 Q40 50 22 66 Q38 40 66 56 Q80 18 100 14 Q120 18 134 56 Q162 40 178 66 Q160 50 138 82Z" fill="#6b2fa0"/>
    <path d="M100 14 Q120 18 134 56 L138 82 L100 78Z" fill="#1f8a5a"/>
    <path d="M22 66 Q40 50 62 82 L66 56Z" fill="#1f8a5a"/>
    <circle cx="22" cy="66" r="7" fill="url(#${id}gold)"/><circle cx="178" cy="66" r="7" fill="url(#${id}gold)"/><circle cx="100" cy="12" r="7" fill="url(#${id}gold)"/>
    <ellipse cx="100" cy="100" rx="32" ry="38" fill="#f4efe6"/>
    <path d="M62 82 Q100 70 138 82 L138 88 Q100 78 62 88Z" fill="url(#${id}gold)"/>
    <path d="M80 92 L87 84 L94 92 L87 100Z" fill="#1c1430"/><path d="M106 92 L113 84 L120 92 L113 100Z" fill="#1c1430"/>
    <circle cx="87" cy="92" r="2" fill="#e9c46a"/><circle cx="113" cy="92" r="2" fill="#e9c46a"/>
    <path d="M87 104 L84 114" stroke="#6b2fa0" stroke-width="2"/><path d="M113 104 L116 114" stroke="#1f8a5a" stroke-width="2"/>
    <path d="M100 100 L98 110 L102 110" stroke="#b9ad98" stroke-width="1.6" fill="none"/>
    <path d="M86 120 Q100 132 116 118" stroke="#a2253b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="80" cy="114" r="4" fill="#f2a0b0" opacity=".5"/><circle cx="120" cy="114" r="4" fill="#f2a0b0" opacity=".5"/>`;
  return frame(id, '#3d2a63', '#07040f', inner);
}

const PORTRAITS: Record<EntrantId, () => string> = {
  player: joker,
  nadir,
  kesh,
  veyla,
  kronvel,
  oris,
  barbaz,
  prisma,
};

export function portrait(id: EntrantId): string {
  return PORTRAITS[id]();
}
