import { shuffle } from './cards';
import { GameId, GODS, GOD_ORDER } from './gods';
import { EntrantId, Participant, randomGodGame } from './match';

export const START_STACK = 20;

export interface BracketMatch {
  a: EntrantId;
  b: EntrantId;
  game: GameId;
  winner?: EntrantId;
  /** kazananın maç sonu puanı */
  finalStack?: number;
}

export class Tournament {
  entrants: Record<EntrantId, Participant>;
  rounds: BracketMatch[][] = [];
  round = 0;
  jokerUsed = false;
  playerOut = false;

  constructor(playerName = 'Hizmetçi') {
    this.entrants = { player: { id: 'player', name: playerName, stack: START_STACK } } as Record<EntrantId, Participant>;
    for (const g of GOD_ORDER) this.entrants[g] = { id: g, name: GODS[g].name, stack: START_STACK };
    const order = shuffle<EntrantId>(['player', ...GOD_ORDER]);
    const first: BracketMatch[] = [];
    for (let i = 0; i < 8; i += 2) first.push({ a: order[i], b: order[i + 1], game: randomGodGame() });
    this.rounds.push(first);
  }

  get roundName(): string {
    return ['Çeyrek Final', 'Yarı Final', 'Final'][this.round] ?? '';
  }

  get current(): BracketMatch[] {
    return this.rounds[this.round];
  }

  get playerMatch(): BracketMatch | undefined {
    return this.current?.find((m) => m.a === 'player' || m.b === 'player');
  }

  get finished(): boolean {
    return this.round >= 3 || this.playerOut;
  }

  get champion(): EntrantId | undefined {
    return this.rounds[2]?.[0]?.winner;
  }

  recordResult(m: BracketMatch, winner: EntrantId) {
    const loser = m.a === winner ? m.b : m.a;
    const w = this.entrants[winner];
    const l = this.entrants[loser];
    // iflas eden rakibin bütün puanı kazananda (sim maçlarında toplam korunur)
    w.stack = w.stack + l.stack;
    l.stack = 0;
    m.winner = winner;
    m.finalStack = w.stack;
    if (loser === 'player') this.playerOut = true;
  }

  /** Oyuncunun maçında puanlar zaten güncellendiyse */
  recordPlayed(m: BracketMatch, winner: EntrantId, stacks: Record<string, number>) {
    for (const id of [m.a, m.b]) this.entrants[id].stack = stacks[id];
    const loser = m.a === winner ? m.b : m.a;
    this.entrants[winner].stack += this.entrants[loser].stack;
    this.entrants[loser].stack = 0;
    m.winner = winner;
    m.finalStack = this.entrants[winner].stack;
    if (loser === 'player') this.playerOut = true;
  }

  advance() {
    const winners = this.current.map((m) => m.winner!);
    this.round++;
    if (this.round >= 3) return;
    const next: BracketMatch[] = [];
    for (let i = 0; i < winners.length; i += 2) next.push({ a: winners[i], b: winners[i + 1], game: randomGodGame() });
    this.rounds.push(next);
  }
}
