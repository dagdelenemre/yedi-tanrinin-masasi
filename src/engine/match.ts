import { AIController } from './ai';
import { GameId, GodId, GODS, GOD_ORDER } from './gods';
import { Controller, HandEngine, HandEvent, HandOutcome } from './hand';

export type EntrantId = 'player' | GodId;

export interface Participant {
  id: EntrantId;
  name: string;
  stack: number;
}

export interface MatchHooks {
  emit?: (e: HandEvent, engine: HandEngine) => Promise<void> | void;
  /** her elden önce çağrılır (arayüzde "sonraki el" beklemesi vb.) */
  beforeHand?: (m: Match) => Promise<void>;
  afterHand?: (m: Match, o: HandOutcome, engine: HandEngine) => Promise<void>;
}

export const BLIND_EVERY = 10;

export class Match {
  handNo = 0;
  dealer: number;
  bb: number;
  pendingGame: GameId | null = null;
  engine: HandEngine | null = null;
  readonly startBB: number;

  constructor(
    public players: [Participant, Participant],
    public game: GameId,
    public controllers: [Controller, Controller],
    public hooks: MatchHooks = {},
  ) {
    this.dealer = Math.random() < 0.5 ? 0 : 1;
    const total = players[0].stack + players[1].stack;
    this.startBB = Math.max(2, Math.round(total / 20 / 2) * 2);
    this.bb = this.startBB;
  }

  get sb() {
    return Math.max(1, Math.floor(this.bb / 2));
  }

  /** Bir sonraki blind artışına kalan el */
  get handsToNextLevel() {
    return BLIND_EVERY - (this.handNo % BLIND_EVERY);
  }

  private updateBlinds() {
    const level = Math.floor(this.handNo / BLIND_EVERY);
    let bb = this.startBB;
    for (let i = 0; i < level; i++) bb = Math.ceil((bb * 1.5) / 2) * 2;
    this.bb = bb;
  }

  /** Kazananın indeksini döner */
  async play(): Promise<number> {
    while (this.players[0].stack > 0 && this.players[1].stack > 0 && this.handNo < 400) {
      if (this.pendingGame) {
        this.game = this.pendingGame;
        this.pendingGame = null;
      }
      this.updateBlinds();
      if (this.hooks.beforeHand) await this.hooks.beforeHand(this);
      const engine: HandEngine = new HandEngine({
        game: this.game,
        stacks: [this.players[0].stack, this.players[1].stack],
        names: [this.players[0].name, this.players[1].name],
        dealer: this.dealer,
        sb: this.sb,
        bb: this.bb,
        controllers: this.controllers,
        emit: this.hooks.emit ? (e: HandEvent): Promise<void> | void => this.hooks.emit!(e, engine) : undefined,
      });
      this.engine = engine;
      const o = await engine.play();
      this.players[0].stack = engine.seats[0].stack;
      this.players[1].stack = engine.seats[1].stack;
      this.handNo++;
      this.dealer = 1 - this.dealer;
      if (this.hooks.afterHand) await this.hooks.afterHand(this, o, engine);
    }
    if (this.players[0].stack === this.players[1].stack) return Math.random() < 0.5 ? 0 : 1;
    return this.players[0].stack > this.players[1].stack ? 0 : 1;
  }
}

/** Arka planda iki tanrıyı karşılaştırır (turnuva simülasyonu) */
export async function simulateMatch(a: Participant, b: Participant, game: GameId): Promise<number> {
  const ca = new AIController(GODS[a.id as GodId], { samples: 90 });
  const cb = new AIController(GODS[b.id as GodId], { samples: 90 });
  const m = new Match([a, b], game, [ca, cb], {
    // ana iş parçacığını kilitlememek için ara ara nefes al
    afterHand: async (mm) => {
      if (mm.handNo % 3 === 0) await new Promise((r) => setTimeout(r, 0));
    },
  });
  return m.play();
}

export function randomGodGame(): GameId {
  return GOD_ORDER[Math.floor(Math.random() * GOD_ORDER.length)];
}
