// Uygulama ikonlarını (yedi köşeli yıldız) bağımlılıksız PNG olarak üretir.
// Kullanım: node scripts/make-icons.cjs
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const C = { bg: [28, 18, 56], disk: [42, 26, 80], ring: [184, 146, 63], star: [226, 185, 85], starHi: [255, 236, 170] };

function starPoly(cx, cy, ro, ri) {
  const pts = [];
  for (let i = 0; i < 14; i++) {
    const r = i % 2 ? ri : ro;
    const a = -Math.PI / 2 + (i * Math.PI) / 7;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function inPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function colorAt(x, y, S) {
  const cx = S / 2, cy = S / 2;
  const d = Math.hypot(x - cx, y - cy);
  if (d < S * 0.055) return C.bg;
  const star = starPoly(cx, cy, S * 0.31, S * 0.13);
  if (inPoly(x, y, star)) {
    // üstten hafif ışık
    const t = Math.max(0, Math.min(1, (y - (cy - S * 0.31)) / (S * 0.62)));
    return C.starHi.map((v, k) => Math.round(v + (C.star[k] - v) * (0.35 + 0.65 * t)));
  }
  if (Math.abs(d - S * 0.37) < S * 0.008) return C.ring;
  if (d < S * 0.42) return C.disk;
  return C.bg;
}

function png(S) {
  const SS = 4; // kenar yumuşatma için alt örnekleme
  const raw = Buffer.alloc((S * 3 + 1) * S);
  for (let y = 0; y < S; y++) {
    raw[y * (S * 3 + 1)] = 0;
    for (let x = 0; x < S; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS, S);
          r += c[0]; g += c[1]; b += c[2];
        }
      const o = y * (S * 3 + 1) + 1 + x * 3;
      raw[o] = Math.round(r / (SS * SS));
      raw[o + 1] = Math.round(g / (SS * SS));
      raw[o + 2] = Math.round(b / (SS * SS));
    }
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0);
  ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; // bit derinliği
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [['icon-180.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  fs.writeFileSync(path.join(OUT, name), png(size));
  console.log(name, size);
}
