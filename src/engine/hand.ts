import { Card, Suit, freshDeck, shuffle } from './cards';
import { CardLike, HandInfo, describe, scoreOf } from './evaluator';
import { GameId, GAMES } from './gods';

/** 0 = açılış öncesi, 1..5 = yere açılan kart sayısı */
export type Street = 0 | 1 | 2 | 3 | 4 | 5;
export const LAST_STREET = 5;
export const STREET_NAMES = ['Açılış Öncesi', 'Birinci Kart', 'İkinci Kart', 'Üçüncü Kart', 'Dördüncü Kart', 'Beşinci Kart'];

/** Simya: renk çevrilince kart eş tipine geçer (♠↔♥, ♦↔♣) */
export const FLIP_SUIT: Record<number, Suit> = { 0: 1, 1: 0, 2: 3, 3: 2 };

export type BetAction =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  | { type: 'raise'; to: number };
export type AbilityAction =
  | { type: 'burn'; index: number }
  | { type: 'refund' }
  | { type: 'peek' }
  | { type: 'flip' };
export type Action = BetAction | AbilityAction;

export interface SwapChoice {
  hand: number; // 0 | 1
  board: number; // 0..4 (kapalı yer kartı)
}

export interface SeatState {
  name: string;
  stack: number;
  hole: Card[];
  folded: boolean;
  allIn: boolean;
  streetBet: number;
  totalBet: number;
  lastBet: { amount: number; street: Street } | null;
  used: { burn: boolean; refund: boolean; peek: boolean; flip: boolean; swap: boolean };
  peek: Card | null;
  revealed: boolean[];
  privateDead: Card[];
}

export interface Controller {
  act(engine: HandEngine, seat: number): Promise<Action>;
  chooseSwap(engine: HandEngine, seat: number): Promise<SwapChoice | null>;
}

export type HandEvent =
  | { type: 'start' }
  | { type: 'dice'; rolls: [number, number]; tie: boolean; context: 'hand' | 'swap' }
  | { type: 'steal'; from: number; to: number; amount: number }
  | { type: 'blind'; seat: number; amount: number }
  | { type: 'deal' }
  | { type: 'cardsReady' }
  | { type: 'reveal'; street: Street }
  | { type: 'act'; seat: number; kind: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'; amount: number; to: number }
  | { type: 'uncalled'; seat: number; amount: number }
  | { type: 'collect' }
  | { type: 'burn'; seat: number; index: number; old: Card }
  | { type: 'refund'; seat: number; amount: number }
  | { type: 'peek'; seat: number; card: Card }
  | { type: 'flip'; seat: number }
  | { type: 'swapStart' }
  | { type: 'swapConflict'; board: number; kept: [number, number]; winner: number; byDice: boolean }
  | { type: 'swap'; seat: number; hand: number; board: number }
  | { type: 'swapDraw'; seat: number; hand: number; old: Card }
  | { type: 'swapNone' }
  | { type: 'showdown'; infos: (HandInfo | null)[] }
  | { type: 'win'; seats: number[]; amounts: number[]; reason: 'fold' | 'showdown' }
  | { type: 'end' };

export interface HandConfig {
  game: GameId;
  stacks: [number, number];
  names: [string, string];
  dealer: number;
  sb: number;
  bb: number;
  controllers: [Controller, Controller];
  emit?: (e: HandEvent) => Promise<void> | void;
}

export interface Legal {
  toCall: number;
  canCheck: boolean;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
  currentBet: number;
  abilities: {
    burn: boolean;
    refund: number; // 0 = kullanılamaz, aksi halde iade miktarı
    peek: boolean;
    flip: boolean;
  };
}

export interface HandOutcome {
  winners: number[];
  pot: number;
  showdown: boolean;
  aborted?: boolean;
}

export class HandEngine {
  readonly game: GameId;
  readonly low: boolean;
  readonly dealer: number;
  readonly sb: number;
  readonly bb: number;
  seats: [SeatState, SeatState];
  /** açılmış yer kartları */
  board: Card[] = [];
  /** henüz açılmamış, kapalı duran yer kartları (sırayla açılır) */
  pending: Card[] = [];
  deck: Card[];
  burned: Card[] = [];
  street: Street = 0;
  currentBet = 0;
  minRaise = 0;
  /** sırası gelen oyuncu (arayüz için) */
  actor = -1;
  phase: 'dice' | 'deal' | 'swap' | 'betting' | 'showdown' | 'done' = 'deal';
  swapChoices: (SwapChoice | null)[] = [null, null];
  showdownInfos: (HandInfo | null)[] = [null, null];
  private controllers: [Controller, Controller];
  private emitFn: (e: HandEvent) => Promise<void> | void;

  constructor(cfg: HandConfig) {
    this.game = cfg.game;
    this.low = !!GAMES[cfg.game].low;
    this.dealer = cfg.dealer;
    this.sb = cfg.sb;
    this.bb = cfg.bb;
    this.controllers = cfg.controllers;
    this.emitFn = cfg.emit ?? (() => {});
    this.deck = shuffle(freshDeck());
    const mk = (i: number): SeatState => ({
      name: cfg.names[i],
      stack: cfg.stacks[i],
      hole: [],
      folded: false,
      allIn: false,
      streetBet: 0,
      totalBet: 0,
      lastBet: null,
      used: { burn: false, refund: false, peek: false, flip: false, swap: false },
      peek: null,
      revealed: [false, false],
      privateDead: [],
    });
    this.seats = [mk(0), mk(1)];
  }

  get pot(): number {
    return this.seats[0].totalBet + this.seats[1].totalBet;
  }

  /** Bu sokaktan önce toplanmış pot (masanın ortasındaki) */
  get collectedPot(): number {
    return this.pot - this.seats[0].streetBet - this.seats[1].streetBet;
  }

  /** Oyuncu kendi kartlarını görebiliyor mu? */
  seesOwnCards(i: number): boolean {
    void i;
    if (this.game === 'veyla') return false;
    if (this.game === 'kesh' && (this.phase === 'deal' || this.phase === 'swap')) return false;
    return true;
  }

  private async emit(e: HandEvent) {
    await this.emitFn(e);
  }

  private canAct(i: number) {
    const s = this.seats[i];
    return !s.folded && !s.allIn;
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

  /** Bir oyuncunun bildiği her şey — yapay zekâ ve şans hesabı bunu kullanır */
  knowledge(i: number): { mine: CardLike[]; opp: CardLike[]; board: CardLike[]; next: CardLike[]; dead: CardLike[] } {
    const me = this.seats[i];
    const op = this.seats[1 - i];
    const veyla = this.game === 'veyla';
    const mine = this.seesOwnCards(i) ? me.hole.slice() : me.hole.filter((_, k) => me.revealed[k]);
    const opp = veyla ? op.hole.slice() : op.hole.filter((_, k) => op.revealed[k]);
    const next: CardLike[] = [];
    if (me.peek && this.pending[0] && this.pending[0].uid === me.peek.uid) next.push(me.peek);
    const dead = this.burned.concat(me.privateDead);
    return { mine, opp, board: this.board.slice(), next, dead };
  }

  legal(i: number): Legal {
    const s = this.seats[i];
    const o = this.seats[1 - i];
    const toCall = Math.max(0, Math.min(this.currentBet - s.streetBet, s.stack));
    const maxRaiseTo = s.streetBet + s.stack;
    const canRaise = !o.allIn && !o.folded && s.stack > toCall;
    const minRaiseTo = Math.min(maxRaiseTo, this.currentBet + Math.max(this.minRaise, this.bb));
    const g = this.game;
    let refund = 0;
    if (g === 'kronvel' && !s.used.refund && s.lastBet && s.lastBet.street < this.street) {
      refund = Math.round(s.lastBet.amount / 2);
    }
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

  async play(): Promise<HandOutcome> {
    await this.emit({ type: 'start' });

    if (this.game === 'barbaz') {
      this.phase = 'dice';
      await this.dicePhase();
      if (this.seats[0].stack === 0 || this.seats[1].stack === 0) {
        this.phase = 'done';
        await this.emit({ type: 'end' });
        return { winners: [], pot: 0, showdown: false, aborted: true };
      }
    }

    this.phase = 'deal';
    const sbSeat = this.dealer;
    const bbSeat = 1 - this.dealer;
    const a1 = this.put(sbSeat, this.sb);
    await this.emit({ type: 'blind', seat: sbSeat, amount: a1 });
    const a2 = this.put(bbSeat, this.bb);
    await this.emit({ type: 'blind', seat: bbSeat, amount: a2 });
    this.currentBet = Math.max(this.seats[0].streetBet, this.seats[1].streetBet);
    this.minRaise = this.bb;

    for (let k = 0; k < 2; k++) {
      this.seats[bbSeat].hole.push(this.deck.shift()!);
      this.seats[sbSeat].hole.push(this.deck.shift()!);
    }
    for (let k = 0; k < 5; k++) this.pending.push(this.deck.shift()!);
    await this.emit({ type: 'deal' });

    if (this.game === 'kesh') await this.blindSwapPhase();

    this.phase = 'betting';
    await this.emit({ type: 'cardsReady' });

    await this.bettingRound(sbSeat);

    for (let st = 1; st <= LAST_STREET; st++) {
      if (this.liveCount() < 2) break;
      await this.endStreet();
      await this.revealNext();
      if (this.canAct(0) && this.canAct(1)) await this.bettingRound(bbSeat);
    }
    await this.endStreet();
    return this.finish();
  }

  private async revealNext() {
    this.street = (this.street + 1) as Street;
    this.board.push(this.pending.shift()!);
    await this.emit({ type: 'reveal', street: this.street });
  }

  private liveCount() {
    return (this.seats[0].folded ? 0 : 1) + (this.seats[1].folded ? 0 : 1);
  }

  private async endStreet() {
    // karşılıksız kalan bahsi iade et
    const [s0, s1] = this.seats;
    if (!s0.folded && !s1.folded && s0.streetBet !== s1.streetBet) {
      const hi = s0.streetBet > s1.streetBet ? 0 : 1;
      const diff = Math.abs(s0.streetBet - s1.streetBet);
      const s = this.seats[hi];
      s.streetBet -= diff;
      s.totalBet -= diff;
      s.stack += diff;
      if (s.stack > 0) s.allIn = false;
      await this.emit({ type: 'uncalled', seat: hi, amount: diff });
    }
    if (s0.streetBet || s1.streetBet) {
      s0.streetBet = 0;
      s1.streetBet = 0;
      await this.emit({ type: 'collect' });
    }
    this.currentBet = 0;
    this.minRaise = this.bb;
  }

  private async bettingRound(first: number) {
    const needs = [this.canAct(0), this.canAct(1)];
    let actor = first;
    let guard = 0;
    while ((needs[0] || needs[1]) && guard++ < 400) {
      if (this.liveCount() < 2) break;
      if (!needs[actor] || !this.canAct(actor)) {
        needs[actor] = false;
        actor = 1 - actor;
        continue;
      }
      const L = this.legal(actor);
      if (!this.canAct(1 - actor) && L.toCall === 0) {
        needs[actor] = false;
        actor = 1 - actor;
        continue;
      }
      this.actor = actor;
      const a = await this.controllers[actor].act(this, actor);
      if (await this.applyAbility(actor, a)) continue;
      const s = this.seats[actor];
      const L2 = this.legal(actor);
      if (a.type === 'fold') {
        if (L2.toCall === 0) {
          needs[actor] = false;
          await this.emit({ type: 'act', seat: actor, kind: 'check', amount: 0, to: s.streetBet });
        } else {
          s.folded = true;
          await this.emit({ type: 'act', seat: actor, kind: 'fold', amount: 0, to: s.streetBet });
          break;
        }
      } else if (a.type === 'check' || (a.type === 'call' && L2.toCall === 0)) {
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
        needs[actor] = false;
        needs[1 - actor] = this.canAct(1 - actor);
        await this.emit({ type: 'act', seat: actor, kind: s.allIn ? 'allin' : wasBet ? 'bet' : 'raise', amount: amt, to: s.streetBet });
      }
      actor = 1 - actor;
    }
    this.actor = -1;
  }

  /** Yetenek kullanıldıysa true döner (aynı oyuncu tekrar karar verir) */
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

  /** Zar at; eşitlikte tekrar. Kazananın indeksini döner. */
  private async rollDice(context: 'hand' | 'swap'): Promise<number> {
    let r0 = 0, r1 = 0;
    let guard = 0;
    do {
      r0 = 1 + Math.floor(Math.random() * 6);
      r1 = 1 + Math.floor(Math.random() * 6);
      await this.emit({ type: 'dice', rolls: [r0, r1], tie: r0 === r1, context });
    } while (r0 === r1 && guard++ < 50);
    if (r0 === r1) return Math.random() < 0.5 ? 0 : 1;
    return r0 > r1 ? 0 : 1;
  }

  private async dicePhase() {
    const w = await this.rollDice('hand');
    const l = 1 - w;
    const amt = Math.round(this.seats[l].stack * 0.1);
    if (amt > 0) {
      this.seats[l].stack -= amt;
      this.seats[w].stack += amt;
    }
    await this.emit({ type: 'steal', from: l, to: w, amount: amt });
  }

  /** Kesh: el başında, hiçbir kart görünmeden yapılan kör takas */
  private async blindSwapPhase() {
    this.phase = 'swap';
    await this.emit({ type: 'swapStart' });
    const choices = await Promise.all([0, 1].map((i) => this.controllers[i].chooseSwap(this, i)));
    const valid = (c: SwapChoice | null) =>
      c && (c.hand === 0 || c.hand === 1) && c.board >= 0 && c.board < this.pending.length ? c : null;
    const c0 = valid(choices[0]);
    const c1 = valid(choices[1]);
    this.swapChoices = [c0, c1];
    this.seats[0].used.swap = !!c0;
    this.seats[1].used.swap = !!c1;

    if (!c0 && !c1) {
      await this.emit({ type: 'swapNone' });
      return;
    }
    if (c0 && c1 && c0.board === c1.board) {
      // aynı kart: değiştirilmek istenmeyen kartlar açılır, büyük olan alır
      const k0 = 1 - c0.hand;
      const k1 = 1 - c1.hand;
      this.seats[0].revealed[k0] = true;
      this.seats[1].revealed[k1] = true;
      const r0 = this.seats[0].hole[k0].rank;
      const r1 = this.seats[1].hole[k1].rank;
      let winner = r0 === r1 ? -1 : r0 > r1 ? 0 : 1;
      await this.emit({ type: 'swapConflict', board: c0.board, kept: [k0, k1], winner, byDice: false });
      if (winner === -1) {
        winner = await this.rollDice('swap');
        await this.emit({ type: 'swapConflict', board: c0.board, kept: [k0, k1], winner, byDice: true });
      }
      const cs = [c0, c1];
      const wc = cs[winner];
      const ws = this.seats[winner];
      const t = ws.hole[wc.hand];
      ws.hole[wc.hand] = this.pending[wc.board];
      this.pending[wc.board] = t;
      await this.emit({ type: 'swap', seat: winner, hand: wc.hand, board: wc.board });
      const l = 1 - winner;
      const lc = cs[l];
      const ls = this.seats[l];
      const old = ls.hole[lc.hand];
      ls.privateDead.push(old);
      ls.hole[lc.hand] = this.deck.shift()!;
      await this.emit({ type: 'swapDraw', seat: l, hand: lc.hand, old });
      return;
    }
    const cs = [c0, c1];
    for (let i = 0; i < 2; i++) {
      const c = cs[i];
      if (!c) continue;
      const s = this.seats[i];
      const t = s.hole[c.hand];
      s.hole[c.hand] = this.pending[c.board];
      this.pending[c.board] = t;
      await this.emit({ type: 'swap', seat: i, hand: c.hand, board: c.board });
    }
  }

  private async finish(): Promise<HandOutcome> {
    const pot = this.pot;
    const [s0, s1] = this.seats;
    if (s0.folded || s1.folded) {
      const w = s0.folded ? 1 : 0;
      this.seats[w].stack += pot;
      this.seats[0].totalBet = this.seats[1].totalBet = 0;
      await this.emit({ type: 'win', seats: [w], amounts: [pot], reason: 'fold' });
      this.phase = 'done';
      await this.emit({ type: 'end' });
      return { winners: [w], pot, showdown: false };
    }
    while (this.pending.length) await this.revealNext();
    this.phase = 'showdown';
    const infos = [0, 1].map((i) => describe(this.seats[i].hole.concat(this.board), this.low));
    const sc = [0, 1].map((i) => scoreOf(this.seats[i].hole.concat(this.board), this.low));
    this.showdownInfos = infos;
    await this.emit({ type: 'showdown', infos });
    let winners: number[];
    let amounts: number[];
    if (sc[0] === sc[1]) {
      const half = Math.floor(pot / 2);
      const odd = pot - half * 2;
      const bbSeat = 1 - this.dealer;
      winners = [0, 1];
      amounts = [half + (bbSeat === 0 ? odd : 0), half + (bbSeat === 1 ? odd : 0)];
    } else {
      const w = sc[0] > sc[1] ? 0 : 1;
      winners = [w];
      amounts = [0, 0];
      amounts[w] = pot;
    }
    for (let i = 0; i < 2; i++) this.seats[i].stack += amounts[i];
    this.seats[0].totalBet = this.seats[1].totalBet = 0;
    await this.emit({ type: 'win', seats: winners, amounts: winners.length === 2 ? amounts : [amounts[winners[0]]], reason: 'showdown' });
    this.phase = 'done';
    await this.emit({ type: 'end' });
    return { winners, pot, showdown: true };
  }
}
