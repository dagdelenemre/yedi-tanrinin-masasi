import { HandInfo } from '../engine/evaluator';
import { GameId, GodId } from '../engine/gods';
import { Action, Legal, Street, SwapChoice } from '../engine/hand';

// ---------------------------------------------------------------------------
// İstemci ↔ sunucu mesajları (online mod)
// ---------------------------------------------------------------------------

export type GameChoice = GameId | 'random';
export const MAX_SEATS = 4;
export const TURN_MS = 30000;
export const SWAP_MS = 25000;
export const INTRO_MS = 45000;
export const NEXT_HAND_MS = 6000;

export interface CardView {
  uid: number;
  rank?: number;
  suit?: number;
}

export interface LobbyPlayer {
  seat: number;
  name: string;
  isBot: boolean;
  godId?: GodId;
  connected: boolean;
  isHost: boolean;
}

export interface RoomView {
  code: string;
  state: 'lobby' | 'playing';
  maxPlayers: number;
  game: GameChoice;
  seats: (LobbyPlayer | null)[];
  you: number;
  lastResult?: Standing[];
}

export interface Standing {
  seat: number;
  name: string;
  stack: number;
  place: number;
}

export interface SeatView {
  seat: number;
  name: string;
  isBot: boolean;
  godId?: GodId;
  connected: boolean;
  stack: number;
  inHand: boolean;
  busted: boolean;
  folded: boolean;
  allIn: boolean;
  streetBet: number;
  hole: CardView[];
  revealed: boolean[];
}

export interface KnowledgeView {
  mine: { rank: number; suit: number }[];
  opps: { rank: number; suit: number }[][];
  board: { rank: number; suit: number }[];
  next: { rank: number; suit: number }[];
  dead: { rank: number; suit: number }[];
}

export interface TableState {
  game: GameId;
  dealerGod: GodId;
  handNo: number;
  bb: number;
  sb: number;
  handsToNextLevel: number;
  phase: 'intro' | 'dice' | 'deal' | 'swap' | 'betting' | 'showdown' | 'done' | 'between';
  street: Street;
  dealerSeat: number;
  pot: number;
  collected: number;
  currentBet: number;
  board: CardView[];
  pending: CardView[];
  seats: SeatView[];
  actor: number;
  deadline: number;
  you: number;
  sees: boolean;
  legal?: Legal;
  swapTurn?: boolean;
  knowledge?: KnowledgeView;
  peek?: CardView;
  used?: { burn: boolean; refund: boolean; peek: boolean; flip: boolean; swap: boolean };
  lastBet?: { amount: number; street: Street } | null;
  showdown?: (HandInfo | null)[];
}

/** İstemciye giden olay (oturak numaraları oda koltuklarıdır) */
export type NetEvent =
  | { type: 'start' }
  | { type: 'dice'; rolls: (number | null)[]; tie: boolean; context: 'hand' | 'swap' }
  | { type: 'steal'; from: number; to: number; amount: number }
  | { type: 'blind'; seat: number; amount: number }
  | { type: 'deal' }
  | { type: 'swapStart' }
  | { type: 'swapConflict'; board: number; seats: number[]; winner: number; byDice: boolean }
  | { type: 'swap'; seat: number; board: number }
  | { type: 'swapDraw'; seat: number }
  | { type: 'swapNone' }
  | { type: 'cardsReady' }
  | { type: 'reveal'; street: Street }
  | { type: 'act'; seat: number; kind: string; amount: number; to: number }
  | { type: 'uncalled'; seat: number; amount: number }
  | { type: 'collect' }
  | { type: 'burn'; seat: number; old: CardView }
  | { type: 'refund'; seat: number; amount: number }
  | { type: 'peek'; seat: number }
  | { type: 'flip'; seat: number }
  | { type: 'showdown' }
  | { type: 'win'; pots: { amount: number; winners: number[]; shares: number[] }[]; reason: 'fold' | 'showdown' }
  | { type: 'end' }
  | { type: 'busted'; seats: number[] };

export type ClientMsg =
  | { t: 'hello'; token: string }
  | { t: 'ping' }
  | { t: 'create'; name: string }
  | { t: 'join'; code: string; name: string }
  | { t: 'setGame'; game: GameChoice }
  | { t: 'setMax'; max: number }
  | { t: 'addBot'; god: GodId }
  | { t: 'removeBot'; seat: number }
  | { t: 'start' }
  | { t: 'ready' }
  | { t: 'action'; action: Action }
  | { t: 'swap'; choice: SwapChoice | null }
  | { t: 'leave' }
  | { t: 'backToLobby' };

export type ServerMsg =
  | { t: 'error'; msg: string }
  | { t: 'pong' }
  | { t: 'room'; room: RoomView }
  | { t: 'left' }
  | { t: 'intro'; game: GameId; dealerGod: GodId; ready: number[]; humans: number[]; deadline: number; state: TableState }
  | { t: 'table'; state: TableState; ev?: NetEvent }
  | { t: 'say'; seat: number; text: string }
  | { t: 'nextHand'; at: number; state: TableState }
  | { t: 'matchEnd'; standings: Standing[] };
