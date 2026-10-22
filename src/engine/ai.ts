import { CardLike } from './evaluator';
import { equity } from './equity';
import { GodDef } from './gods';
import { Action, Controller, FLIP_SUIT, HandEngine, LAST_STREET, SwapChoice } from './hand';

export type SpeechKind = 'raise' | 'allin' | 'fold' | 'ability';

export interface AIOptions {
  /** düşünme gecikmesi (arayüzde oynarken) */
  think?: boolean;
  /** düşünme süresi çarpanı (oyun temposu) */
  pace?: () => number;
  samples?: number;
  say?: (kind: SpeechKind) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class AIController implements Controller {
  constructor(public god: GodDef, private opts: AIOptions = {}) {}

  private get samples() {
    return this.opts.samples ?? 500;
  }

  private eq(e: HandEngine, k: ReturnType<HandEngine['knowledge']>, samples = this.samples) {
    return equity({ ...k, low: e.low, samples }).share;
  }

  private async think(min = 1000, spread = 1300) {
    if (this.opts.think) await sleep((min + Math.random() * spread) * (this.opts.pace?.() ?? 1));
  }

  private say(kind: SpeechKind, chance = 1) {
    if (this.opts.say && Math.random() < chance) this.opts.say(kind);
  }

  /** Kesh: kör takas — hiçbir kart görünmez, tamamen içgüdü */
  async chooseSwap(_e: HandEngine, _i: number): Promise<SwapChoice | null> {
    await this.think(1400, 1200);
    const chance = this.god.id === 'kesh' ? 0.75 : 0.25 + this.god.p.aggression * 0.4;
    if (Math.random() > chance) return null;
    this.say('ability', 0.5);
    return { hand: Math.random() < 0.5 ? 0 : 1, board: Math.floor(Math.random() * 5) };
  }

  async act(e: HandEngine, i: number): Promise<Action> {
    const L = e.legal(i);
    const p = this.god.p;
    const s = e.seats[i];
    const k = e.knowledge(i);
    let eq = this.eq(e, k);
    const st = e.street;

    // ---- Yetenekler -------------------------------------------------------
    if (L.abilities.peek) {
      const want = st === LAST_STREET - 1 || (st >= 2 && L.toCall > e.pot * 0.25) || (st === 0 && L.toCall > e.bb * 2) || (this.god.id === 'oris' && st >= 3);
      if (want) {
        // gizli yetenek: rakip fark etmemeli, konuşma yok
        await this.think(700, 600);
        return { type: 'peek' };
      }
    }
    if (L.abilities.refund) {
      const thr = this.god.id === 'kronvel' ? 0.45 : 0.37;
      if (eq < thr && L.abilities.refund >= 1) {
        await this.think(800, 700);
        this.say('ability', 0.7);
        return { type: 'refund' };
      }
    }
    if (L.abilities.burn) {
      let bestIdx = -1;
      let bestEq = eq + p.abilityEdge + 0.025;
      for (let b = 0; b < e.board.length; b++) {
        const board = e.board.filter((_, idx) => idx !== b);
        const dead: CardLike[] = k.dead.concat([e.board[b]]);
        const v = this.eq(e, { ...k, board, dead }, Math.ceil(this.samples * 0.6));
        if (v > bestEq) { bestEq = v; bestIdx = b; }
      }
      if (bestIdx >= 0) {
        await this.think(900, 800);
        this.say('ability', 0.6);
        return { type: 'burn', index: bestIdx };
      }
    }
    if (L.abilities.flip && st >= 2) {
      const mine = s.hole.map((c) => ({ rank: c.rank, suit: FLIP_SUIT[c.suit] }));
      const v = this.eq(e, { ...k, mine }, Math.ceil(this.samples * 0.7));
      if (v > eq + p.abilityEdge + 0.02) {
        await this.think(900, 800);
        return { type: 'flip' };
      }
    }

    // ---- Bahis kararı -----------------------------------------------------
    await this.think();
    const pot = e.pot;
    const toCall = L.toCall;
    const knowsOpp = k.opp.length === 2;
    eq += p.confidence + (Math.random() * 2 - 1) * p.variance;
    if (toCall > 0 && !knowsOpp) {
      // rakibin bahsine saygı: büyük bahis genelde güçlü el demektir
      const ratio = Math.min(1.5, toCall / Math.max(1, pot - toCall));
      eq -= 0.09 * ratio * (1 - p.bluff * 0.6);
    }
    const r = Math.random();
    const bb = e.bb;
    const shortStack = s.stack + s.streetBet <= bb * 3;

    const raiseTo = (frac: number): number => {
      const base = toCall > 0 ? pot + toCall : pot;
      let size = Math.round(base * frac);
      size = Math.max(size, L.minRaiseTo - L.currentBet);
      let to = L.currentBet + size;
      if (to >= L.maxRaiseTo * 0.8) to = L.maxRaiseTo;
      return Math.max(L.minRaiseTo, Math.min(L.maxRaiseTo, to));
    };
    const sizeFrac = () => {
      let f = 0.35 + p.aggression * 0.35 + Math.random() * 0.2;
      if (this.god.id === 'prisma') f = 0.25 + Math.random() * 0.8;
      // yerde az kart varken bahisler küçük
      if (st <= 2) f *= 0.6;
      return f;
    };
    const doRaise = (frac: number, bluff = false): Action => {
      let to = raiseTo(frac);
      if (this.god.id === 'barbaz' && !bluff && eq > 0.7 && Math.random() < 0.3) to = L.maxRaiseTo;
      if (shortStack && eq > 0.45) to = L.maxRaiseTo;
      this.say(to >= L.maxRaiseTo ? 'allin' : 'raise', to >= L.maxRaiseTo ? 1 : 0.35);
      return { type: 'raise', to };
    };

    if (toCall > 0) {
      const potOdds = toCall / (pot + toCall);
      // stack'in büyük kısmını riske atan bahislere karşı daha seçici
      const risk = toCall / Math.max(1, s.stack + s.streetBet);
      const need = potOdds + (p.tightness - 0.4) * 0.15 + (st === 0 ? 0 : 0.02) + Math.max(0, risk - 0.3) * 0.18 * (1 - p.aggression * 0.5);
      if (shortStack && eq > 0.47 && L.canRaise) return doRaise(1);
      if (eq < need) {
        if (L.canRaise && st < LAST_STREET && r < p.bluff * 0.1) return doRaise(sizeFrac(), true);
        this.say('fold', 0.3);
        return { type: 'fold' };
      }
      // yeniden yükseltme savaşlarını sınırla: karşı bahis büyüdükçe daha güçlü el iste
      const pressure = Math.min(0.12, (L.currentBet / Math.max(1, s.stack + s.streetBet)) * 0.25);
      const strong = eq > 0.7 - p.aggression * 0.08 + pressure;
      const slow = Math.random() < p.slowplay && st < LAST_STREET;
      if (strong && L.canRaise && !slow && r < 0.25 + p.aggression * 0.4) return doRaise(sizeFrac());
      return { type: 'call' };
    }

    // pas atılabilir durum
    // erken sokaklarda (yerde az kart varken) daha sakin
    const early = st >= 1 && st <= 2 ? 0.6 : 1;
    if (eq > 0.6 - p.aggression * 0.08) {
      if (Math.random() < p.slowplay && st < LAST_STREET) return { type: 'check' };
      if (L.canRaise && r < (0.45 + p.aggression * 0.5) * early) return doRaise(sizeFrac());
      return { type: 'check' };
    }
    if (L.canRaise && r < p.bluff * (st === LAST_STREET ? 0.8 : 0.35)) return doRaise(0.45 + Math.random() * 0.35, true);
    return { type: 'check' };
  }
}
