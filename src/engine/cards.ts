export type Suit = 0 | 1 | 2 | 3; // 0 ♠, 1 ♥, 2 ♦, 3 ♣

export interface Card {
  rank: number; // 2..14 (14 = As)
  suit: Suit;
  uid: number; // animasyon/kimlik için benzersiz
}

export const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'];
export const SUIT_NAMES = ['Maça', 'Kupa', 'Karo', 'Sinek'];
export const RANK_LABELS: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};
export const RANK_NAMES: Record<number, string> = {
  1: 'As', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8',
  9: '9', 10: '10', 11: 'Vale', 12: 'Kız', 13: 'Papaz', 14: 'As',
};

let uidCounter = 1;

export function makeCard(rank: number, suit: Suit): Card {
  return { rank, suit, uid: uidCounter++ };
}

export function cloneCard(c: Card): Card {
  return { rank: c.rank, suit: c.suit, uid: c.uid };
}

export function isRed(suit: Suit): boolean {
  return suit === 1 || suit === 2;
}

export function cardLabel(c: Card): string {
  return RANK_LABELS[c.rank] + SUIT_SYMBOLS[c.suit];
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function freshDeck(): Card[] {
  const d: Card[] = [];
  for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) d.push(makeCard(r, s as Suit));
  return d;
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 0..51 kodlama — hızlı hesaplamalar için */
export function code(c: { rank: number; suit: number }): number {
  return (c.rank - 2) * 4 + c.suit;
}
