import { RANK_NAMES, RANK_LABELS, SUIT_SYMBOLS } from './cards';

export interface CardLike {
  rank: number;
  suit: number;
}

// ---------------------------------------------------------------------------
// YÜKSEK EL (klasik Texas Hold'em)
// ---------------------------------------------------------------------------

export const HIGH_CATEGORY_NAMES = [
  'Yüksek Kart',
  'Per',
  'Döper',
  'Üçlü',
  'Kent',
  'Floş',
  'Ful',
  'Kare',
  'Sıralı Floş',
  'Royal Floş',
];

const rankCount = new Int8Array(16);
const suitCount = new Int8Array(4);
const suitMask = new Int32Array(4);

function straightHigh(mask: number): number {
  // As hem 14 hem 1 olarak sayılır
  const m = mask | ((mask >> 14) & 1 ? 1 << 1 : 0);
  for (let hi = 14; hi >= 5; hi--) {
    const need = 0b11111 << (hi - 4);
    if ((m & need) === need) return hi;
  }
  return 0;
}

function pack(cat: number, ks: number[]): number {
  let s = cat;
  for (let i = 0; i < 5; i++) s = s * 16 + (ks[i] ?? 0);
  return s;
}

/** 5-7 kartlık en iyi yüksek elin skoru. Büyük skor daha iyi. */
export function scoreHigh(cards: CardLike[]): number {
  rankCount.fill(0);
  suitCount.fill(0);
  suitMask.fill(0);
  let mask = 0;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    rankCount[c.rank]++;
    suitCount[c.suit]++;
    suitMask[c.suit] |= 1 << c.rank;
    mask |= 1 << c.rank;
  }
  // floş / sıralı floş
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (suitCount[s] >= 5) flushSuit = s;
  if (flushSuit >= 0) {
    const sh = straightHigh(suitMask[flushSuit]);
    if (sh) return pack(8, [sh]);
  }
  let quad = 0, trip1 = 0, trip2 = 0, pair1 = 0, pair2 = 0;
  for (let r = 14; r >= 2; r--) {
    const n = rankCount[r];
    if (n >= 4) { if (!quad) quad = r; else if (!trip1) trip1 = r; }
    else if (n === 3) { if (!trip1) trip1 = r; else if (!trip2) trip2 = r; }
    else if (n === 2) { if (!pair1) pair1 = r; else if (!pair2) pair2 = r; }
  }
  if (quad) {
    let k = 0;
    for (let r = 14; r >= 2; r--) if (r !== quad && rankCount[r] > 0) { k = r; break; }
    return pack(7, [quad, k]);
  }
  if (trip1 && (trip2 || pair1)) {
    return pack(6, [trip1, Math.max(trip2, pair1)]);
  }
  if (flushSuit >= 0) {
    // kopya kartlara (Prisma) izin vermek için sayılarak alınır
    const ks: number[] = [];
    const tmp: number[] = [];
    for (const c of cards) if (c.suit === flushSuit) tmp.push(c.rank);
    tmp.sort((a, b) => b - a);
    for (let i = 0; i < 5; i++) ks.push(tmp[i]);
    return pack(5, ks);
  }
  const sh = straightHigh(mask);
  if (sh) return pack(4, [sh]);
  if (trip1) {
    const ks = [trip1];
    for (let r = 14; r >= 2 && ks.length < 3; r--) if (r !== trip1 && rankCount[r] > 0) ks.push(r);
    return pack(3, ks);
  }
  if (pair1 && pair2) {
    let k = 0;
    for (let r = 14; r >= 2; r--) if (r !== pair1 && r !== pair2 && rankCount[r] > 0) { k = r; break; }
    return pack(2, [pair1, pair2, k]);
  }
  if (pair1) {
    const ks = [pair1];
    for (let r = 14; r >= 2 && ks.length < 4; r--) if (r !== pair1 && rankCount[r] > 0) ks.push(r);
    return pack(1, ks);
  }
  const ks: number[] = [];
  for (let r = 14; r >= 2 && ks.length < 5; r--) if (rankCount[r] > 0) ks.push(r);
  return pack(0, ks);
}

export function categoryOf(score: number): number {
  return Math.floor(score / 16 ** 5);
}

function kickersOf(score: number): number[] {
  const ks: number[] = [];
  let s = score;
  for (let i = 0; i < 5; i++) {
    ks.unshift(s % 16);
    s = Math.floor(s / 16);
  }
  return ks;
}

// ---------------------------------------------------------------------------
// DÜŞÜK EL (A-5 lowball) — Nadir'in oyunu
// As en düşük kart, kent ve floş sayılmaz. En iyi el: 5-4-3-2-A
// ---------------------------------------------------------------------------

export const LOW_CATEGORY_NAMES = ['Temiz Düşük', 'Per (kötü)', 'Döper (kötü)', 'Üçlü (kötü)', 'Ful (kötü)', 'Kare (kötü)', 'Beşli (kötü)'];

const lowCnt = new Int8Array(15);

/** 5 kartlık A-5 düşük el anahtarı. KÜÇÜK anahtar daha iyi. */
function lowKey5(ranks: number[]): number {
  lowCnt.fill(0);
  for (const r of ranks) lowCnt[r === 14 ? 1 : r]++;
  const groups: [number, number][] = [];
  for (let r = 13; r >= 1; r--) if (lowCnt[r]) groups.push([lowCnt[r], r]);
  groups.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  let cat = 0;
  const top = groups[0][0];
  if (top >= 5) cat = 6;
  else if (top === 4) cat = 5;
  else if (top === 3) cat = groups[1] && groups[1][0] >= 2 ? 4 : 3;
  else if (top === 2) cat = groups[1] && groups[1][0] === 2 ? 2 : 1;
  const ks: number[] = [];
  for (const [n, r] of groups) for (let i = 0; i < n; i++) ks.push(r);
  return pack(cat, ks);
}

const MAX_KEY = 16 ** 6;
const combos7: number[][] = [];
(function build() {
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++)
      for (let c = b + 1; c < 7; c++)
        for (let d = c + 1; d < 7; d++)
          for (let e = d + 1; e < 7; e++) combos7.push([a, b, c, d, e]);
})();

function combosFor(n: number): number[][] {
  if (n === 7) return combos7;
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === 5) { out.push(acc.slice()); return; }
    for (let i = start; i < n; i++) { acc.push(i); rec(i + 1, acc); acc.pop(); }
  };
  rec(0, []);
  return out;
}

const tmpRanks = [0, 0, 0, 0, 0];
/** Büyük skor daha iyi (anahtar ters çevrilir). */
export function scoreLow(cards: CardLike[]): number {
  if (cards.length < 5) return 0;
  const cs = combosFor(cards.length);
  let best = Infinity;
  for (const cb of cs) {
    for (let i = 0; i < 5; i++) tmpRanks[i] = cards[cb[i]].rank;
    const k = lowKey5(tmpRanks);
    if (k < best) best = k;
  }
  return MAX_KEY - best;
}

// ---------------------------------------------------------------------------
// Detaylı değerlendirme (arayüz için): ad, açıklama, en iyi 5 kart
// ---------------------------------------------------------------------------

export interface HandInfo {
  score: number;
  category: number; // yüksek: 0..9, düşük: 0..6
  name: string;
  detail: string;
  best: number[]; // girdi dizisindeki indeksler
}

function rn(r: number): string {
  return RANK_NAMES[r];
}

export function describeHigh(cards: CardLike[]): HandInfo {
  if (cards.length < 3) return describePartialHigh(cards);
  const cs = cards.length >= 5 ? combosFor(cards.length) : [cards.map((_, i) => i)];
  let bestScore = -1;
  let bestCombo = cs[0];
  for (const cb of cs) {
    const s = scoreHigh(cb.map((i) => cards[i]));
    if (s > bestScore) { bestScore = s; bestCombo = cb; }
  }
  let cat = categoryOf(bestScore);
  const ks = kickersOf(bestScore);
  let detail = '';
  switch (cat) {
    case 0: detail = `En yüksek kart: ${rn(ks[0])}`; break;
    case 1: detail = `${rn(ks[0])} çifti`; break;
    case 2: detail = `${rn(ks[0])} ve ${rn(ks[1])} çiftleri`; break;
    case 3: detail = `Üç tane ${rn(ks[0])}`; break;
    case 4: detail = `${RANK_LABELS[ks[0]]} yüksek sıralı`; break;
    case 5: detail = `${rn(ks[0])} yüksek, beş kart aynı renk`; break;
    case 6: detail = `Üç ${rn(ks[0])} + iki ${rn(ks[1])}`; break;
    case 7: detail = `Dört tane ${rn(ks[0])}`; break;
    case 8:
      if (ks[0] === 14) { cat = 9; detail = '10-J-Q-K-A aynı renk — en güçlü el!'; }
      else detail = `${RANK_LABELS[ks[0]]} yüksek, sıralı ve aynı renk`;
      break;
  }
  // Sadece eli oluşturan kartları vurgula (kicker'lar hariç tutulabilir)
  const best = bestCombo.slice();
  let core = best;
  if (cat === 1 || cat === 2 || cat === 3 || cat === 7 || cat === 0) {
    const counts: Record<number, number> = {};
    for (const i of best) counts[cards[i].rank] = (counts[cards[i].rank] || 0) + 1;
    if (cat === 0) core = [best.reduce((a, b) => (cards[b].rank > cards[a].rank ? b : a))];
    else core = best.filter((i) => counts[cards[i].rank] >= 2);
  }
  return { score: bestScore, category: cat, name: HIGH_CATEGORY_NAMES[cat], detail, best: core };
}

function describePartialHigh(cards: CardLike[]): HandInfo {
  // 2 kart (flop öncesi)
  if (cards.length === 2) {
    const [a, b] = cards;
    if (a.rank === b.rank) {
      return { score: 0, category: 1, name: 'Per', detail: `Elinde ${rn(a.rank)} çifti (cep per)`, best: [0, 1] };
    }
    const hi = a.rank > b.rank ? 0 : 1;
    const suited = a.suit === b.suit ? ', aynı renk' : '';
    const conn = Math.abs(a.rank - b.rank) === 1 ? ', ardışık' : '';
    return { score: 0, category: 0, name: 'Yüksek Kart', detail: `${rn(cards[hi].rank)} yüksek${suited}${conn}`, best: [hi] };
  }
  return { score: 0, category: 0, name: '—', detail: '', best: [] };
}

export function describeLow(cards: CardLike[]): HandInfo {
  const low = (r: number) => (r === 14 ? 1 : r);
  const lbl = (r: number) => (r === 1 || r === 14 ? 'A' : RANK_LABELS[r]);
  if (cards.length < 5) {
    const rs = cards.map((c) => low(c.rank)).sort((a, b) => b - a);
    const paired = cards.length === 2 && rs[0] === rs[1];
    return {
      score: 0,
      category: paired ? 1 : 0,
      name: paired ? 'Per (kötü)' : `${lbl(rs[0])} yüksek`,
      detail: paired ? 'Düşük oyunda çift istenmez' : `Elindeki kartlar: ${rs.map(lbl).join('-')} (küçük olması iyi)`,
      best: cards.map((_, i) => i),
    };
  }
  const cs = combosFor(cards.length);
  let bestKey = Infinity;
  let bestCombo = cs[0];
  for (const cb of cs) {
    const k = lowKey5(cb.map((i) => cards[i].rank));
    if (k < bestKey) { bestKey = k; bestCombo = cb; }
  }
  const cat = Math.floor(bestKey / 16 ** 5);
  const ks = kickersOf(bestKey);
  let name: string;
  let detail: string;
  const seq = ks.map(lbl).join('-');
  if (cat === 0) {
    if (ks[0] === 5) { name = 'Tekerlek'; detail = `${seq} — mümkün olan en iyi düşük el!`; }
    else { name = `${lbl(ks[0])} Düşük`; detail = `${seq} (en büyük kartın küçük olması iyi)`; }
  } else {
    name = LOW_CATEGORY_NAMES[cat];
    detail = `${seq} — çift olmayan beş kart bulunamadı`;
  }
  return { score: MAX_KEY - bestKey, category: cat, name, detail, best: bestCombo.slice() };
}

export function describe(cards: CardLike[], low: boolean): HandInfo {
  return low ? describeLow(cards) : describeHigh(cards);
}

export function scoreOf(cards: CardLike[], low: boolean): number {
  return low ? scoreLow(cards) : scoreHigh(cards);
}

// ---------------------------------------------------------------------------
// El kılavuzu verileri
// ---------------------------------------------------------------------------

export const HIGH_GUIDE: { name: string; example: string; desc: string; odds: string }[] = [
  { name: 'Royal Floş', example: '10♠ J♠ Q♠ K♠ A♠', desc: 'Aynı renkte 10\'dan As\'a sıralı', odds: '%0.003' },
  { name: 'Sıralı Floş', example: '5♥ 6♥ 7♥ 8♥ 9♥', desc: 'Aynı renkte beş sıralı kart', odds: '%0.03' },
  { name: 'Kare', example: '9♣ 9♦ 9♥ 9♠ K♦', desc: 'Aynı değerde dört kart', odds: '%0.17' },
  { name: 'Ful', example: 'Q♠ Q♥ Q♦ 4♣ 4♠', desc: 'Üçlü + bir çift', odds: '%2.6' },
  { name: 'Floş', example: '2♦ 7♦ 9♦ J♦ K♦', desc: 'Aynı renkte beş kart', odds: '%3.0' },
  { name: 'Kent', example: '6♣ 7♦ 8♠ 9♥ 10♣', desc: 'Beş sıralı kart (renk fark etmez)', odds: '%4.6' },
  { name: 'Üçlü', example: '8♠ 8♥ 8♦ K♣ 3♠', desc: 'Aynı değerde üç kart', odds: '%4.8' },
  { name: 'Döper', example: 'J♣ J♦ 5♠ 5♥ A♣', desc: 'İki ayrı çift', odds: '%23.5' },
  { name: 'Per', example: '10♥ 10♠ A♦ 7♣ 2♠', desc: 'Aynı değerde iki kart', odds: '%43.8' },
  { name: 'Yüksek Kart', example: 'A♠ J♦ 8♣ 5♥ 3♠', desc: 'Hiçbiri yoksa en yüksek kart', odds: '%17.4' },
];

export const LOW_GUIDE: { name: string; example: string; desc: string; odds: string }[] = [
  { name: 'Tekerlek', example: 'A 2 3 4 5', desc: 'En iyi düşük el (kent/floş sayılmaz)', odds: '' },
  { name: '6 Düşük', example: 'A 2 3 4 6', desc: 'En büyük kartı 6 olan temiz el', odds: '' },
  { name: '7 Düşük', example: '2 3 4 5 7', desc: 'En büyük kartı 7', odds: '' },
  { name: '8 Düşük', example: 'A 3 5 6 8', desc: 'En büyük kartı 8', odds: '' },
  { name: '… 13 Düşük', example: 'A 2 3 4 K', desc: 'En büyük kart ne kadar büyükse o kadar kötü', odds: '' },
  { name: 'Per (kötü)', example: '3 3 5 7 9', desc: 'Çift içeren her el, temiz elden kötüdür', odds: '' },
  { name: 'Döper, Üçlü…', example: '', desc: 'Ne kadar çok eşleşme, o kadar kötü', odds: '' },
];

// ---------------------------------------------------------------------------
// Beklenen kartlar (yeni başlayanlar için): hangi kart elini büyütür?
// ---------------------------------------------------------------------------
export interface DrawHint {
  name: string;
  cards: string;
  outs: number;
  chance: number; // sıradaki kartta gelme olasılığı
}

export function drawHints(hole: CardLike[], board: CardLike[], dead: CardLike[] = []): DrawHint[] {
  if (hole.length < 2 || board.length < 2 || board.length >= 5) return [];
  const all = hole.concat(board);
  const cur = categoryOf(scoreHigh(all));
  const used = new Set(all.concat(dead).map((c) => (c.rank - 2) * 4 + c.suit));
  const groups = new Map<number, CardLike[]>();
  let unknown = 0;
  for (let i = 0; i < 52; i++) {
    if (used.has(i)) continue;
    unknown++;
    const c = { rank: Math.floor(i / 4) + 2, suit: i % 4 };
    const cat = categoryOf(scoreHigh(all.concat([c])));
    if (cat <= cur || cat < 3) continue;
    // sadece yerdeki kartlarla oluşuyorsa rakip de faydalanır, sayma
    const boardCat = categoryOf(scoreHigh(board.concat([c])));
    if (boardCat >= cat) continue;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(c);
  }
  const out: DrawHint[] = [];
  for (const [cat, cards] of [...groups.entries()].sort((a, b) => b[0] - a[0])) {
    const suits = new Set(cards.map((c) => c.suit));
    let txt: string;
    if (cat === 5 && suits.size === 1 && cards.length >= 7) txt = `herhangi bir ${SUIT_SYMBOLS[cards[0].suit]}`;
    else {
      const ranks = [...new Set(cards.map((c) => c.rank))].sort((a, b) => a - b);
      txt = ranks.map((r) => RANK_LABELS[r]).join(', ');
    }
    out.push({ name: HIGH_CATEGORY_NAMES[cat === 8 && cards.every((c) => c.rank >= 10) ? 8 : cat], cards: txt, outs: cards.length, chance: cards.length / unknown });
  }
  return out.slice(0, 3);
}
