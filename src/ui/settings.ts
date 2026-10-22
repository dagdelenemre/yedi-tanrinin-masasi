import { save, store } from './dom';

export type Pace = 'agir' | 'orta' | 'cabuk';
export const PACE_LABEL: Record<Pace, string> = { agir: 'Ağır', orta: 'Orta', cabuk: 'Çabuk' };
const FACTOR: Record<Pace, number> = { agir: 1.45, orta: 1, cabuk: 0.6 };

let pace: Pace = store<Pace>('ytm-pace', 'orta');

export function getPace(): Pace {
  return pace;
}

export function setPace(p: Pace) {
  pace = p;
  save('ytm-pace', p);
}

export function nextPace(): Pace {
  const order: Pace[] = ['agir', 'orta', 'cabuk'];
  setPace(order[(order.indexOf(pace) + 1) % order.length]);
  return pace;
}

/** Tempoya göre ölçeklenmiş süre (ms) */
export function T(ms: number): number {
  return Math.round(ms * FACTOR[pace]);
}

export function paceFactor(): number {
  return FACTOR[pace];
}
