import { CardLike, scoreHigh, scoreLow } from './evaluator';

export interface EquityQuery {
  /** Bilinen kendi kartlarım (Veyla oyununda boş olabilir) */
  mine: CardLike[];
  /** Rakibin bilinen kartları */
  opp: CardLike[];
  /** Açık yer kartları */
  board: CardLike[];
  /** Sıradaki bilinen kartlar (Oris'in kehaneti) */
  next?: CardLike[];
  /** Oyundan çıkmış bilinen kartlar (yakılanlar vb.) */
  dead?: CardLike[];
  low: boolean;
  samples?: number;
}

export interface EquityResult {
  win: number;
  tie: number;
  lose: number;
  /** pot payı = win + tie/2 */
  share: number;
}

function code(c: CardLike) {
  return (c.rank - 2) * 4 + c.suit;
}

export function equity(q: EquityQuery): EquityResult {
  const samples = q.samples ?? 600;
  const used = new Uint8Array(52);
  const mark = (arr?: CardLike[]) => arr?.forEach((c) => (used[code(c)] = 1));
  mark(q.mine); mark(q.opp); mark(q.board); mark(q.next); mark(q.dead);
  const deck: CardLike[] = [];
  for (let i = 0; i < 52; i++) if (!used[i]) deck.push({ rank: Math.floor(i / 4) + 2, suit: i % 4 });

  const needMine = Math.max(0, 2 - q.mine.length);
  const needOpp = Math.max(0, 2 - q.opp.length);
  const fixedBoard = q.board.concat(q.next ?? []).slice(0, 5);
  const needBoard = 5 - fixedBoard.length;
  const need = needMine + needOpp + needBoard;
  const score = q.low ? scoreLow : scoreHigh;

  let win = 0, tie = 0, lose = 0;
  const me: CardLike[] = new Array(7);
  const op: CardLike[] = new Array(7);
  const n = deck.length;
  if (need > n) return { win: 0.5, tie: 0, lose: 0.5, share: 0.5 };

  for (let s = 0; s < samples; s++) {
    // kısmi Fisher-Yates
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(Math.random() * (n - i));
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    let k = 0;
    let mi = 0, oi = 0;
    for (const c of q.mine) me[mi++] = c;
    for (let i = 0; i < needMine; i++) me[mi++] = deck[k++];
    for (const c of q.opp) op[oi++] = c;
    for (let i = 0; i < needOpp; i++) op[oi++] = deck[k++];
    for (const c of fixedBoard) { me[mi++] = c; op[oi++] = c; }
    for (let i = 0; i < needBoard; i++) { const c = deck[k++]; me[mi++] = c; op[oi++] = c; }
    me.length = mi; op.length = oi;
    const a = score(me), b = score(op);
    if (a > b) win++; else if (a < b) lose++; else tie++;
  }
  const t = samples;
  return { win: win / t, tie: tie / t, lose: lose / t, share: (win + tie / 2) / t };
}

// ---------------------------------------------------------------------------
// Çok oyunculu kazanma şansı (2-4 kişi)
// ---------------------------------------------------------------------------
export interface MultiEquityQuery {
  mine: CardLike[];
  /** her canlı rakibin bilinen kartları (bilinmiyorsa boş dizi) */
  opps: CardLike[][];
  board: CardLike[];
  next?: CardLike[];
  dead?: CardLike[];
  low: boolean;
  samples?: number;
}

export function equityMulti(q: MultiEquityQuery): EquityResult {
  if (q.opps.length === 1) return equity({ mine: q.mine, opp: q.opps[0], board: q.board, next: q.next, dead: q.dead, low: q.low, samples: q.samples });
  const samples = q.samples ?? 600;
  const used = new Uint8Array(52);
  const mark = (arr?: CardLike[]) => arr?.forEach((c) => (used[code(c)] = 1));
  mark(q.mine); q.opps.forEach(mark); mark(q.board); mark(q.next); mark(q.dead);
  const deck: CardLike[] = [];
  for (let i = 0; i < 52; i++) if (!used[i]) deck.push({ rank: Math.floor(i / 4) + 2, suit: i % 4 });
  const fixedBoard = q.board.concat(q.next ?? []).slice(0, 5);
  const needBoard = 5 - fixedBoard.length;
  const needMine = Math.max(0, 2 - q.mine.length);
  const needOpp = q.opps.map((o) => Math.max(0, 2 - o.length));
  const need = needMine + needBoard + needOpp.reduce((a, b) => a + b, 0);
  const n = deck.length;
  if (need > n || q.opps.length === 0) return { win: 1, tie: 0, lose: 0, share: 1 };
  const score = q.low ? scoreLow : scoreHigh;
  let win = 0, tie = 0, lose = 0, share = 0;
  for (let s = 0; s < samples; s++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(Math.random() * (n - i));
      const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
    }
    let k = 0;
    const board = fixedBoard.slice();
    for (let i = 0; i < needBoard; i++) board.push(deck[k++]);
    const me = q.mine.slice();
    for (let i = 0; i < needMine; i++) me.push(deck[k++]);
    const my = score(me.concat(board));
    let best = -1, ties = 0;
    for (let o = 0; o < q.opps.length; o++) {
      const oh = q.opps[o].slice();
      for (let i = 0; i < needOpp[o]; i++) oh.push(deck[k++]);
      const sc = score(oh.concat(board));
      if (sc > best) { best = sc; ties = 0; }
      if (sc === best) ties++;
    }
    if (my > best) { win++; share += 1; }
    else if (my === best) { tie++; share += 1 / (ties + 1); }
    else lose++;
  }
  return { win: win / samples, tie: tie / samples, lose: lose / samples, share: share / samples };
}
