import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { AIMultiController } from '../src/engine/aimulti';
import { Card } from '../src/engine/cards';
import { GAMES, GameId, GODS, GOD_ORDER, GodId, pick } from '../src/engine/gods';
import { Action, SwapChoice } from '../src/engine/hand';
import { MController, MEvent, MultiHandEngine } from '../src/engine/multi';
import {
  CardView, ClientMsg, GameChoice, INTRO_MS, MAX_SEATS, NEXT_HAND_MS, NetEvent, RoomView, SWAP_MS, SeatView, ServerMsg, Standing, TURN_MS, TableState,
} from '../src/net/protocol';

// ---------------------------------------------------------------------------
// Yedi Tanrının Masası — online sunucu
//   HTTP: derlenmiş istemciyi (dist/) sunar
//   WS  : /ws üzerinden oda ve oyun mesajları
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(__dirname, '..', 'dist'));
const START_STACK = 20;
/** Test için olay temposu çarpanı (varsayılan 1) */
const PACE_SCALE = Math.max(0, Number(process.env.PACE_SCALE ?? 1));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// olay sonrası bekleme süreleri (ms): istemcilerin animasyon yapabilmesi için
const PACE: Partial<Record<MEvent['type'], number>> = {
  start: 700, dice: 1500, steal: 1800, blind: 300, deal: 2600, swapStart: 600, swapConflict: 2200, swap: 1000, swapDraw: 1000, swapNone: 1000,
  cardsReady: 700, reveal: 1300, act: 800, uncalled: 400, collect: 600, burn: 1300, refund: 1000, showdown: 3000, win: 2800, end: 300,
};

// ---------------------------------------------------------------------------
interface Player {
  token: string;
  name: string;
  ws: WebSocket | null;
  isBot: boolean;
  godId?: GodId;
  stack: number;
  lastSeen: number;
  gone: boolean; // masadan kalıcı ayrıldı
}

class Room {
  seats: (Player | null)[] = Array(MAX_SEATS).fill(null);
  hostToken: string;
  maxPlayers = 4;
  game: GameChoice = 'random';
  state: 'lobby' | 'playing' = 'lobby';
  match: OnlineMatch | null = null;
  lastResult?: Standing[];
  emptySince = 0;

  constructor(public code: string, host: Player) {
    this.hostToken = host.token;
    this.seats[0] = host;
  }

  players(): Player[] {
    return this.seats.filter((p): p is Player => !!p);
  }

  seatOf(token: string): number {
    return this.seats.findIndex((p) => p?.token === token);
  }

  humansConnected(): number {
    return this.players().filter((p) => !p.isBot && p.ws && !p.gone).length;
  }

  view(forToken: string): RoomView {
    return {
      code: this.code,
      state: this.state,
      maxPlayers: this.maxPlayers,
      game: this.game,
      seats: this.seats.slice(0, this.maxPlayers).map((p, i) =>
        p ? { seat: i, name: p.name, isBot: p.isBot, godId: p.godId, connected: p.isBot || (!!p.ws && !p.gone), isHost: p.token === this.hostToken } : null,
      ),
      you: this.seatOf(forToken),
      lastResult: this.lastResult,
    };
  }

  broadcastRoom() {
    for (const p of this.players()) if (p.ws) send(p.ws, { t: 'room', room: this.view(p.token) });
  }

  passHost() {
    const next = this.players().find((p) => !p.isBot && p.ws && !p.gone);
    if (next) this.hostToken = next.token;
  }
}

const rooms = new Map<string, Room>();
const tokenRoom = new Map<string, string>();

function newCode(): string {
  for (let i = 0; i < 1000; i++) {
    const c = String(1000 + crypto.randomInt(9000));
    if (!rooms.has(c)) return c;
  }
  throw new Error('oda kodu üretilemedi');
}

function send(ws: WebSocket, m: ServerMsg) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
}

function cleanName(s: unknown): string {
  const n = String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  return n || 'Hizmetçi';
}

// ---------------------------------------------------------------------------
// Maç
// ---------------------------------------------------------------------------
type Pending = { kind: 'act' | 'swap'; seat: number; resolve: (v: any) => void; timer: NodeJS.Timeout };

class OnlineMatch {
  game: GameId;
  dealerGod: GodId;
  handNo = 0;
  bb = 2;
  dealerSeat: number;
  engine: MultiHandEngine | null = null;
  active: number[] = []; // motor sırası → oda koltuğu
  phase: TableState['phase'] = 'intro';
  deadline = 0;
  pending = new Map<number, Pending>();
  readySeats = new Set<number>();
  introResolve: (() => void) | null = null;
  aborted = false;
  seats: number[];

  constructor(public room: Room) {
    const choice = room.game;
    this.game = choice === 'random' ? pick(GOD_ORDER) : choice;
    this.dealerGod = this.game === 'klasik' ? pick(GOD_ORDER) : (this.game as GodId);
    this.seats = room.seats.map((p, i) => (p ? i : -1)).filter((i) => i >= 0 && i < room.maxPlayers);
    for (const s of this.seats) room.seats[s]!.stack = START_STACK;
    this.dealerSeat = pick(this.seats);
  }

  player(seat: number) {
    return this.room.seats[seat]!;
  }

  get sb() {
    return Math.max(1, Math.floor(this.bb / 2));
  }

  // -------------------------------------------------------------------------
  // Görünüm: her oyuncu yalnızca görmesi gerekeni görür
  // -------------------------------------------------------------------------
  stateFor(viewer: number): TableState {
    const e = this.engine;
    const idx = (seat: number) => (e ? this.active.indexOf(seat) : -1);
    const vi = idx(viewer);
    const cv = (c: Card, visible: boolean): CardView => (visible ? { uid: c.uid, rank: c.rank, suit: c.suit } : { uid: c.uid });
    const showdown = !!e && (e.phase === 'showdown' || e.phase === 'done') && e.board.length === 5 && e.showdownInfos.some(Boolean);
    const seats: SeatView[] = this.seats.map((seat) => {
      const p = this.player(seat);
      const i = idx(seat);
      const s = e && i >= 0 ? e.seats[i] : null;
      let hole: CardView[] = [];
      if (s) {
        hole = s.hole.map((c, k) => {
          let vis: boolean;
          if (i === vi) vis = e!.seesOwnCards(i) || s.revealed[k] || (showdown && !s.folded);
          else vis = (e!.game === 'veyla' && vi >= 0) || s.revealed[k] || (showdown && !s.folded);
          return cv(c, vis);
        });
      }
      return {
        seat,
        name: p.name,
        isBot: p.isBot,
        godId: p.godId,
        connected: p.isBot || (!!p.ws && !p.gone),
        stack: s ? s.stack : p.stack,
        inHand: !!s,
        busted: !s && p.stack <= 0,
        folded: s ? s.folded : false,
        allIn: s ? s.allIn : false,
        streetBet: s ? s.streetBet : 0,
        hole,
        revealed: s ? s.revealed.slice() : [false, false],
      };
    });
    const st: TableState = {
      game: this.game,
      dealerGod: this.dealerGod,
      handNo: this.handNo,
      bb: this.bb,
      sb: this.sb,
      handsToNextLevel: 10 - (this.handNo % 10),
      phase: e && this.phase !== 'between' && this.phase !== 'intro' ? e.phase : this.phase,
      street: e ? e.street : 0,
      dealerSeat: this.dealerSeat,
      pot: e ? e.pot : 0,
      collected: e ? e.collectedPot : 0,
      currentBet: e ? e.currentBet : 0,
      board: e ? e.board.map((c) => cv(c, true)) : [],
      pending: e ? e.pending.map((c) => cv(c, false)) : [],
      seats,
      actor: e && e.actor >= 0 ? this.active[e.actor] : -1,
      deadline: this.deadline,
      you: viewer,
      sees: e && vi >= 0 ? e.seesOwnCards(vi) : true,
    };
    if (e && vi >= 0) {
      const me = e.seats[vi];
      const pend = this.pending.get(viewer);
      if (pend?.kind === 'act') st.legal = e.legal(vi);
      if (pend?.kind === 'swap') st.swapTurn = true;
      const k = e.knowledge(vi);
      const plain = (a: { rank: number; suit: number }[]) => a.map((c) => ({ rank: c.rank, suit: c.suit }));
      st.knowledge = { mine: plain(k.mine), opps: k.opps.map(plain), board: plain(k.board), next: plain(k.next), dead: plain(k.dead) };
      if (k.next.length && me.peek) st.peek = cv(me.peek, true);
      st.used = { ...me.used };
      st.lastBet = me.lastBet;
      if (showdown) st.showdown = this.seats.map((seat) => (idx(seat) >= 0 ? e.showdownInfos[idx(seat)] : null));
    }
    return st;
  }

  /** Motor olayını izleyiciye göre süzer; null = bu izleyici görmez */
  netEvent(ev: MEvent, viewer: number): NetEvent | null {
    const S = (i: number) => this.active[i];
    switch (ev.type) {
      case 'dice': {
        const rolls: (number | null)[] = Array(MAX_SEATS).fill(null);
        ev.rolls.forEach((r, i) => (rolls[S(i)] = r));
        return { type: 'dice', rolls, tie: ev.tie, context: ev.context };
      }
      case 'steal': return { type: 'steal', from: S(ev.from), to: S(ev.to), amount: ev.amount };
      case 'blind': return { type: 'blind', seat: S(ev.seat), amount: ev.amount };
      case 'swapConflict': return { type: 'swapConflict', board: ev.board, seats: ev.seats.map(S), winner: ev.winner >= 0 ? S(ev.winner) : -1, byDice: ev.byDice };
      case 'swap': return { type: 'swap', seat: S(ev.seat), board: ev.board };
      case 'swapDraw': return { type: 'swapDraw', seat: S(ev.seat) };
      case 'act': return { type: 'act', seat: S(ev.seat), kind: ev.kind, amount: ev.amount, to: ev.to };
      case 'uncalled': return { type: 'uncalled', seat: S(ev.seat), amount: ev.amount };
      case 'burn': return { type: 'burn', seat: S(ev.seat), old: { uid: ev.old.uid, rank: ev.old.rank, suit: ev.old.suit } };
      case 'refund': return { type: 'refund', seat: S(ev.seat), amount: ev.amount };
      case 'peek': return S(ev.seat) === viewer ? { type: 'peek', seat: viewer } : null;
      case 'flip': return S(ev.seat) === viewer ? { type: 'flip', seat: viewer } : null;
      case 'showdown': return { type: 'showdown' };
      case 'win': return { type: 'win', reason: ev.reason, pots: ev.pots.map((p) => ({ amount: p.amount, winners: p.winners.map(S), shares: p.shares })) };
      case 'start': case 'deal': case 'swapStart': case 'swapNone': case 'cardsReady': case 'collect': case 'end':
        return { type: ev.type };
      case 'reveal': return { type: 'reveal', street: ev.street };
    }
  }

  broadcastState(ev?: MEvent) {
    for (const seat of this.seats) {
      const p = this.player(seat);
      if (!p.ws || p.isBot) continue;
      const ne = ev ? this.netEvent(ev, seat) : undefined;
      if (ev && ne === null) {
        send(p.ws, { t: 'table', state: this.stateFor(seat) });
        continue;
      }
      send(p.ws, { t: 'table', state: this.stateFor(seat), ev: ne ?? undefined });
    }
  }

  say(seat: number, text: string) {
    for (const p of this.room.players()) if (p.ws) send(p.ws, { t: 'say', seat, text });
  }

  // -------------------------------------------------------------------------
  // Kontrolcüler
  // -------------------------------------------------------------------------
  humanController(seat: number): MController {
    return {
      act: (e, i) => this.waitHuman(seat, 'act', TURN_MS, () => (e.legal(i).toCall > 0 ? { type: 'fold' } : { type: 'check' })),
      chooseSwap: () => this.waitHuman(seat, 'swap', SWAP_MS, () => null),
    };
  }

  waitHuman<T>(seat: number, kind: 'act' | 'swap', ms: number, fallback: () => T): Promise<T> {
    const p = this.player(seat);
    // bağlantısı kopuk oyuncu için kısa süre
    const wait = p.gone ? 400 : p.ws ? ms : Math.min(ms, 8000);
    return new Promise<T>((resolve) => {
      const done = (v: T) => {
        const pd = this.pending.get(seat);
        if (pd) clearTimeout(pd.timer);
        this.pending.delete(seat);
        resolve(v);
      };
      const timer = setTimeout(() => done(fallback()), wait);
      this.pending.set(seat, { kind, seat, resolve: done, timer });
      this.deadline = Date.now() + wait;
      this.broadcastState();
    });
  }

  onAction(seat: number, a: Action) {
    const pd = this.pending.get(seat);
    if (!pd || pd.kind !== 'act' || !a || typeof a !== 'object') return;
    const ok = ['fold', 'check', 'call', 'raise', 'burn', 'refund', 'peek', 'flip'].includes((a as any).type);
    if (!ok) return;
    const clean: any = { type: (a as any).type };
    if (clean.type === 'raise') clean.to = Math.floor(Number((a as any).to) || 0);
    if (clean.type === 'burn') clean.index = Math.floor(Number((a as any).index) || 0);
    pd.resolve(clean as Action);
  }

  onSwap(seat: number, c: SwapChoice | null) {
    const pd = this.pending.get(seat);
    if (!pd || pd.kind !== 'swap') return;
    if (c && typeof c === 'object') pd.resolve({ hand: Math.floor(Number(c.hand)), board: Math.floor(Number(c.board)) });
    else pd.resolve(null);
  }

  onReady(seat: number) {
    this.readySeats.add(seat);
    this.sendIntro();
    const humans = this.seats.filter((s) => !this.player(s).isBot && this.player(s).ws && !this.player(s).gone);
    if (humans.every((s) => this.readySeats.has(s))) this.introResolve?.();
  }

  sendIntro() {
    const humans = this.seats.filter((s) => !this.player(s).isBot);
    for (const seat of humans) {
      const p = this.player(seat);
      if (p.ws) send(p.ws, { t: 'intro', game: this.game, dealerGod: this.dealerGod, ready: [...this.readySeats], humans, deadline: this.deadline, state: this.stateFor(seat) });
    }
  }

  // -------------------------------------------------------------------------
  async run() {
    // tanrı oyunu anlatır; herkes hazır olana dek (en çok 45 sn) bekle
    this.phase = 'intro';
    this.deadline = Date.now() + INTRO_MS;
    this.sendIntro();
    await new Promise<void>((r) => {
      this.introResolve = r;
      setTimeout(r, INTRO_MS);
    });
    this.introResolve = null;

    while (!this.aborted) {
      const alive = this.seats.filter((s) => this.player(s).stack > 0);
      if (alive.length < 2) break;
      if (this.room.humansConnected() === 0) {
        this.aborted = true;
        break;
      }
      // blind seviyesi
      let bb = 2;
      for (let l = 0; l < Math.floor(this.handNo / 10); l++) bb = Math.ceil((bb * 1.5) / 2) * 2;
      this.bb = bb;
      // krupiye: sıradaki canlı oyuncu
      if (!alive.includes(this.dealerSeat)) this.dealerSeat = this.nextAlive(this.dealerSeat, alive);
      this.active = alive;
      this.phase = 'betting';
      const controllers = alive.map((seat) => {
        const p = this.player(seat);
        if (p.isBot) return new AIMultiController(GODS[p.godId!], { thinkMs: [900 * PACE_SCALE, 1300 * PACE_SCALE], samples: 300, say: (k) => Math.random() < 0.35 && this.say(seat, pick(GODS[p.godId!].lines[k])) });
        return this.humanController(seat);
      });
      const engine: MultiHandEngine = new MultiHandEngine({
        game: this.game,
        stacks: alive.map((s) => this.player(s).stack),
        names: alive.map((s) => this.player(s).name),
        dealer: alive.indexOf(this.dealerSeat),
        sb: this.sb,
        bb: this.bb,
        controllers,
        emit: async (ev) => {
          this.deadline = 0;
          this.broadcastState(ev);
          const ms = (PACE[ev.type] ?? 0) * PACE_SCALE;
          if (ev.type === 'peek' || ev.type === 'flip') return;
          if (ms) await sleep(ms);
        },
      });
      this.engine = engine;
      try {
        await engine.play();
      } catch (err) {
        console.error('el hatası', err);
        this.aborted = true;
        break;
      }
      alive.forEach((seat, i) => (this.player(seat).stack = engine.seats[i].stack));
      this.handNo++;
      const busted = alive.filter((s) => this.player(s).stack <= 0);
      this.phase = 'between';
      this.engine = null;
      if (busted.length) for (const p of this.room.players()) if (p.ws) send(p.ws, { t: 'table', state: this.stateFor(this.room.seatOf(p.token)), ev: { type: 'busted', seats: busted } });
      const still = this.seats.filter((s) => this.player(s).stack > 0);
      if (still.length < 2) break;
      this.dealerSeat = this.nextAlive(this.dealerSeat, still);
      // sonraki el için kısa mola
      const at = Date.now() + NEXT_HAND_MS * PACE_SCALE;
      this.deadline = at;
      for (const seat of this.seats) {
        const p = this.player(seat);
        if (p.ws) send(p.ws, { t: 'nextHand', at, state: this.stateFor(seat) });
      }
      await sleep(NEXT_HAND_MS * PACE_SCALE);
    }
    this.finish();
  }

  nextAlive(from: number, alive: number[]): number {
    for (let k = 1; k <= MAX_SEATS; k++) {
      const s = (from + k) % MAX_SEATS;
      if (alive.includes(s)) return s;
    }
    return alive[0];
  }

  finish() {
    const room = this.room;
    const order = this.seats.slice().sort((a, b) => this.player(b).stack - this.player(a).stack);
    const standings: Standing[] = order.map((seat, i) => ({ seat, name: this.player(seat).name, stack: this.player(seat).stack, place: i + 1 }));
    room.lastResult = standings;
    room.state = 'lobby';
    room.match = null;
    // kalıcı ayrılanları koltuktan kaldır
    room.seats = room.seats.map((p) => (p && p.gone ? null : p));
    for (const p of room.players()) if (p.ws) send(p.ws, { t: 'matchEnd', standings });
    if (!room.players().some((p) => p.token === room.hostToken && !p.isBot)) room.passHost();
    room.broadcastRoom();
  }
}

// ---------------------------------------------------------------------------
// Mesajlar
// ---------------------------------------------------------------------------
function handle(ws: WebSocket, ctx: { token: string }, msg: ClientMsg) {
  const token = ctx.token;
  const roomCode = tokenRoom.get(token);
  const room = roomCode ? rooms.get(roomCode) : undefined;
  const seat = room ? room.seatOf(token) : -1;
  const me = room && seat >= 0 ? room.seats[seat]! : null;
  const isHost = !!room && room.hostToken === token;
  const err = (m: string) => send(ws, { t: 'error', msg: m });

  switch (msg.t) {
    case 'create': {
      if (room && me) leave(room, token);
      const p: Player = { token, name: cleanName(msg.name), ws, isBot: false, stack: START_STACK, lastSeen: Date.now(), gone: false };
      const code = newCode();
      const r = new Room(code, p);
      rooms.set(code, r);
      tokenRoom.set(token, code);
      r.broadcastRoom();
      return;
    }
    case 'join': {
      const code = String(msg.code ?? '').trim();
      if (!/^\d{4}$/.test(code)) return err('Oda numarası 4 haneli olmalı.');
      const r = rooms.get(code);
      if (!r) return err('Bu numarada bir oda yok.');
      if (room && room !== r && me) leave(room, token);
      const existing = r.seatOf(token);
      if (existing >= 0) {
        const p = r.seats[existing]!;
        p.ws = ws;
        p.gone = false;
        p.name = cleanName(msg.name) || p.name;
        tokenRoom.set(token, code);
        r.broadcastRoom();
        resync(r, existing);
        return;
      }
      if (r.state === 'playing') return err('Bu masada oyun sürüyor. Bitince katılabilirsin.');
      const free = r.seats.findIndex((p, i) => !p && i < r.maxPlayers);
      if (free < 0) return err('Masa dolu.');
      r.seats[free] = { token, name: cleanName(msg.name), ws, isBot: false, stack: START_STACK, lastSeen: Date.now(), gone: false };
      tokenRoom.set(token, code);
      r.broadcastRoom();
      return;
    }
  }

  if (!room || !me) return err('Bir odada değilsin.');
  me.lastSeen = Date.now();

  switch (msg.t) {
    case 'setGame': {
      if (!isHost || room.state !== 'lobby') return;
      const g = msg.game;
      if (g !== 'random' && !(g in GAMES)) return;
      room.game = g;
      room.broadcastRoom();
      return;
    }
    case 'setMax': {
      if (!isHost || room.state !== 'lobby') return;
      const n = Math.floor(Number(msg.max));
      if (n < 2 || n > MAX_SEATS) return;
      if (room.seats.some((p, i) => p && i >= n)) return err('Önce fazladaki koltukları boşalt.');
      room.maxPlayers = n;
      room.broadcastRoom();
      return;
    }
    case 'addBot': {
      if (!isHost || room.state !== 'lobby') return;
      if (!GOD_ORDER.includes(msg.god)) return;
      const free = room.seats.findIndex((p, i) => !p && i < room.maxPlayers);
      if (free < 0) return err('Boş koltuk yok.');
      if (room.players().some((p) => p.isBot && p.godId === msg.god)) return err('Bu tanrı zaten masada.');
      room.seats[free] = { token: 'bot-' + crypto.randomUUID(), name: GODS[msg.god].name, ws: null, isBot: true, godId: msg.god, stack: START_STACK, lastSeen: Date.now(), gone: false };
      room.broadcastRoom();
      return;
    }
    case 'removeBot': {
      if (!isHost || room.state !== 'lobby') return;
      const p = room.seats[msg.seat];
      if (p?.isBot) room.seats[msg.seat] = null;
      room.broadcastRoom();
      return;
    }
    case 'start': {
      if (!isHost || room.state !== 'lobby') return;
      const count = room.players().filter((_, i) => i < room.maxPlayers).length;
      if (count < 2) return err('Başlamak için en az iki oyuncu gerekli (tanrı botu da ekleyebilirsin).');
      room.state = 'playing';
      room.lastResult = undefined;
      room.match = new OnlineMatch(room);
      room.broadcastRoom();
      room.match.run().catch((e) => console.error(e));
      return;
    }
    case 'ready':
      room.match?.onReady(seat);
      return;
    case 'action':
      room.match?.onAction(seat, msg.action);
      return;
    case 'swap':
      room.match?.onSwap(seat, msg.choice);
      return;
    case 'leave':
      leave(room, token);
      send(ws, { t: 'left' });
      return;
  }
}

function leave(room: Room, token: string) {
  const seat = room.seatOf(token);
  if (seat < 0) return;
  tokenRoom.delete(token);
  if (room.state === 'playing') {
    const p = room.seats[seat]!;
    p.gone = true;
    p.ws = null;
  } else {
    room.seats[seat] = null;
  }
  if (room.hostToken === token) room.passHost();
  if (room.humansConnected() === 0 && room.state === 'lobby') rooms.delete(room.code);
  else room.broadcastRoom();
}

function resync(room: Room, seat: number) {
  const p = room.seats[seat]!;
  if (!p.ws) return;
  send(p.ws, { t: 'room', room: room.view(p.token) });
  const m = room.match;
  if (!m) return;
  if (m.phase === 'intro') m.sendIntro();
  else send(p.ws, { t: 'table', state: m.stateFor(seat) });
}

// ---------------------------------------------------------------------------
// HTTP + WebSocket
// ---------------------------------------------------------------------------
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.webp': 'image/webp', '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end(`ok ${rooms.size} oda`);
  }
  let file = path.normalize(path.join(STATIC_DIR, url));
  if (!file.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    return res.end();
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(STATIC_DIR, 'index.html');
  fs.readFile(file, (e, data) => {
    if (e) {
      res.writeHead(404);
      return res.end('bulunamadı');
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024 });

wss.on('connection', (ws) => {
  const ctx = { token: '' };
  let count = 0;
  const window = setInterval(() => (count = 0), 1000);
  ws.on('message', (raw) => {
    if (++count > 30) return; // kaba hız sınırı
    let msg: ClientMsg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'hello') {
      const t = String(msg.token || '');
      if (!/^[\w-]{8,64}$/.test(t)) return;
      ctx.token = t;
      const code = tokenRoom.get(t);
      const room = code ? rooms.get(code) : undefined;
      if (room) {
        const seat = room.seatOf(t);
        if (seat >= 0) {
          const p = room.seats[seat]!;
          if (p.ws && p.ws !== ws) p.ws.close();
          p.ws = ws;
          p.gone = false;
          room.broadcastRoom();
          resync(room, seat);
        }
      }
      return;
    }
    if (!ctx.token) return send(ws, { t: 'error', msg: 'Önce bağlantı kurulmalı.' });
    try {
      handle(ws, ctx, msg);
    } catch (e) {
      console.error(e);
    }
  });
  ws.on('close', () => {
    clearInterval(window);
    const code = tokenRoom.get(ctx.token);
    const room = code ? rooms.get(code) : undefined;
    if (!room) return;
    const seat = room.seatOf(ctx.token);
    if (seat >= 0 && room.seats[seat]!.ws === ws) {
      room.seats[seat]!.ws = null;
      room.seats[seat]!.lastSeen = Date.now();
      room.broadcastRoom();
    }
  });
});

// terk edilmiş odaları temizle
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.humansConnected() > 0) {
      room.emptySince = 0;
      continue;
    }
    if (!room.emptySince) room.emptySince = now;
    if (now - room.emptySince > 10 * 60 * 1000) {
      if (room.match) room.match.aborted = true;
      for (const p of room.players()) tokenRoom.delete(p.token);
      rooms.delete(code);
    }
  }
}, 30000);

server.listen(PORT, HOST, () => console.log(`Yedi Tanrının Masası sunucusu: http://${HOST}:${PORT}  (statik: ${STATIC_DIR})`));
