import { Card, freshDeck, shuffle } from './cards';
import { CardLike, HandInfo, describe, scoreOf } from './evaluator';
import { GameId, GAMES } from './gods';
import { Action, FLIP_SUIT, LAST_STREET, Legal, Street, SwapChoice } from './hand';

// ---------------------------------------------------------------------------
// 2-4 oyunculu el motoru (online mod). Tek kişilik oyunun motoru (hand.ts) ayrıdır.
// ---------------------------------------------------------------------------

export interface MSeat {
  name: string;
  stack: number;
  hole: Card[];
  folded: boolean;
  allIn: boolean;
  streetBet: number;
  totalBet: number;
  refunded: number;
  lastBet: { amount: number; street: Street } | null;
  used: { burn: boolean; refund: boolean; peek: boolean; flip: boolean; swap: boolean };
  peek: Card | null;
  revealed: boolean[];
  privateDead: Card[];
}

export interface MController {
  act(engine: MultiHandEngine, seat: number): Promise<Action>;
  chooseSwap(engine: MultiHandEngine, seat: number): Promise<SwapChoice | null>;
}

export interface PotResult {
  amount: number;
  winners: number[];
  shares: number[];
}

export type MEvent =
  | { type: 'start' }
  | { type: 'dice'; rolls: (number | null)[]; tie: boolean; context: 'hand' | 'swap' }
  | { type: 'steal'; from: number; to: number; amount: number }
  | { type: 'blind'; seat: number; amount: number }
  | { type: 'deal' }
  | { type: 'swapStart' }
  | { type: 'swapConflict'; board: number; seats: number[]; kept: number[]; winner: number; byDice: boolean }
  | { type: 'swap'; seat: number; hand: number; board: number }
  | { type: 'swapDraw'; seat: number; hand: number; old: Card }
  | { type: 'swapNone' }
  | { type: 'cardsReady' }
  | { type: 'reveal'; street: Street }
  | { type: 'act'; seat: number; kind: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'; amount: number; to: number }
  | { type: 'uncalled'; seat: number; amount: number }
  | { type: 'collect' }
  | { type: 'burn'; seat: number; index: number; old: Card }
  | { type: 'refund'; seat: number; amount: number }
  | { type: 'peek'; seat: number; card: Card }
  | { type: 'flip'; seat: number }
  | { type: 'showdown'; infos: (HandInfo | null)[] }
  | { type: 'win'; pots: PotResult[]; reason: 'fold' | 'showdown' }
  | { type: 'end' };

export interface MultiConfig {
  game: GameId;
  stacks: number[];
  names: string[];
  dealer: number;
  sb: number;
  bb: number;
  controllers: MController[];
  emit?: (e: MEvent) => Promise<void> | void;
}

export interface MKnowledge {
  mine: CardLike[];
  /** canlı rakiplerin (sırayla) bilinen kartları */
  opps: CardLike[][];
  oppSeats: number[];
  board: CardLike[];
  next: CardLike[];
  dead: CardLike[];
}

export class MultiHandEngine {
  readonly game: GameId;
  readonly low: boolean;
  readonly n: number;
  readonly dealer: number;
  readonly sb: number;
  readonly bb: number;
  seats: MSeat[];
  board: Card[] = [];
  pending: Card[] = [];
  deck: Card[];
  burned: Card[] = [];
  street: Street = 0;
  currentBet = 0;
  minRaise = 0;
  actor = -1;
  phase: 'dice' | 'deal' | 'swap' | 'betting' | 'showdown' | 'done' = 'deal';
  showdownInfos: (HandInfo | null)[] = [];
  private controllers: MController[];
  private emitFn: (e: MEvent) => Promise<void> | void;

  constructor(cfg: MultiConfig) {
    this.game = cfg.game;
    this.low = !!GAMES[cfg.game].low;
    this.n = cfg.stacks.length;
    this.dealer = cfg.dealer;
    this.sb = cfg.sb;
    this.bb = cfg.bb;
    this.controllers = cfg.controllers;
    this.emitFn = cfg.emit ?? (() => {});
    this.deck = shuffle(freshDeck());
    this.seats = cfg.stacks.map((stack, i) => ({
      name: cfg.names[i],
      stack,
      hole: [],
      folded: false,
      allIn: false,
      streetBet: 0,
      totalBet: 0,
      refunded: 0,
      lastBet: null,
      used: { burn: false, refund: false, peek: false, flip: false, swap: false },
      peek: null,
      revealed: [false, false],
      privateDead: [],
    }));
    this.showdownInfos = this.seats.map(() => null);
  }

  get pot(): number {
    return this.seats.reduce((a, s) => a + s.totalBet, 0);
  }

  get collectedPot(): number {
    return this.pot - this.seats.reduce((a, s) => a + s.streetBet, 0);
  }

  next(i: number): number {
    return (i + 1) % this.n;
  }

  get sbSeat(): number {
    return this.n === 2 ? this.dealer : this.next(this.dealer);
  }

  get bbSeat(): number {
    return this.n === 2 ? this.next(this.dealer) : this.next(this.next(this.dealer));
  }

  seesOwnCards(_i: number): boolean {
    if (this.game === 'veyla') return false;
    if (this.game === 'kesh' && (this.phase === 'deal' || this.phase === 'swap')) return false;
    return true;
  }

  private async emit(e: MEvent) {
    await this.emitFn(e);
  }

  private canAct(i: number) {
    const s = this.seats[i];
    return !s.folded && !s.allIn;
  }

  private liveCount() {
    return this.seats.filter((s) => !s.folded).length;
  }

  private put(i: number, amount: number) {
    const s = this.seats[i];
    const a = Math.min(amount, s.stack);
    s.stack -= a;
    s.streetBet += a;
    s.totalBet += a;
    if (s.stack === 0) s.allIn = true;
    return a;
  }

  knowledge(i: number): MKnowledge {
    const me = this.seats[i];
    const veyla = this.game === 'veyla';
    const mine = this.seesOwnCards(i) ? me.hole.slice() : me.hole.filter((_, k) => me.revealed[k]);
    const opps: CardLike[][] = [];
    const oppSeats: number[] = [];
    const dead: CardLike[] = this.burned.concat(me.privateDead);
    this.seats.forEach((s, j) => {
      if (j === i) return;
      const known = veyla ? s.hole.slice() : s.hole.filter((_, k) => s.revealed[k]);
      if (s.folded) dead.push(...known);
      else {
        opps.push(known);
        oppSeats.push(j);
      }
    });
    const next: CardLike[] = [];
    if (me.peek && this.pending[0] && this.pending[0].uid === me.peek.uid) next.push(me.peek);
    return { mine, opps, oppSeats, board: this.board.slice(), next, dead };
  }

  legal(i: number): Legal {
    const s = this.seats[i];
    const toCall = Math.max(0, Math.min(this.currentBet - s.streetBet, s.stack));
    const maxRaiseTo = s.streetBet + s.stack;
    const othersCanAct = this.seats.some((o, j) => j !== i && !o.folded && !o.allIn);
    const canRaise = othersCanAct && s.stack > toCall;
    const minRaiseTo = Math.min(maxRaiseTo, this.currentBet + Math.max(this.minRaise, this.bb));
    const g = this.game;
    let refund = 0;
    if (g === 'kronvel' && !s.used.refund && s.lastBet && s.lastBet.street < this.street) refund = Math.round(s.lastBet.amount / 2);
    return {
      toCall,
      canCheck: toCall === 0,
      canRaise,
      minRaiseTo,
      maxRaiseTo,
      currentBet: this.currentBet,
      abilities: {
        burn: g === 'veyla' && !s.used.burn && this.board.length > 0 && this.deck.length > 0,
        refund,
        peek: g === 'oris' && !s.used.peek && this.pending.length > 0,
        flip: g === 'prisma' && !s.used.flip,
      },
    };
  }

  // -------------------------------------------------------------------------
  async play(): Promise<PotResult[]> {
    await this.emit({ type: 'start' });
    if (this.game === 'barbaz') {
      this.phase = 'dice';
      await this.dicePhase();
      if (this.seats.some((s) => s.stack === 0)) {
        // zar birini iflas ettirdi: el oynanmaz
        this.phase = 'done';
        await this.emit({ type: 'end' });
        return [];
      }
    }

    this.phase = 'deal';
    const a1 = this.put(this.sbSeat, this.sb);
    await this.emit({ type: 'blind', seat: this.sbSeat, amount: a1 });
    const a2 = this.put(this.bbSeat, this.bb);
    await this.emit({ type: 'blind', seat: this.bbSeat, amount: a2 });
    this.currentBet = Math.max(...this.seats.map((s) => s.streetBet));
    this.minRaise = this.bb;

    for (let k = 0; k < 2; k++) {
      let i = this.next(this.dealer);
      for (let c = 0; c < this.n; c++) {
        this.seats[i].hole.push(this.deck.shift()!);
        i = this.next(i);
      }
    }
    for (let k = 0; k < 5; k++) this.pending.push(this.deck.shift()!);
    await this.emit({ type: 'deal' });

    if (this.game === 'kesh') await this.blindSwapPhase();
    this.phase = 'betting';
    await this.emit({ type: 'cardsReady' });

    const firstPre = this.n === 2 ? this.dealer : this.next(this.bbSeat);
    await this.bettingRound(firstPre);
    for (let st = 1; st <= LAST_STREET; st++) {
      if (this.liveCount() < 2) break;
      await this.endStreet();
      await this.revealNext();
      if (this.seats.filter((s) => !s.folded && !s.allIn).length >= 2) await this.bettingRound(this.firstPost());
    }
    await this.endStreet();
    return this.finish();
  }

  private firstPost(): number {
    let i = this.n === 2 ? this.bbSeat : this.next(this.dealer);
    for (let c = 0; c < this.n; c++) {
      if (this.canAct(i)) return i;
      i = this.next(i);
    }
    return i;
  }

  private async revealNext() {
    this.street = (this.street + 1) as Street;
    this.board.push(this.pending.shift()!);
    await this.emit({ type: 'reveal', street: this.street });
  }

  private async endStreet() {
    // karşılıksız bahis: en yüksek bahis tek kişideyse farkı iade et
    const bets = this.seats.map((s) => s.streetBet);
    const max = Math.max(...bets);
    const holders = bets.filter((b) => b === max).length;
    if (max > 0 && holders === 1) {
      const second = Math.max(0, ...bets.filter((b) => b !== max));
      const i = bets.indexOf(max);
      const diff = max - second;
      const s = this.seats[i];
      s.streetBet -= diff;
      s.totalBet -= diff;
      s.stack += diff;
      if (s.stack > 0) s.allIn = false;
      if (!s.folded && this.liveCount() > 1) await this.emit({ type: 'uncalled', seat: i, amount: diff });
    }
    if (this.seats.some((s) => s.streetBet)) {
      this.seats.forEach((s) => (s.streetBet = 0));
      await this.emit({ type: 'collect' });
    }
    this.currentBet = 0;
    this.minRaise = this.bb;
  }

  private async bettingRound(first: number) {
    const needs = this.seats.map((_, i) => this.canAct(i));
    let actor = first;
    let guard = 0;
    while (needs.some(Boolean) && guard++ < 1000) {
      if (this.liveCount() < 2) break;
      if (!needs[actor] || !this.canAct(actor)) {
        needs[actor] = false;
        actor = this.next(actor);
        continue;
      }
      const L = this.legal(actor);
      const othersCanAct = this.seats.some((o, j) => j !== actor && !o.folded && !o.allIn);
      if (!othersCanAct && L.toCall === 0) {
        needs[actor] = false;
        actor = this.next(actor);
        continue;
      }
      this.actor = actor;
      const a = await this.controllers[actor].act(this, actor);
      if (await this.applyAbility(actor, a)) continue;
      const s = this.seats[actor];
      const L2 = this.legal(actor);
      if (a.type === 'fold' && L2.toCall > 0) {
        s.folded = true;
        needs[actor] = false;
        await this.emit({ type: 'act', seat: actor, kind: 'fold', amount: 0, to: s.streetBet });
      } else if (a.type === 'check' || a.type === 'fold' || (a.type === 'call' && L2.toCall === 0)) {
        needs[actor] = false;
        await this.emit({ type: 'act', seat: actor, kind: 'check', amount: 0, to: s.streetBet });
      } else if (a.type === 'call' || (a.type === 'raise' && !L2.canRaise)) {
        const amt = this.put(actor, L2.toCall);
        s.lastBet = { amount: amt, street: this.street };
        needs[actor] = false;
        await this.emit({ type: 'act', seat: actor, kind: s.allIn ? 'allin' : 'call', amount: amt, to: s.streetBet });
      } else if (a.type === 'raise') {
        const to = Math.max(L2.minRaiseTo, Math.min(L2.maxRaiseTo, Math.round(a.to)));
        const wasBet = this.currentBet === 0;
        const amt = this.put(actor, to - s.streetBet);
        const raiseSize = s.streetBet - this.currentBet;
        if (raiseSize >= this.minRaise) this.minRaise = raiseSize;
        this.currentBet = Math.max(this.currentBet, s.streetBet);
        s.lastBet = { amount: amt, street: this.street };
        this.seats.forEach((_, j) => (needs[j] = j !== actor && this.canAct(j)));
        needs[actor] = false;
        await this.emit({ type: 'act', seat: actor, kind: s.allIn ? 'allin' : wasBet ? 'bet' : 'raise', amount: amt, to: s.streetBet });
      }
      actor = this.next(actor);
    }
    this.actor = -1;
  }

  private async applyAbility(i: number, a: Action): Promise<boolean> {
    const s = this.seats[i];
    const L = this.legal(i);
    switch (a.type) {
      case 'burn': {
        if (!L.abilities.burn || !this.board[a.index]) return true;
        const old = this.board[a.index];
        this.board[a.index] = this.deck.shift()!;
        this.burned.push(old);
        s.used.burn = true;
        await this.emit({ type: 'burn', seat: i, index: a.index, old });
        return true;
      }
      case 'refund': {
        if (!L.abilities.refund) return true;
        const amt = Math.min(L.abilities.refund, s.totalBet);
        s.stack += amt;
        s.totalBet -= amt;
        s.refunded += amt;
        s.lastBet = null;
        s.used.refund = true;
        await this.emit({ type: 'refund', seat: i, amount: amt });
        return true;
      }
      case 'peek': {
        if (!L.abilities.peek) return true;
        s.peek = this.pending[0];
        s.used.peek = true;
        await this.emit({ type: 'peek', seat: i, card: s.peek });
        return true;
      }
      case 'flip': {
        if (!L.abilities.flip) return true;
        for (const c of s.hole) c.suit = FLIP_SUIT[c.suit];
        s.used.flip = true;
        await this.emit({ type: 'flip', seat: i });
        return true;
      }
    }
    return false;
  }

  /** Verilen oyuncular arasında zar: en yüksek ve en düşük tekil olana dek eşitler tekrar atar */
  private async diceAmong(players: number[], context: 'hand' | 'swap', wantLow: boolean): Promise<{ high: number; low: number }> {
    const roll = () => 1 + Math.floor(Math.random() * 6);
    const rollFor = async (who: number[]) => {
      const rolls: (number | null)[] = this.seats.map(() => null);
      who.forEach((i) => (rolls[i] = roll()));
      const vals = who.map((i) => rolls[i]!);
      const tie = new Set(vals).size < vals.length;
      await this.emit({ type: 'dice', rolls, tie, context });
      return rolls;
    };
    let rolls = await rollFor(players);
    const pickExtreme = async (cands: number[], sign: 1 | -1): Promise<number> => {
      let cur = cands;
      let r = rolls;
      let guard = 0;
      for (;;) {
        const best = sign > 0 ? Math.max(...cur.map((i) => r[i]!)) : Math.min(...cur.map((i) => r[i]!));
        const top = cur.filter((i) => r[i] === best);
        if (top.length === 1 || guard++ > 30) return top[0];
        cur = top;
        r = await rollFor(cur);
      }
    };
    const high = await pickExtreme(players, 1);
    const rest = players.filter((i) => i !== high);
    const low = wantLow && rest.length ? await pickExtreme(rest, -1) : rest[0] ?? high;
    return { high, low };
  }

  private async dicePhase() {
    const players = this.seats.map((_, i) => i);
    const { high, low } = await this.diceAmong(players, 'hand', true);
    const amt = Math.round(this.seats[low].stack * 0.1);
    if (amt > 0) {
      this.seats[low].stack -= amt;
      this.seats[high].stack += amt;
    }
    await this.emit({ type: 'steal', from: low, to: high, amount: amt });
  }

  private async blindSwapPhase() {
    this.phase = 'swap';
    await this.emit({ type: 'swapStart' });
    const raw = await Promise.all(this.seats.map((_, i) => this.controllers[i].chooseSwap(this, i)));
    const choices = raw.map((c) => (c && (c.hand === 0 || c.hand === 1) && c.board >= 0 && c.board < this.pending.length ? c : null));
    choices.forEach((c, i) => (this.seats[i].used.swap = !!c));
    if (choices.every((c) => !c)) {
      await this.emit({ type: 'swapNone' });
      return;
    }
    // yer kartına göre grupla
    const groups = new Map<number, number[]>();
    choices.forEach((c, i) => {
      if (!c) return;
      if (!groups.has(c.board)) groups.set(c.board, []);
      groups.get(c.board)!.push(i);
    });
    for (const [board, seatsIn] of groups) {
      if (seatsIn.length === 1) {
        const i = seatsIn[0];
        const c = choices[i]!;
        const s = this.seats[i];
        const t = s.hole[c.hand];
        s.hole[c.hand] = this.pending[board];
        this.pending[board] = t;
        await this.emit({ type: 'swap', seat: i, hand: c.hand, board });
        continue;
      }
      // çakışma: tutulan kartlar açılır, en büyüğü alır
      const kept = seatsIn.map((i) => 1 - choices[i]!.hand);
      seatsIn.forEach((i, k) => (this.seats[i].revealed[kept[k]] = true));
      const ranks = seatsIn.map((i, k) => this.seats[i].hole[kept[k]].rank);
      const best = Math.max(...ranks);
      const top = seatsIn.filter((_, k) => ranks[k] === best);
      let winner = top.length === 1 ? top[0] : -1;
      await this.emit({ type: 'swapConflict', board, seats: seatsIn, kept, winner, byDice: false });
      if (winner === -1) {
        winner = (await this.diceAmong(top, 'swap', false)).high;
        await this.emit({ type: 'swapConflict', board, seats: seatsIn, kept, winner, byDice: true });
      }
      const wc = choices[winner]!;
      const ws = this.seats[winner];
      const t = ws.hole[wc.hand];
      ws.hole[wc.hand] = this.pending[board];
      this.pending[board] = t;
      await this.emit({ type: 'swap', seat: winner, hand: wc.hand, board });
      for (const i of seatsIn) {
        if (i === winner) continue;
        const c = choices[i]!;
        const s = this.seats[i];
        const old = s.hole[c.hand];
        s.privateDead.push(old);
        s.hole[c.hand] = this.deck.shift()!;
        await this.emit({ type: 'swapDraw', seat: i, hand: c.hand, old });
      }
    }
  }

  /** Yan potlar. Kronvel iadeleri pot hakkını azaltmaz; iade edilen puan ana pottan düşülür. */
  private buildPots(): { amount: number; eligible: number[] }[] {
    const contrib = this.seats.map((s) => s.totalBet + s.refunded);
    const pots: { amount: number; eligible: number[] }[] = [];
    while (contrib.some((c) => c > 0)) {
      const live = contrib.map((c, i) => i).filter((i) => contrib[i] > 0 && !this.seats[i].folded);
      const m = live.length ? Math.min(...live.map((i) => contrib[i])) : Math.max(...contrib);
      let amt = 0;
      for (let i = 0; i < contrib.length; i++) {
        const t = Math.min(contrib[i], m);
        amt += t;
        contrib[i] -= t;
      }
      if (live.length) pots.push({ amount: amt, eligible: live });
      else if (pots.length) pots[pots.length - 1].amount += amt;
    }
    let refunds = this.seats.reduce((a, s) => a + s.refunded, 0);
    for (const p of pots) {
      const d = Math.min(refunds, p.amount);
      p.amount -= d;
      refunds -= d;
    }
    return pots.filter((p) => p.amount > 0);
  }

  private async finish(): Promise<PotResult[]> {
    const live = this.seats.map((s, i) => i).filter((i) => !this.seats[i].folded);
    if (live.length === 1) {
      const w = live[0];
      const total = this.pot;
      this.seats[w].stack += total;
      this.seats.forEach((s) => (s.totalBet = 0));
      const res = [{ amount: total, winners: [w], shares: [total] }];
      await this.emit({ type: 'win', pots: res, reason: 'fold' });
      this.phase = 'done';
      await this.emit({ type: 'end' });
      return res;
    }
    while (this.pending.length) await this.revealNext();
    this.phase = 'showdown';
    const scores = this.seats.map((s) => (s.folded ? -1 : scoreOf(s.hole.concat(this.board), this.low)));
    this.showdownInfos = this.seats.map((s) => (s.folded ? null : describe(s.hole.concat(this.board), this.low)));
    await this.emit({ type: 'showdown', infos: this.showdownInfos });
    const results: PotResult[] = [];
    for (const p of this.buildPots()) {
      const best = Math.max(...p.eligible.map((i) => scores[i]));
      const winners = p.eligible.filter((i) => scores[i] === best);
      const each = Math.floor(p.amount / winners.length);
      let odd = p.amount - each * winners.length;
      // artık puan krupiyenin solundaki ilk kazanana
      const order: number[] = [];
      for (let k = 1; k <= this.n; k++) order.push((this.dealer + k) % this.n);
      const sorted = order.filter((i) => winners.includes(i));
      const shares = sorted.map(() => each);
      for (let k = 0; odd > 0; k = (k + 1) % shares.length, odd--) shares[k]++;
      sorted.forEach((i, k) => (this.seats[i].stack += shares[k]));
      results.push({ amount: p.amount, winners: sorted, shares });
    }
    this.seats.forEach((s) => (s.totalBet = 0));
    await this.emit({ type: 'win', pots: results, reason: 'showdown' });
    this.phase = 'done';
    await this.emit({ type: 'end' });
    return results;
  }
}
