import { CardLike } from './evaluator';
import { equityMulti } from './equity';
import { GodDef } from './gods';
import { Action, FLIP_SUIT, LAST_STREET, SwapChoice } from './hand';
import { MController, MKnowledge, MultiHandEngine } from './multi';

// ---------------------------------------------------------------------------
// Çok oyunculu masada tanrı botu. Kişilik parametreleri tek kişilik oyunla aynı.
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface AIMultiOptions {
  thinkMs?: [number, number];
  samples?: number;
  say?: (kind: 'raise' | 'allin' | 'fold' | 'ability') => void;
}

export class AIMultiController implements MController {
  constructor(public god: GodDef, private opts: AIMultiOptions = {}) {}

  private share(e: MultiHandEngine, k: MKnowledge, samples = this.opts.samples ?? 350) {
    return equityMulti({ mine: k.mine, opps: k.opps, board: k.board, next: k.next, dead: k.dead, low: e.low, samples }).share;
  }

  private async think(scale = 1) {
    const [a, b] = this.opts.thinkMs ?? [0, 0];
    if (b > 0 || a > 0) await sleep((a + Math.random() * b) * scale);
  }

  async chooseSwap(): Promise<SwapChoice | null> {
    await this.think(1.2);
    const chance = this.god.id === 'kesh' ? 0.75 : 0.25 + this.god.p.aggression * 0.4;
    if (Math.random() > chance) return null;
    return { hand: Math.random() < 0.5 ? 0 : 1, board: Math.floor(Math.random() * 5) };
  }

  async act(e: MultiHandEngine, i: number): Promise<Action> {
    const L = e.legal(i);
    const p = this.god.p;
    const s = e.seats[i];
    const k = e.knowledge(i);
    const nLive = k.opps.length + 1;
    const raw = this.share(e, k);
    // n kişilik payı iki kişilik ölçeğe çevir (adil pay = 0.5)
    const toHU = (sh: number) => Math.max(0, Math.min(1, 0.5 + (sh - 1 / nLive) * (nLive / 2)));
    let eq = toHU(raw);
    const st = e.street;

    if (L.abilities.peek && (st >= LAST_STREET - 1 || (st >= 2 && L.toCall > e.pot * 0.25) || (this.god.id === 'oris' && st >= 3))) {
      await this.think(0.6);
      return { type: 'peek' };
    }
    if (L.abilities.refund && eq < (this.god.id === 'kronvel' ? 0.45 : 0.37)) {
      await this.think(0.7);
      this.opts.say?.('ability');
      return { type: 'refund' };
    }
    if (L.abilities.burn) {
      let bestIdx = -1;
      let best = raw + p.abilityEdge + 0.025;
      for (let b = 0; b < e.board.length; b++) {
        const board = e.board.filter((_, idx) => idx !== b);
        const dead: CardLike[] = k.dead.concat([e.board[b]]);
        const v = this.share(e, { ...k, board, dead }, 220);
        if (v > best) { best = v; bestIdx = b; }
      }
      if (bestIdx >= 0) {
        await this.think(0.8);
        this.opts.say?.('ability');
        return { type: 'burn', index: bestIdx };
      }
    }
    if (L.abilities.flip && st >= 2) {
      const mine = s.hole.map((c) => ({ rank: c.rank, suit: FLIP_SUIT[c.suit] }));
      if (this.share(e, { ...k, mine }, 260) > raw + p.abilityEdge + 0.02) {
        await this.think(0.8);
        return { type: 'flip' };
      }
    }

    await this.think();
    const pot = e.pot;
    const toCall = L.toCall;
    eq += p.confidence + (Math.random() * 2 - 1) * p.variance;
    if (toCall > 0 && !k.opps.every((o) => o.length === 2)) {
      const ratio = Math.min(1.5, toCall / Math.max(1, pot - toCall));
      eq -= 0.09 * ratio * (1 - p.bluff * 0.6);
    }
    const r = Math.random();
    const bb = e.bb;
    const shortStack = s.stack + s.streetBet <= bb * 3;
    const raiseTo = (frac: number) => {
      const base = toCall > 0 ? pot + toCall : pot;
      let size = Math.max(Math.round(base * frac), L.minRaiseTo - L.currentBet);
      let to = L.currentBet + size;
      if (to >= L.maxRaiseTo * 0.8) to = L.maxRaiseTo;
      return Math.max(L.minRaiseTo, Math.min(L.maxRaiseTo, to));
    };
    const sizeFrac = () => {
      let f = 0.35 + p.aggression * 0.35 + Math.random() * 0.2;
      if (this.god.id === 'prisma') f = 0.25 + Math.random() * 0.8;
      if (st <= 2) f *= 0.6;
      return f;
    };
    const doRaise = (frac: number, bluff = false): Action => {
      let to = raiseTo(frac);
      if (this.god.id === 'barbaz' && !bluff && eq > 0.7 && Math.random() < 0.3) to = L.maxRaiseTo;
      if (shortStack && eq > 0.45) to = L.maxRaiseTo;
      this.opts.say?.(to >= L.maxRaiseTo ? 'allin' : 'raise');
      return { type: 'raise', to };
    };

    if (toCall > 0) {
      const potOdds = toCall / (pot + toCall);
      const risk = toCall / Math.max(1, s.stack + s.streetBet);
      // pot oranı ham payla karşılaştırılır
      const need = potOdds + (p.tightness - 0.4) * 0.12 + Math.max(0, risk - 0.3) * 0.15 * (1 - p.aggression * 0.5);
      const rawAdj = raw + p.confidence + (eq - toHU(raw)) / Math.max(1, nLive / 2);
      if (shortStack && eq > 0.5 && L.canRaise) return doRaise(1);
      if (rawAdj < need) {
        if (L.canRaise && st < LAST_STREET && r < p.bluff * 0.08) return doRaise(sizeFrac(), true);
        this.opts.say?.('fold');
        return { type: 'fold' };
      }
      const strong = eq > 0.72 - p.aggression * 0.08;
      if (strong && L.canRaise && Math.random() > p.slowplay && r < 0.25 + p.aggression * 0.4) return doRaise(sizeFrac());
      return { type: 'call' };
    }
    const early = st >= 1 && st <= 2 ? 0.6 : 1;
    if (eq > 0.6 - p.aggression * 0.08) {
      if (Math.random() < p.slowplay && st < LAST_STREET) return { type: 'check' };
      if (L.canRaise && r < (0.45 + p.aggression * 0.5) * early) return doRaise(sizeFrac());
      return { type: 'check' };
    }
    if (L.canRaise && r < p.bluff * (st === LAST_STREET ? 0.6 : 0.25) / Math.max(1, nLive - 1)) return doRaise(0.45 + Math.random() * 0.35, true);
    return { type: 'check' };
  }
}
