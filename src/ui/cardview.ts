import { CardLike } from '../engine/evaluator';
import { RANK_LABELS, SUIT_SYMBOLS } from '../engine/cards';
import { cardBackSVG } from './art';
import { h } from './dom';

const COURT: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K' };

let backCache = '';
function back() {
  if (!backCache) backCache = cardBackSVG();
  return backCache;
}

export function faceHTML(c: CardLike): string {
  const r = RANK_LABELS[c.rank];
  const s = SUIT_SYMBOLS[c.suit];
  const center = COURT[c.rank]
    ? `<div class="court"><span class="court-letter">${COURT[c.rank]}</span><span class="court-suit">${s}</span></div>`
    : c.rank === 14
      ? `<div class="ace">${s}</div>`
      : `<div class="pip">${s}</div>`;
  return `<div class="corner tl"><b>${r}</b><i>${s}</i></div>${center}<div class="corner br"><b>${r}</b><i>${s}</i></div>`;
}

export function suitClass(suit: number) {
  return suit === 1 || suit === 2 ? 'red' : 'black';
}

export function createCardEl(): HTMLDivElement {
  const el = h('div', { class: 'card down' });
  const inner = h('div', { class: 'card-inner' });
  const front = h('div', { class: 'face front' });
  const bk = h('div', { class: 'face back', html: back() });
  inner.append(front, bk);
  el.append(inner);
  return el;
}

export function setCardFace(el: HTMLElement, c: CardLike | null) {
  const front = el.querySelector('.front') as HTMLElement;
  if (!c) {
    front.innerHTML = '';
    front.className = 'face front';
    return;
  }
  front.className = 'face front ' + suitClass(c.suit);
  front.innerHTML = faceHTML(c);
}

/** Küçük metin kartı (kılavuz/log için) */
export function miniCards(text: string): string {
  // "10♠ J♠" gibi metni renkli spanlara çevirir
  return text.replace(/(10|[2-9JQKA])?([♠♥♦♣])/g, (_m, r, s) => {
    const red = s === '♥' || s === '♦';
    return `<span class="mc ${red ? 'red' : ''}">${r ?? ''}${s}</span>`;
  });
}
