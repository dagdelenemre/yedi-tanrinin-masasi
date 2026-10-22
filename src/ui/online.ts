import { RANK_LABELS, SUIT_SYMBOLS, cardLabel } from '../engine/cards';
import { describe, drawHints } from '../engine/evaluator';
import { equityMulti } from '../engine/equity';
import { GAMES, GameId, GODS, GOD_ORDER, GodId, pick } from '../engine/gods';
import { Action, FLIP_SUIT, STREET_NAMES } from '../engine/hand';
import { net } from '../net/client';
import { CardView, GameChoice, MAX_SEATS, NetEvent, RoomView, SeatView, ServerMsg, Standing, TableState } from '../net/protocol';
import { portrait, sevenStar } from './art';
import { isMuted, setMuted, sfx, startAmbient, stopAmbient } from './audio';
import { createCardEl, miniCards, setCardFace } from './cardview';
import { h, modal, nextFrame, save, sleep, stageEl, store } from './dom';
import { Mood, godFigure } from './figures';
import { ICON, MEDAL } from './icons';
import { GOD_PARTICLES, Particles, godScene, templeScene } from './scenes';
import { actText, chipStacks, clampInt, escapeHtml, medal, pips, place, tableSVG } from './table';

// ---------------------------------------------------------------------------
// ÇEVRİMİÇİ MASA: giriş → lobi → masa → sonuç
// ---------------------------------------------------------------------------

let back: () => void = () => {};
let room: RoomView | null = null;
let table: OnlineTable | null = null;
let lobbyEl: HTMLElement | null = null;
let unsub: (() => void) | null = null;
let particles: Particles | null = null;

function clear() {
  particles?.destroy();
  particles = null;
  const s = stageEl();
  s.innerHTML = '';
  return s;
}

function templeScreen(cls: string, ...children: (Node | null)[]) {
  const st = clear();
  particles = new Particles('dust', 40);
  const el = h('div', { class: 'screen ' + cls }, h('div', { class: 'scene-bg', html: templeScene() }), particles.canvas, h('div', { class: 'menu-shade' }), ...children);
  st.append(el);
  startAmbient(41.2);
  return el;
}

function onMessage(m: ServerMsg) {
  switch (m.t) {
    case 'error':
      toast(m.msg);
      break;
    case 'room':
      room = m.room;
      if (!table) showLobby();
      else if (room.state === 'lobby' && !table.ended) {
        // maç sunucuda bitti/iptal: masadan lobiye
      }
      break;
    case 'left':
      room = null;
      table?.destroy();
      table = null;
      showOnline(back);
      break;
    case 'intro':
      if (!table) table = new OnlineTable();
      table.intro(m);
      break;
    case 'table':
      if (!table) table = new OnlineTable();
      table.push(m.state, m.ev);
      break;
    case 'nextHand':
      table?.nextHand(m.at, m.state);
      break;
    case 'say':
      table?.speak(m.seat, m.text);
      break;
    case 'matchEnd':
      table?.matchEnd(m.standings);
      break;
  }
}

function toast(msg: string) {
  const t = h('div', { class: 'toast' }, msg);
  stageEl().append(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3200);
}

function statusLine() {
  const el = h('div', { class: 'net-status' });
  const upd = () => {
    el.textContent = net.status === 'open' ? 'Tanrıların sunucusuna bağlısın' : net.status === 'connecting' ? 'Sunucuya bağlanılıyor…' : 'Bağlantı yok · yeniden deneniyor';
    el.className = 'net-status ' + net.status;
  };
  upd();
  const off = net.onStatus(upd);
  const obs = new MutationObserver(() => {
    if (!el.isConnected) {
      off();
      obs.disconnect();
    }
  });
  obs.observe(stageEl(), { childList: true });
  return el;
}

// ---------------------------------------------------------------------------
// Giriş: oda kur / katıl
// ---------------------------------------------------------------------------
export function showOnline(onBack: () => void, prefillCode = '') {
  back = onBack;
  if (!unsub) unsub = net.on(onMessage);
  net.connect();
  table = null;
  lobbyEl = null;
  const name = h('input', { class: 'ink-input', type: 'text', maxlength: 16, placeholder: 'Adın', autocomplete: 'nickname', value: store('ytm-name', '') }) as HTMLInputElement;
  // type="tel": telefonlarda doğrudan rakam klavyesi açılır, sözcük önerisi/IME araya girmez
  const code = h('input', { class: 'ink-input code', type: 'tel', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 4, placeholder: '····', autocomplete: 'off', value: prefillCode }) as HTMLInputElement;
  // rakam dışını temizle; değeri yalnızca gerçekten değiştiyse yaz (aksi halde Android klavyesi tuşları yutabiliyor)
  const digitsOnly = (v: string) =>
    v
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)) // Arapça rakamlar
      .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0)) // Farsça rakamlar
      .replace(/\D/g, '')
      .slice(0, 4);
  code.addEventListener('input', () => {
    const v = digitsOnly(code.value);
    if (v !== code.value) code.value = v;
  });
  const getName = () => {
    const n = name.value.trim();
    if (!n) {
      name.focus();
      toast('Önce masada görünecek adını yaz.');
      return null;
    }
    save('ytm-name', n);
    return n;
  };
  const create = h('button', { class: 'btn primary big' }, 'Yeni masa kur');
  create.onclick = () => {
    const n = getName();
    if (n) net.send({ t: 'create', name: n });
  };
  const join = h('button', { class: 'btn big' }, 'Katıl');
  join.onclick = () => {
    const n = getName();
    if (!n) return;
    const c = digitsOnly(code.value);
    if (!/^\d{4}$/.test(c)) return toast('Oda numarası 4 haneli.');
    net.send({ t: 'join', code: c, name: n });
  };
  // Not: onkeydown bir işleyicide `false` döndürmek tuşu iptal eder; bu yüzden addEventListener
  code.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') join.click();
  });
  const panel = h(
    'div',
    { class: 'online-panel parchment' },
    h('div', { class: 'modal-kicker' }, 'Çevrimiçi masa'),
    h('h2', { class: 'op-title' }, 'Masaya davet'),
    h('p', { class: 'op-text' }, 'İki ila dört kişi aynı masaya oturur. Biri masayı kurar, ötekiler oda numarasıyla katılır. Boş koltuklara tanrılar oturabilir.'),
    h('label', { class: 'op-label' }, 'Masada görünecek adın'),
    name,
    h('div', { class: 'op-cols' },
      h('div', { class: 'op-col' }, h('div', { class: 'op-label' }, 'Masayı sen kur'), h('p', { class: 'op-small' }, 'Oyunu ve oyuncu sayısını sen seçersin.'), create),
      h('div', { class: 'op-or' }, 'ya da'),
      h('div', { class: 'op-col' }, h('div', { class: 'op-label' }, 'Oda numarasıyla katıl'), code, join),
    ),
    statusLine(),
  );
  templeScreen(
    'online-screen',
    h('div', { class: 'ch-head' }, h('button', { class: 'text-link', onclick: () => { net.disconnect(); onBack(); }, html: `${ICON.back}<span>Yol ayrımı</span>` })),
    panel,
  );
}

// ---------------------------------------------------------------------------
// Lobi
// ---------------------------------------------------------------------------
function showLobby() {
  if (!room) return;
  const r = room;
  const isHost = r.seats[r.you]?.isHost;
  const seats = h('div', { class: 'lobby-seats' });
  for (let i = 0; i < r.maxPlayers; i++) {
    const p = r.seats[i];
    if (p) {
      const face = p.isBot && p.godId ? portrait(p.godId) : `<span>${escapeHtml(p.name.slice(0, 1).toLocaleUpperCase('tr'))}</span>`;
      const tags = [p.isHost ? 'ev sahibi' : '', i === r.you ? 'sen' : '', p.isBot ? 'tanrı' : '', !p.connected ? 'bağlantı yok' : ''].filter(Boolean).join(' · ');
      const row = h('div', { class: 'lseat' + (i === r.you ? ' me' : '') + (p.connected ? '' : ' off') },
        h('div', { class: 'ls-face', html: face }),
        h('div', { class: 'ls-info' }, h('div', { class: 'ls-name' }, p.name), h('div', { class: 'ls-tags' }, tags)),
      );
      if (isHost && p.isBot) {
        const rm = h('button', { class: 'text-link small' }, 'kaldır');
        rm.onclick = () => net.send({ t: 'removeBot', seat: i });
        row.append(rm);
      }
      seats.append(row);
    } else {
      const row = h('div', { class: 'lseat empty' }, h('div', { class: 'ls-face', html: '<span>·</span>' }), h('div', { class: 'ls-info' }, h('div', { class: 'ls-name' }, 'Boş koltuk'), h('div', { class: 'ls-tags' }, 'arkadaşın oda numarasıyla katılabilir')));
      if (isHost) {
        const add = h('button', { class: 'text-link small' }, 'tanrı oturt');
        add.onclick = () => godPicker(r);
        row.append(add);
      }
      seats.append(row);
    }
  }
  // ayarlar
  const settings = h('div', { class: 'lobby-settings' });
  const gameList = h('div', { class: 'game-list' });
  const choices: GameChoice[] = ['random', 'klasik', ...GOD_ORDER];
  for (const g of choices) {
    const label = g === 'random' ? 'Rastgele' : GAMES[g].name;
    const sub = g === 'random' ? 'kader seçer' : g === 'klasik' ? 'temel oyun' : GODS[g as GodId].name;
    const b = h('button', { class: 'gl-opt' + (r.game === g ? ' on' : ''), disabled: !isHost && r.game !== g ? true : undefined }, h('span', { class: 'glo-name' }, label), h('span', { class: 'glo-sub' }, sub));
    if (isHost) b.onclick = () => net.send({ t: 'setGame', game: g });
    gameList.append(b);
  }
  const counts = h('div', { class: 'count-row' }, h('span', { class: 'op-label' }, 'Koltuk sayısı'));
  for (const n of [2, 3, 4]) {
    const b = h('button', { class: 'count-opt' + (r.maxPlayers === n ? ' on' : '') }, String(n));
    if (isHost) b.onclick = () => net.send({ t: 'setMax', max: n });
    else b.setAttribute('disabled', '');
    counts.append(b);
  }
  settings.append(h('div', { class: 'op-label' }, 'Masada oynanacak oyun'), gameList, counts);
  const filled = r.seats.slice(0, r.maxPlayers).filter(Boolean).length;
  const start = isHost
    ? h('button', { class: 'wax-seal big', html: '<span>Masayı<br>kur</span>' })
    : h('div', { class: 'wait-host' }, 'Ev sahibi masayı kurduğunda oyun başlar.');
  if (isHost) (start as HTMLButtonElement).onclick = () => (filled < 2 ? toast('En az iki oyuncu gerekli. Boş koltuğa bir tanrı oturtabilirsin.') : net.send({ t: 'start' }));
  const result = r.lastResult
    ? h('div', { class: 'last-result' }, h('div', { class: 'op-label' }, 'Son maç'), ...r.lastResult.map((s) => h('div', { class: 'lr-row' }, h('span', {}, `${s.place}.`), h('b', {}, s.name), h('span', {}, `${s.stack} puan`))))
    : null;
  const invite = h('button', { class: 'text-link invite' }, 'Davet bağlantısını kopyala');
  invite.onclick = async () => {
    const url = `${location.origin}/?oda=${r.code}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Bağlantı kopyalandı. Arkadaşına gönder, açınca doğrudan katılma ekranına gelir.');
    } catch {
      window.prompt('Bu bağlantıyı kopyalayıp gönder:', url);
    }
  };
  const leave = h('button', { class: 'text-link', html: `${ICON.back}<span>Masadan ayrıl</span>` });
  leave.onclick = () => net.send({ t: 'leave' });

  const content = h(
    'div',
    { class: 'lobby' },
    h('div', { class: 'lobby-left' },
      h('div', { class: 'room-kicker' }, 'Oda numarası'),
      h('div', { class: 'room-code' }, r.code),
      h('div', { class: 'room-hint' }, 'Bu numarayı arkadaşlarına ver ya da davet bağlantısını gönder.'),
      invite,
      seats,
      result,
    ),
    h('div', { class: 'lobby-right parchment' }, settings, h('div', { class: 'lobby-start' }, start), statusLine()),
  );
  if (lobbyEl && lobbyEl.isConnected) {
    lobbyEl.querySelector('.lobby')?.replaceWith(content);
    return;
  }
  lobbyEl = templeScreen('lobby-screen', h('div', { class: 'ch-head' }, leave, h('div', {}, h('h2', {}, 'Çevrimiçi masa'), h('div', { class: 'sub' }, 'Koltuklar doldukça masa canlanır.'))), content);
}

function godPicker(r: RoomView) {
  const used = new Set(r.seats.filter((p) => p?.isBot).map((p) => p!.godId));
  const grid = h('div', { class: 'joker-grid' });
  const m = modal(h('div', {}, h('div', { class: 'modal-kicker' }, 'Boş koltuk'), h('h2', {}, 'Hangi tanrı otursun?'), grid), { closable: true, className: 'joker-modal' });
  for (const g of GOD_ORDER) {
    const b = h('button', { class: 'joker-opt god-opt', disabled: used.has(g) ? true : undefined }, h('div', { class: 'go-face', html: portrait(g) }), h('div', { class: 'jo-name' }, GODS[g].name), h('div', { class: 'jo-short' }, GODS[g].style));
    b.onclick = () => {
      net.send({ t: 'addBot', god: g });
      m.close();
    };
    grid.append(b);
  }
}

// ---------------------------------------------------------------------------
// Çok oyunculu masa
// ---------------------------------------------------------------------------
interface Rect { x: number; y: number; w: number; h: number }
type Slot = 'left' | 'far' | 'right';
const DECK: Rect = { x: 800, y: 404, w: 50, h: 72 };
const PEEK: Rect = { x: 330, y: 480, w: 62, h: 88 };
const boardRect = (i: number): Rect => ({ x: 422 + i * 90, y: 476, w: 76, h: 106 });
const meRect = (i: number): Rect => ({ x: 500 + i * 158, y: 618, w: 120, h: 168 });
const SLOT_CARDS: Record<Slot, [number, number][]> = { left: [[228, 452], [280, 452]], far: [[330, 398], [382, 398]], right: [[946, 452], [998, 452]] };
const SLOT_BET: Record<Slot, [number, number]> = { left: [346, 452], far: [440, 400], right: [878, 452] };
const SLOT_DEALER: Record<Slot | 'me', [number, number]> = { left: [234, 530], far: [336, 476], right: [1052, 530], me: [828, 660] };
const SLOT_CHIP: Record<Slot | 'me' | 'pot', [number, number]> = { left: [120, 330], far: [120, 210], right: [1160, 330], me: [150, 650], pot: [640, 430] };

class OnlineTable {
  root: HTMLElement;
  state: TableState | null = null;
  ended = false;
  private cards = new Map<string, HTMLElement>();
  private shown = new Map<string, string>();
  private layer: HTMLElement;
  private el: Record<string, HTMLElement> = {};
  private seatEls = new Map<number, { plate: HTMLElement; bet: HTMLElement; act: HTMLElement; hl: HTMLElement; dealer: HTMLElement; slot: Slot }>();
  private particles: Particles | null = null;
  private queue: Promise<void> = Promise.resolve();
  private timer = 0;
  private eqSig = '';
  private eqVal = 0;
  private select: null | { hand?: number; board?: number } = null;
  private burnMode = false;
  private sentSwap = false;
  private introEl: HTMLElement | null = null;
  private keyHandler: (e: KeyboardEvent) => void;
  private moodTimer = 0;
  private god: GodId | null = null;
  /** işlenmeyi bekleyen mesaj sayısı: geride kalınca animasyonlar atlanır */
  private backlog = 0;
  private get fast() {
    return document.hidden || this.backlog > 1;
  }

  constructor() {
    this.root = h('div', { class: 'screen table-screen online' });
    this.layer = h('div', { class: 'cards-layer' });
    clear().append(this.root);
    this.keyHandler = (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || document.querySelector('.modal-backdrop')) return;
      const k = e.key.toLowerCase();
      if (k === 'k') this.el.drawer?.classList.toggle('open');
      const map: Record<string, string> = { f: '.fold-btn', c: '.call-btn', r: '.raise-btn' };
      if (map[k]) (this.el.actions?.querySelector(map[k]) as HTMLButtonElement)?.click();
      if ((k === ' ' || k === 'enter') && this.introEl) (this.introEl.querySelector('.wax-seal') as HTMLButtonElement)?.click();
    };
    window.addEventListener('keydown', this.keyHandler);
    this.timer = window.setInterval(() => this.tick(), 250);
  }

  destroy() {
    window.removeEventListener('keydown', this.keyHandler);
    clearInterval(this.timer);
    this.particles?.destroy();
    stopAmbient();
    this.root.remove();
  }

  /** İlk durumda masayı tanrıya göre kur */
  private build(st: TableState) {
    if (this.god === st.dealerGod) return;
    this.god = st.dealerGod;
    const g = GODS[st.dealerGod];
    this.root.innerHTML = '';
    this.cards.clear();
    this.shown.clear();
    this.seatEls.clear();
    this.root.className = `screen table-screen online god-${g.id}`;
    this.root.style.setProperty('--god', g.color);
    this.root.style.setProperty('--god-accent', g.accent);
    this.particles?.destroy();
    this.particles = new Particles(GOD_PARTICLES[g.id], 60);
    const fig = godFigure(g.id);
    this.el.stage = h('div', { class: 'god-stage', 'data-mood': 'neutral', html: `<div class="god-body">${fig.body}</div>` });
    this.el.hands = h('div', { class: 'god-hands', 'data-mood': 'neutral', html: fig.hands });
    this.el.deck = h('div', { class: 'deck', style: { left: DECK.x + 'px', top: DECK.y + 'px' } });
    for (let i = 0; i < 5; i++) {
      const c = createCardEl();
      c.classList.add('on-table');
      c.style.cssText = `left:${-i * 1.2}px;top:${-i * 1.6}px;width:${DECK.w}px;height:${DECK.h}px`;
      this.el.deck.append(c);
    }
    this.el.pot = h('div', { class: 'pot' });
    this.el.meBet = h('div', { class: 'bet me-bet' });
    this.el.meDealer = h('div', { class: 'dealer-chip' }, 'D');
    this.el.meAct = h('div', { class: 'act-float me-act' });
    this.el.meHL = h('div', { class: 'hand-label me-hl' });
    this.el.dealerPlate = h('div', { class: 'dealer-plate' });
    this.el.speech = h('div', { class: 'speech' });
    this.el.meStack = h('div', { class: 'mp-stack' });
    this.el.meHand = h('div', { class: 'mp-hand' });
    this.el.mePlate = h('div', { class: 'me-plate' }, h('div', { class: 'mp-label' }, 'Sen'), this.el.meStack, h('div', { class: 'orn-line' }), this.el.meHand);
    this.el.timerBar = h('div', { class: 'turn-timer' }, h('i'));
    this.el.ability = h('div', { class: 'ability' });
    this.el.actions = h('div', { class: 'actions' });
    this.el.prompt = h('div', { class: 'prompt' });
    this.el.overlay = h('div', { class: 'overlay-layer' });
    this.el.dHand = h('div', { class: 'd-hand' });
    this.el.dEq = h('div', { class: 'd-eq' });
    this.el.dLog = h('div', { class: 'd-log' });
    const closeD = h('button', { class: 'd-close', html: ICON.close });
    this.el.drawer = h('div', { class: 'drawer' + (store('ytm-drawer', false) ? ' open' : '') }, closeD,
      h('div', { class: 'dg-name' }, GAMES[st.game].name), h('div', { class: 'dg-short' }, GAMES[st.game].short),
      h('div', { class: 'd-sec' }, h('div', { class: 'd-label' }, 'Elin'), this.el.dHand, this.el.dEq),
      h('div', { class: 'd-sec log' }, h('div', { class: 'd-label' }, 'Masa kaydı'), this.el.dLog));
    closeD.onclick = () => this.el.drawer.classList.remove('open');
    const link = (icon: string, label: string, fn: () => void) => {
      const b = h('button', { class: 'hud-link', html: `${icon}<span>${label}</span>` });
      b.onclick = fn;
      return b;
    };
    const mute = link(isMuted() ? ICON.soundOff : ICON.soundOn, 'Ses', () => {
      setMuted(!isMuted());
      mute.innerHTML = `${isMuted() ? ICON.soundOff : ICON.soundOn}<span>Ses</span>`;
    });
    const hud = h('div', { class: 'hud-top' },
      link(ICON.book, 'Notlar', () => {
        const open = !this.el.drawer.classList.contains('open');
        this.el.drawer.classList.toggle('open', open);
        save('ytm-drawer', open);
      }),
      link(ICON.scroll, 'Kurallar', () => this.showRules()),
      mute,
      link(ICON.close, 'Masadan kalk', () => this.confirmLeave()),
    );
    this.root.append(
      h('div', { class: 'scene', html: godScene(g.id) }),
      h('div', { class: 'god-aura' }),
      this.el.stage,
      this.particles.canvas,
      h('div', { class: 'table-surface', html: tableSVG() }),
      this.el.hands,
      this.el.deck, this.el.pot, this.el.meBet, this.el.meDealer,
      this.layer,
      h('div', { class: 'vignette' }),
      this.el.dealerPlate, this.el.speech, this.el.mePlate, this.el.timerBar, this.el.ability, this.el.actions, this.el.prompt, this.el.meAct, this.el.meHL,
      hud, this.el.drawer, this.el.overlay,
    );
    startAmbient(55);
  }

  /** koltuk düzeni: ben altta, diğerleri saat yönünde sol → karşı → sağ */
  private slots(st: TableState): Map<number, Slot> {
    const others: number[] = [];
    for (let k = 1; k < MAX_SEATS; k++) {
      const s = (st.you + k) % MAX_SEATS;
      if (st.seats.some((x) => x.seat === s)) others.push(s);
    }
    const layout: Slot[][] = [[], ['far'], ['left', 'right'], ['left', 'far', 'right']];
    const m = new Map<number, Slot>();
    others.forEach((s, i) => m.set(s, layout[others.length][i]));
    return m;
  }

  private ensureSeats(st: TableState) {
    const slots = this.slots(st);
    for (const sv of st.seats) {
      if (sv.seat === st.you || this.seatEls.has(sv.seat)) continue;
      const slot = slots.get(sv.seat)!;
      const face = sv.isBot && sv.godId ? portrait(sv.godId) : `<span>${escapeHtml(sv.name.slice(0, 1).toLocaleUpperCase('tr'))}</span>`;
      const plate = h('div', { class: `oseat slot-${slot}` }, h('div', { class: 'os-face', html: face + '<i class="os-ring"></i>' }), h('div', { class: 'os-info' }, h('div', { class: 'os-name' }, sv.name), h('div', { class: 'os-stack' }), h('div', { class: 'os-status' })));
      const [bx, by] = SLOT_BET[slot];
      const bet = h('div', { class: 'bet', style: { left: bx + 'px', top: by + 'px' } });
      const [dx, dy] = SLOT_DEALER[slot];
      const dealer = h('div', { class: 'dealer-chip', style: { left: dx + 'px', top: dy + 'px' } }, 'D');
      const act = h('div', { class: `act-float oseat-act slot-${slot}` });
      const hl = h('div', { class: `hand-label oseat-hl slot-${slot}` });
      this.root.insertBefore(bet, this.layer);
      this.root.insertBefore(dealer, this.layer);
      this.el.mePlate.before(plate);
      this.root.append(act, hl);
      this.seatEls.set(sv.seat, { plate, bet, act, hl, dealer, slot });
    }
  }

  // -------------------------------------------------------------------------
  intro(m: Extract<ServerMsg, { t: 'intro' }>) {
    this.build(m.state);
    this.state = m.state;
    this.ensureSeats(m.state);
    this.sync();
    const gd = GAMES[m.game];
    const g = GODS[m.dealerGod];
    const readyTxt = `${m.ready.length} / ${m.humans.length} oyuncu hazır`;
    if (this.introEl) {
      this.introEl.querySelector('.is-stacks')!.textContent = readyTxt;
      return;
    }
    const seal = h('button', { class: 'wax-seal', html: '<span>Hazırım</span>' });
    const scroll = h('div', { class: 'intro-scroll' },
      h('div', { class: 'is-kicker' }, `Çevrimiçi masa · krupiye ${g.name}`),
      h('div', { class: 'is-title' }, gd.name),
      h('div', { class: 'is-owner' }, m.game === 'klasik' ? 'Temel oyun' : `${g.name} anlatıyor`),
      h('p', { class: 'is-pitch' }, gd.pitch),
      h('div', { class: 'is-rule-head' }, 'Masanın kuralları'),
      h('ol', { class: 'is-rules' }, ...gd.rules.map((r) => h('li', {}, r)), ...(m.game === 'barbaz' ? [h('li', {}, 'Kalabalık masada en yüksek atan, en düşük atanın puanından çalar.')] : [])),
      h('div', { class: 'is-tip' }, h('span', { class: 'is-tip-head' }, 'Hizmetçinin notu · '), gd.tip),
      h('div', { class: 'is-foot' }, h('span', { class: 'is-stacks' }, readyTxt), seal),
    );
    this.introEl = h('div', { class: 'intro-wrap' }, scroll);
    this.root.append(this.introEl);
    this.say(g.name, pick(g.lines.intro), 6000);
    seal.onclick = () => {
      net.send({ t: 'ready' });
      seal.setAttribute('disabled', '');
      seal.innerHTML = '<span>Hazır</span>';
      sfx.click();
    };
  }

  private closeIntro() {
    if (!this.introEl) return;
    const el = this.introEl;
    this.introEl = null;
    el.classList.add('out');
    setTimeout(() => el.remove(), 500);
  }

  push(st: TableState, ev?: NetEvent) {
    this.backlog++;
    this.queue = this.queue
      .then(() => this.apply(st, ev))
      .catch((e) => console.error(e))
      .finally(() => this.backlog--);
  }

  private async apply(st: TableState, ev?: NetEvent) {
    this.build(st);
    if (st.phase !== 'intro') this.closeIntro();
    const prev = this.state;
    this.state = st;
    this.ensureSeats(st);
    if (ev) await this.onEvent(ev, st, prev);
    this.sync();
  }

  nextHand(at: number, st: TableState) {
    this.push(st);
    this.queue = this.queue.then(() => {
      this.el.actions.className = 'actions active single';
      const sec = Math.max(1, Math.round((at - Date.now()) / 1000));
      this.el.actions.innerHTML = '';
      const cnt = h('div', { class: 'cont-result' }, `Sonraki el ${sec} saniye içinde`);
      this.el.actions.append(cnt);
      const iv = setInterval(() => {
        const s = Math.round((at - Date.now()) / 1000);
        if (s <= 0 || !cnt.isConnected) return clearInterval(iv);
        cnt.textContent = `Sonraki el ${s} saniye içinde`;
      }, 500);
    });
  }

  speak(seat: number, text: string) {
    const sv = this.state?.seats.find((s) => s.seat === seat);
    this.say(sv?.name ?? '', text);
  }

  private say(name: string, text: string, ms = 3500) {
    const s = this.el.speech as HTMLElement & { _t?: number };
    if (!s) return;
    s.innerHTML = '';
    s.append(h('div', { class: 'sp-name' }, name), h('div', { class: 'sp-text' }, `“${text}”`));
    s.classList.add('show');
    clearTimeout(s._t);
    s._t = window.setTimeout(() => s.classList.remove('show'), ms);
  }

  private setMood(m: Mood, ms = 2500) {
    this.el.stage.dataset.mood = m;
    this.el.hands.dataset.mood = m;
    clearTimeout(this.moodTimer);
    this.moodTimer = window.setTimeout(() => {
      this.el.stage.dataset.mood = 'neutral';
      this.el.hands.dataset.mood = 'neutral';
    }, ms);
  }

  private name(st: TableState, seat: number) {
    return seat === st.you ? 'Sen' : st.seats.find((s) => s.seat === seat)?.name ?? '?';
  }

  private chipPos(seat: number): [number, number] {
    if (!this.state || seat === this.state.you) return SLOT_CHIP.me;
    const se = this.seatEls.get(seat);
    return se ? SLOT_CHIP[se.slot] : SLOT_CHIP.pot;
  }

  private async onEvent(ev: NetEvent, st: TableState, prev: TableState | null) {
    const nm = (s: number) => this.name(st, s);
    switch (ev.type) {
      case 'start':
        this.clearTable();
        this.select = null;
        this.sentSwap = false;
        this.burnMode = false;
        this.eqSig = '';
        this.log(`— ${st.handNo + 1}. el —`, 'sep');
        break;
      case 'dice':
        await this.dice(ev.rolls, ev.tie, st);
        break;
      case 'steal':
        this.clearDice();
        if (ev.amount > 0) {
          sfx.steal();
          this.fly(this.chipPos(ev.from), this.chipPos(ev.to), ev.amount);
          this.log(ev.to === st.you ? `Zarda kazandın, ${nm(ev.from)} oyuncusundan ${ev.amount} puan çaldın.` : `${nm(ev.to)} zarda kazandı, ${ev.from === st.you ? 'senden' : nm(ev.from) + ' oyuncusundan'} ${ev.amount} puan çaldı.`, ev.to === st.you ? 'good' : ev.from === st.you ? 'bad' : '');
          this.banner(`${nm(ev.to)} ${ev.amount} puan çaldı`, ev.to === st.you ? 'good' : ev.from === st.you ? 'bad' : 'info');
        }
        break;
      case 'blind':
        sfx.chip();
        break;
      case 'deal':
        this.log(`Blindlar ${st.sb}/${st.bb}. Kartlar dağıtıldı.`);
        sfx.card();
        setTimeout(() => sfx.card(), 300);
        break;
      case 'swapStart':
        this.flash('Kör Takas');
        break;
      case 'swapNone':
        this.log('Kimse takas yapmadı.');
        break;
      case 'swapConflict':
        if (!ev.byDice) {
          sfx.alert();
          this.banner('Aynı kart seçildi', 'info');
          this.log(`Aynı yer kartını seçenler: ${ev.seats.map(nm).join(', ')}. Tutulan kartlar açıldı.`);
        }
        if (ev.winner >= 0) this.log(`Yer kartı ${nm(ev.winner)} oyuncusunun.`, ev.winner === st.you ? 'good' : '');
        break;
      case 'swap':
        sfx.card();
        this.log(`${nm(ev.seat)} kör takas yaptı (yerdeki ${ev.board + 1}. kart).`);
        break;
      case 'swapDraw':
        sfx.card();
        this.log(`${nm(ev.seat)} destenin üstünden kart aldı.`);
        break;
      case 'cardsReady':
        this.clearControls();
        if (st.game === 'kesh') sfx.flip();
        break;
      case 'reveal': {
        const c = st.board[st.board.length - 1];
        sfx.flip();
        this.flash(STREET_NAMES[ev.street]);
        if (c?.rank) this.log(`${STREET_NAMES[ev.street]}: ${cardLabel(c as any)}`);
        break;
      }
      case 'act': {
        const txt = actText(ev.kind, ev.amount, ev.to);
        this.float(ev.seat, txt, ev.kind);
        this.log(`${nm(ev.seat)}: ${txt}`, ev.seat === st.you ? '' : 'god');
        if (ev.amount > 0) ev.kind === 'allin' ? sfx.chips() : sfx.chip();
        else sfx.click();
        if (ev.kind === 'allin') this.setMood('smug');
        break;
      }
      case 'uncalled':
        this.log(`${nm(ev.seat)} karşılıksız ${ev.amount} puanı geri aldı.`);
        break;
      case 'collect':
        if (this.fast) break;
        sfx.chips();
        await this.collect();
        break;
      case 'burn': {
        sfx.burn();
        const el = this.cards.get('c' + ev.old.uid);
        if (el) {
          el.classList.add('burning');
          if (!this.fast) await sleep(780);
          el.remove();
          this.cards.delete('c' + ev.old.uid);
          this.shown.delete('c' + ev.old.uid);
        }
        this.log(`${nm(ev.seat)} ${ev.old.rank ? cardLabel(ev.old as any) : 'bir'} kartını yaktı.`);
        break;
      }
      case 'refund':
        sfx.magic();
        this.fly(SLOT_CHIP.pot, this.chipPos(ev.seat), ev.amount);
        this.float(ev.seat, `Geri aldı +${ev.amount}`, 'refund');
        this.log(`${nm(ev.seat)} son bahsinin yarısını geri aldı (+${ev.amount}).`);
        break;
      case 'peek':
        sfx.magic();
        if (st.peek?.rank) this.log(`Kehanet: sıradaki kart ${cardLabel(st.peek as any)}`, 'good');
        break;
      case 'flip':
        sfx.magic();
        for (const c of st.seats.find((s) => s.seat === st.you)?.hole ?? []) {
          const el = this.cards.get('c' + c.uid);
          el?.classList.add('transmute');
          setTimeout(() => el?.classList.remove('transmute'), 1000);
        }
        this.log('Simya: kartlarının rengi çevrildi.', 'good');
        break;
      case 'showdown':
        sfx.flip();
        this.setMood('think');
        st.showdown?.forEach((info, i) => {
          if (!info) return;
          const seat = st.seats[i]?.seat;
          if (seat === undefined) return;
          const text = `${info.name}${info.detail ? ' · ' + info.detail : ''}`;
          if (seat === st.you) {
            this.el.meHL.textContent = text;
            this.el.meHL.classList.add('show');
          } else {
            const se = this.seatEls.get(seat);
            if (se) {
              se.hl.textContent = text;
              se.hl.classList.add('show');
            }
          }
          this.log(`${nm(seat)}: ${info.name}`);
        });
        break;
      case 'win': {
        const parts: string[] = [];
        let mine = 0;
        for (const p of ev.pots) {
          p.winners.forEach((w, k) => {
            this.fly(SLOT_CHIP.pot, this.chipPos(w), p.shares[k]);
            if (w === st.you) mine += p.shares[k];
          });
          parts.push(
            p.winners.length > 1
              ? `${p.winners.map(nm).join(' ve ')} ${p.amount} puanı paylaştı`
              : p.winners[0] === st.you
                ? `${p.amount} puanı aldın`
                : `${nm(p.winners[0])} ${p.amount} puanı aldı`,
          );
        }
        const txt = parts.join(' · ');
        this.log(txt, mine > 0 ? 'good' : '');
        if (mine > 0) sfx.win();
        else sfx.lose();
        this.banner(mine > 0 ? `Kazandın · +${mine}` : parts[0], mine > 0 ? 'good' : 'info');
        break;
      }
      case 'busted':
        for (const s of ev.seats) {
          this.log(`${nm(s)} masadan düştü.`, s === st.you ? 'bad' : '');
          this.banner(s === st.you ? 'Puanın bitti. Masayı izleyebilirsin.' : `${nm(s)} iflas etti`, s === st.you ? 'bad' : 'info');
        }
        break;
      case 'end':
        break;
    }
    void prev;
  }

  // -------------------------------------------------------------------------
  private sync() {
    const st = this.state;
    if (!st) return;
    // kartlar
    const specs: { key: string; card: CardView; rect: Rect; tilt: boolean; rot?: number; cls?: string; z: number }[] = [];
    for (const sv of st.seats) {
      if (!sv.inHand) continue;
      if (sv.seat === st.you) {
        sv.hole.forEach((c, i) => specs.push({ key: 'c' + c.uid, card: c, rect: meRect(i), tilt: false, rot: i ? 7 : -7, z: 70 + i, cls: sv.folded ? 'folded' : '' }));
      } else {
        const se = this.seatEls.get(sv.seat);
        if (!se) continue;
        sv.hole.forEach((c, i) => {
          const [x, y] = SLOT_CARDS[se.slot][i];
          specs.push({ key: 'c' + c.uid, card: c, rect: { x, y, w: 48, h: 70 }, tilt: true, z: 30 + i, cls: sv.folded ? 'folded' : '' });
        });
      }
    }
    st.board.forEach((c, i) => specs.push({ key: 'c' + c.uid, card: c, rect: boardRect(i), tilt: true, z: 40 + i }));
    st.pending.forEach((c, j) => specs.push({ key: 'c' + c.uid, card: c, rect: boardRect(st.board.length + j), tilt: true, z: 40 + st.board.length + j }));
    if (st.peek) specs.push({ key: 'peek' + st.peek.uid, card: st.peek, rect: PEEK, tilt: false, z: 80, cls: 'peek-card' });

    const keep = new Set(specs.map((s) => s.key));
    for (const [k, el] of this.cards) {
      if (!keep.has(k)) {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 400);
        this.cards.delete(k);
        this.shown.delete(k);
      }
    }
    const me = st.seats.find((s) => s.seat === st.you);
    for (const s of specs) {
      const faceUp = s.card.rank !== undefined;
      let el = this.cards.get(s.key);
      const fresh = !el;
      if (!el) {
        el = createCardEl();
        place(el, s.key.startsWith('peek') ? s.rect : DECK);
        el.addEventListener('click', () => this.cardClick(s.key));
        this.layer.append(el);
        this.cards.set(s.key, el);
      }
      const sig = faceUp ? `${s.card.rank}-${s.card.suit}` : 'x';
      if (this.shown.get(s.key) !== sig) {
        if (faceUp) setCardFace(el, { rank: s.card.rank!, suit: s.card.suit! });
        this.shown.set(s.key, sig);
      }
      const transient = ['transmute', 'burning'].filter((c) => el!.classList.contains(c)).map((c) => ' ' + c).join('');
      el.className = 'card' + (faceUp ? '' : ' down') + (s.tilt ? ' on-table' : ' in-hand') + (s.cls ? ' ' + s.cls : '') + this.selClass(s.key, st) + transient;
      el.style.zIndex = String(s.z);
      el.style.setProperty('--rot', `${s.rot ?? 0}deg`);
      if (fresh) {
        el.classList.add('down');
        const e2 = el;
        nextFrame().then(() => {
          place(e2, s.rect);
          if (faceUp) setTimeout(() => e2.classList.remove('down'), 300);
        });
      } else place(el, s.rect);
    }
    // vurgu: benim en iyi elim
    for (const el of this.cards.values()) el.classList.remove('hl');
    if (me && me.inHand && !me.folded && st.sees && me.hole.every((c) => c.rank) && st.board.length && !GAMES[st.game].low) {
      const all = me.hole.concat(st.board).map((c) => ({ rank: c.rank!, suit: c.suit!, uid: c.uid }));
      const info = describe(all, false);
      if (info.category > 0) all.forEach((c, i) => info.best.includes(i) && this.cards.get('c' + c.uid)?.classList.add('hl'));
    }
    this.syncPlates(st);
    this.syncChips(st);
    this.syncInfo(st);
    this.syncControls(st);
  }

  private selClass(key: string, st: TableState) {
    if (this.burnMode && st.board.some((c) => 'c' + c.uid === key)) return ' selectable';
    if (st.swapTurn && !this.sentSwap && this.select) {
      const me = st.seats.find((s) => s.seat === st.you)!;
      const hi = me.hole.findIndex((c) => 'c' + c.uid === key);
      const bi = st.pending.findIndex((c) => 'c' + c.uid === key);
      if (hi >= 0) return ' selectable' + (this.select.hand === hi ? ' selected' : '');
      if (bi >= 0) return ' selectable' + (this.select.board === bi ? ' selected' : '');
    }
    return '';
  }

  private cardClick(key: string) {
    const st = this.state;
    if (!st) return;
    if (this.burnMode) {
      const bi = st.board.findIndex((c) => 'c' + c.uid === key);
      if (bi >= 0) {
        this.burnMode = false;
        this.sendAction({ type: 'burn', index: bi });
      }
      return;
    }
    if (st.swapTurn && this.select && !this.sentSwap) {
      const me = st.seats.find((s) => s.seat === st.you)!;
      const hi = me.hole.findIndex((c) => 'c' + c.uid === key);
      const bi = st.pending.findIndex((c) => 'c' + c.uid === key);
      if (hi >= 0) this.select.hand = this.select.hand === hi ? undefined : hi;
      if (bi >= 0) this.select.board = this.select.board === bi ? undefined : bi;
      sfx.click();
      this.sync();
    }
  }

  private syncPlates(st: TableState) {
    const g = GODS[st.dealerGod];
    this.el.dealerPlate.innerHTML = `<div class="dp-kicker">Krupiye</div><div class="gp-name">${g.name}</div><div class="gp-title">${g.title}</div><div class="orn-line"></div><div class="gt-name">${GAMES[st.game].name}</div><div class="hand-info">${st.handNo + 1}. el · blind ${st.sb}/${st.bb} · artışa ${st.handsToNextLevel} el</div>`;
    const me = st.seats.find((s) => s.seat === st.you);
    if (me) {
      this.el.meStack.innerHTML = `<span class="coin"></span><b>${me.stack}</b><span class="unit">puan</span>`;
      this.el.mePlate.classList.toggle('acting', st.actor === st.you);
      this.el.mePlate.classList.toggle('allin', me.allIn);
      this.el.mePlate.classList.toggle('busted', me.busted);
    }
    const [mx, my] = SLOT_DEALER.me;
    this.el.meDealer.style.left = mx + 'px';
    this.el.meDealer.style.top = my + 'px';
    this.el.meDealer.classList.toggle('on', st.dealerSeat === st.you && st.phase !== 'intro');
    for (const sv of st.seats) {
      const se = this.seatEls.get(sv.seat);
      if (!se) continue;
      se.plate.querySelector('.os-stack')!.innerHTML = sv.busted ? '<i>iflas</i>' : `<span class="coin"></span><b>${sv.stack}</b>`;
      const status = !sv.connected ? 'bağlantı yok' : sv.folded ? 'çekildi' : sv.allIn ? 'hepsi ortada' : '';
      se.plate.querySelector('.os-status')!.textContent = status;
      se.plate.classList.toggle('acting', st.actor === sv.seat);
      se.plate.classList.toggle('folded', sv.folded || sv.busted);
      se.dealer.classList.toggle('on', st.dealerSeat === sv.seat && st.phase !== 'intro');
    }
  }

  private syncChips(st: TableState) {
    const pot = st.phase === 'done' || st.phase === 'between' ? 0 : st.collected;
    this.el.pot.innerHTML = pot > 0 ? `${chipStacks(pot)}<div class="pot-label">${pot}</div>` : '';
    for (const sv of st.seats) {
      const el = sv.seat === st.you ? this.el.meBet : this.seatEls.get(sv.seat)?.bet;
      if (el) el.innerHTML = sv.streetBet > 0 ? `${chipStacks(sv.streetBet, 2)}<span>${sv.streetBet}</span>` : '';
    }
  }

  private syncInfo(st: TableState) {
    const me = st.seats.find((s) => s.seat === st.you);
    let line = '';
    this.el.dHand.innerHTML = '';
    this.el.dEq.innerHTML = '';
    if (!me || !me.inHand) {
      line = me?.busted ? '<i>İzliyorsun</i>' : '';
    } else if (me.folded) line = '<i>Çekildin</i>';
    else if (!st.sees) line = st.game === 'veyla' ? '<i>Elin gizli</i>' : '<i>Kartlar kapalı</i>';
    else if (me.hole.every((c) => c.rank)) {
      const cards = me.hole.concat(st.board).map((c) => ({ rank: c.rank!, suit: c.suit! }));
      const info = describe(cards, !!GAMES[st.game].low);
      line = `<b>${info.name}</b>`;
      this.el.dHand.innerHTML = `<div class="dh-cards">${miniCards(me.hole.map((c) => cardLabel(c as any)).join(' '))}</div><div class="dh-name">${info.name}</div><div class="dh-detail">${info.detail}</div>`;
      if (!GAMES[st.game].low && st.phase === 'betting') {
        for (const d of drawHints(me.hole as any, st.board as any, st.knowledge?.dead ?? [])) {
          this.el.dHand.insertAdjacentHTML('beforeend', `<div class="dh-draw">${d.name} için: ${miniCards(d.cards)} <span>(${d.outs} kart)</span></div>`);
        }
      }
    }
    if (me && me.inHand && !me.folded && st.knowledge && st.phase === 'betting' && st.knowledge.opps.length) {
      const k = st.knowledge;
      const sig = JSON.stringify(k);
      if (sig !== this.eqSig) {
        this.eqSig = sig;
        this.eqVal = equityMulti({ ...k, low: !!GAMES[st.game].low, samples: 900 }).share;
      }
      line += ` <span class="mp-eq" title="Tahmini kazanma şansı">%${Math.round(this.eqVal * 100)}</span>`;
      const n = k.opps.length + 1;
      this.el.dEq.innerHTML = `<div class="eq-row"><span>Tahmini kazanma şansı</span><b>%${Math.round(this.eqVal * 100)}</b></div><div class="eq-sub">${n} kişilik elde adil pay %${Math.round(100 / n)}</div>`;
      if (st.legal && st.legal.toCall > 0) {
        const need = st.legal.toCall / (st.pot + st.legal.toCall);
        this.el.dEq.insertAdjacentHTML('beforeend', `<div class="d-advice">Görmek için <b>${st.legal.toCall}</b> puan, pot <b>${st.pot}</b>. En az <b>%${Math.round(need * 100)}</b> şans gerekir. ${this.eqVal >= need ? '<b class="good">Görmeye değer.</b>' : '<b class="bad">Pahalı.</b>'}</div>`);
      }
    }
    this.el.meHand.innerHTML = line;
  }

  // -------------------------------------------------------------------------
  // Kontroller
  // -------------------------------------------------------------------------
  private clearControls() {
    this.el.actions.innerHTML = '';
    this.el.actions.className = 'actions';
    this.el.ability.innerHTML = '';
    this.el.ability.className = 'ability';
    this.el.prompt.classList.remove('show');
  }

  private ctrlSig = '';
  private syncControls(st: TableState) {
    const sig = JSON.stringify([st.actor, st.legal, st.swapTurn, this.sentSwap, this.select, this.burnMode, st.used, st.deadline]);
    if (sig === this.ctrlSig) return;
    this.ctrlSig = sig;
    if (st.swapTurn && !this.sentSwap) return this.renderSwap(st);
    if (st.actor === st.you && st.legal) {
      sfx.alert();
      this.renderActions(st);
      this.renderAbility(st);
      return;
    }
    if (st.phase !== 'between') this.clearControls();
    if (st.swapTurn === undefined && this.sentSwap && st.phase === 'swap') {
      this.el.prompt.innerHTML = `<div class="pr-title">Kör Takas</div><div class="pr-text">Seçimin verildi. Diğer oyuncular bekleniyor…</div>`;
      this.el.prompt.classList.add('show');
    }
  }

  private sendAction(a: Action) {
    net.send({ t: 'action', action: a });
    this.clearControls();
    this.burnMode = false;
  }

  private renderActions(st: TableState) {
    const L = st.legal!;
    const me = st.seats.find((s) => s.seat === st.you)!;
    const bar = this.el.actions;
    bar.innerHTML = '';
    bar.className = 'actions active';
    const fold = medal('fold', MEDAL.fold, 'Çekil', L.toCall === 0 ? 'gerek yok' : 'eli bırak', 'fold-btn');
    fold.onclick = () => this.sendAction({ type: 'fold' });
    if (L.toCall === 0) fold.setAttribute('disabled', '');
    const call = L.toCall === 0 ? medal('check', MEDAL.check, 'Pas', 'bedava', 'call-btn') : medal('call', MEDAL.call, 'Gör', L.toCall >= me.stack ? `hepsi · ${L.toCall}` : `${L.toCall} puan`, 'call-btn');
    call.onclick = () => this.sendAction(L.toCall === 0 ? { type: 'check' } : { type: 'call' });
    const row = h('div', { class: 'medal-row' }, fold, call);
    if (L.canRaise) {
      const min = L.minRaiseTo;
      const max = L.maxRaiseTo;
      const isBet = L.currentBet === 0;
      const raise = medal('raise', MEDAL.raise, isBet ? 'Bahis' : 'Artır', '', 'raise-btn');
      const amount = h('div', { class: 'rail-amount' });
      const slider = h('input', { type: 'range', min, max, step: 1, value: min, class: 'rail-slider' }) as HTMLInputElement;
      let value = min;
      const setV = (v: number) => {
        value = clampInt(v, min, max);
        slider.value = String(value);
        const all = value >= max;
        amount.innerHTML = `<b>${value}</b><span>${all ? 'hepsi ortada' : isBet ? 'puan bahis' : 'puana çıkar'}</span>`;
        raise.querySelector('.m-label')!.textContent = all ? 'Hepsi' : isBet ? 'Bahis' : 'Artır';
        raise.querySelector('.m-sub')!.textContent = String(value);
        raise.querySelector('.m-coin')!.innerHTML = all ? MEDAL.allin : MEDAL.raise;
        raise.classList.toggle('m-allin', all);
        slider.style.setProperty('--p', (max > min ? ((value - min) / (max - min)) * 100 : 100) + '%');
      };
      slider.oninput = () => setV(+slider.value);
      raise.onclick = () => this.sendAction({ type: 'raise', to: value });
      const pr = h('div', { class: 'rail-presets' });
      ([['en az', min], ['yarım pot', L.currentBet + Math.round((st.pot + L.toCall) / 2)], ['pot', L.currentBet + st.pot + L.toCall], ['hepsi', max]] as [string, number][]).forEach(([n, v], i) => {
        if (i) pr.append(h('span', { class: 'dot' }, '·'));
        const b = h('button', { class: 'rail-preset' }, n);
        b.onclick = () => setV(v);
        pr.append(b);
      });
      bar.append(h('div', { class: 'bet-rail' }, amount, slider, pr));
      row.append(raise);
      setV(min);
    }
    bar.append(row);
  }

  private renderAbility(st: TableState) {
    const L = st.legal!;
    const g = GAMES[st.game];
    const p = this.el.ability;
    p.innerHTML = '';
    p.className = 'ability';
    if (!g.abilityName || st.game === 'kesh' || !st.used) return;
    const usedKey = ({ veyla: 'burn', kronvel: 'refund', oris: 'peek', prisma: 'flip' } as Record<string, keyof NonNullable<TableState['used']>>)[st.game];
    const icon = ({ veyla: ICON.flame, kronvel: ICON.hourglass, oris: ICON.eye, prisma: ICON.prism } as Record<string, string>)[st.game];
    p.classList.add('show');
    const btn = medal('rune', icon, g.abilityName, '');
    const text = h('div', { class: 'ab-text' });
    p.append(btn, text);
    if (st.used[usedKey]) {
      btn.setAttribute('disabled', '');
      btn.querySelector('.m-sub')!.textContent = 'kullanıldı';
      text.append(h('div', { class: 'ab-hint' }, 'Bu elde hakkını kullandın.'));
      p.classList.add('spent');
      return;
    }
    let enabled = true;
    let note = '';
    if (st.game === 'veyla') {
      enabled = L.abilities.burn;
      if (!enabled) note = 'Yere kart açılınca kullanılabilir.';
      btn.onclick = () => {
        this.burnMode = true;
        this.sync();
        text.innerHTML = '';
        text.append(h('div', { class: 'ab-hint glow' }, 'Yakmak istediğin yer kartına dokun.'));
      };
    } else if (st.game === 'kronvel') {
      enabled = !!L.abilities.refund;
      if (enabled) {
        btn.querySelector('.m-sub')!.textContent = `+${L.abilities.refund}`;
        note = `Son bahsin ${st.lastBet?.amount} puandı; yarısı geri gelir.`;
      } else note = st.lastBet ? 'Yeni kart açıldıktan sonra kullanılabilir.' : 'Henüz geri alınacak bir bahsin yok.';
      btn.onclick = () => this.sendAction({ type: 'refund' });
    } else if (st.game === 'oris') {
      enabled = L.abilities.peek;
      btn.onclick = () => this.sendAction({ type: 'peek' });
    } else {
      enabled = L.abilities.flip;
      const me = st.seats.find((s) => s.seat === st.you)!;
      if (enabled && me.hole.every((c) => c.rank)) {
        const txt = me.hole.map((c) => `${RANK_LABELS[c.rank!]}${SUIT_SYMBOLS[FLIP_SUIT[c.suit!]]}`).join(' ');
        note = `Çevrilirse ${miniCards(txt)} olur.`;
      }
      btn.onclick = () => this.sendAction({ type: 'flip' });
    }
    if (!enabled) btn.setAttribute('disabled', '');
    text.append(h('div', { class: 'ab-hint' }, g.abilityHint ?? ''));
    if (note) text.append(h('div', { class: 'ab-note', html: note }));
  }

  private renderSwap(st: TableState) {
    if (!this.select) this.select = {};
    const sel = this.select;
    const bar = this.el.actions;
    bar.innerHTML = '';
    bar.className = 'actions active';
    const ready = sel.hand !== undefined && sel.board !== undefined;
    const ok = medal('raise', MEDAL.swap, 'Takas et', ready ? 'hazır' : 'seç');
    if (!ready) ok.setAttribute('disabled', '');
    ok.onclick = () => {
      this.sentSwap = true;
      net.send({ t: 'swap', choice: { hand: sel.hand!, board: sel.board! } });
      this.clearControls();
      this.sync();
    };
    const no = medal('fold', MEDAL.no, 'Dokunma', 'kartlar kalsın');
    no.onclick = () => {
      this.sentSwap = true;
      net.send({ t: 'swap', choice: null });
      this.clearControls();
      this.sync();
    };
    bar.append(h('div', { class: 'swap-text' }, ready ? 'Seçimin hazır. İçgüdüne güveniyor musun?' : 'Elinden bir kart, yerden bir kart seç.'), h('div', { class: 'medal-row' }, no, ok));
    this.el.prompt.innerHTML = `<div class="pr-title">Kör Takas</div><div class="pr-text">Hiçbir kart görünmüyor. Masadaki herkes gizlice seçiyor.</div>`;
    this.el.prompt.classList.add('show');
    this.sync();
  }

  /** Sıra sayacı */
  private tick() {
    const st = this.state;
    if (!st) return;
    const left = st.deadline ? Math.max(0, st.deadline - Date.now()) : 0;
    const mine = (st.actor === st.you && !!st.legal) || (!!st.swapTurn && !this.sentSwap);
    this.el.timerBar?.classList.toggle('show', mine && left > 0);
    if (mine && st.deadline) {
      const total = st.swapTurn ? 25000 : 30000;
      (this.el.timerBar.firstElementChild as HTMLElement).style.width = `${(left / total) * 100}%`;
      this.el.timerBar.classList.toggle('low', left < 8000);
    }
    for (const [seat, se] of this.seatEls) {
      const ring = se.plate.querySelector('.os-ring') as HTMLElement;
      if (st.actor === seat && st.deadline) ring.style.setProperty('--p', `${Math.min(100, (left / 30000) * 100)}%`);
      else ring.style.setProperty('--p', '0%');
    }
  }

  // -------------------------------------------------------------------------
  // Efektler
  // -------------------------------------------------------------------------
  private clearTable() {
    for (const [, el] of this.cards) {
      el.classList.add('down', 'leaving');
      place(el, DECK);
      setTimeout(() => el.remove(), 450);
    }
    this.cards.clear();
    this.shown.clear();
    this.el.meHL.classList.remove('show');
    for (const se of this.seatEls.values()) se.hl.classList.remove('show');
  }

  private float(seat: number, text: string, kind: string) {
    const el = seat === this.state?.you ? this.el.meAct : this.seatEls.get(seat)?.act;
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show', 'k-fold', 'k-raise', 'k-bet', 'k-allin', 'k-refund', 'k-call', 'k-check');
    void el.offsetWidth;
    el.classList.add('show', 'k-' + kind);
  }

  private flash(text: string) {
    const f = h('div', { class: 'street-flash' }, text);
    this.root.append(f);
    setTimeout(() => f.remove(), 1600);
  }

  private banner(text: string, kind: 'good' | 'bad' | 'info') {
    const b = h('div', { class: `banner ${kind}` }, h('span', {}, text));
    this.el.overlay.append(b);
    setTimeout(() => b.classList.add('out'), 1900);
    setTimeout(() => b.remove(), 2400);
  }

  private fly(from: [number, number], to: [number, number], amount: number) {
    const n = Math.min(10, Math.max(3, Math.ceil(amount / 3)));
    for (let i = 0; i < n; i++) {
      const c = h('div', { class: 'fly-chip' });
      c.style.left = from[0] + (Math.random() * 30 - 15) + 'px';
      c.style.top = from[1] + (Math.random() * 20 - 10) + 'px';
      this.root.append(c);
      setTimeout(() => {
        c.style.left = to[0] + (Math.random() * 20 - 10) + 'px';
        c.style.top = to[1] + (Math.random() * 20 - 10) + 'px';
        c.style.opacity = '0.1';
      }, 30 + i * 45);
      setTimeout(() => c.remove(), 950 + i * 45);
    }
  }

  private async collect() {
    const els = [this.el.meBet, ...[...this.seatEls.values()].map((s) => s.bet)].filter((e) => e.innerHTML);
    for (const el of els) {
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.classList.add('ghost-bet');
      this.root.append(ghost);
      el.innerHTML = '';
      await nextFrame();
      ghost.style.left = '610px';
      ghost.style.top = '420px';
      ghost.style.opacity = '0';
      setTimeout(() => ghost.remove(), 500);
    }
  }

  private async dice(rolls: (number | null)[], tie: boolean, st: TableState) {
    this.clearDice();
    const wrap = h('div', { class: 'dice-wrap multi' });
    const dice: [HTMLElement, number][] = [];
    rolls.forEach((r, seat) => {
      if (r === null) return;
      const d = h('div', { class: 'die rolling' });
      wrap.append(h('div', { class: 'die-box' }, d, h('div', { class: 'die-label' }, this.name(st, seat))));
      dice.push([d, r]);
    });
    this.el.overlay.append(wrap);
    sfx.dice();
    for (let i = 0; i < (this.fast ? 0 : 9); i++) {
      dice.forEach(([d]) => (d.innerHTML = pips(1 + Math.floor(Math.random() * 6))));
      await sleep(70);
    }
    const max = Math.max(...dice.map(([, r]) => r));
    dice.forEach(([d, r]) => {
      d.classList.remove('rolling');
      d.innerHTML = pips(r);
      if (!tie && r === max) d.classList.add('win');
    });
    this.log('Zar: ' + rolls.map((r, s) => (r === null ? '' : `${this.name(st, s)} ${r}`)).filter(Boolean).join(', '));
    if (tie) wrap.append(h('div', { class: 'dice-msg' }, 'Eşitlik · tekrar'));
  }

  private clearDice() {
    this.el.overlay?.querySelectorAll('.dice-wrap').forEach((d) => d.remove());
  }

  private log(text: string, cls = '') {
    if (!this.el.dLog) return;
    this.el.dLog.prepend(h('div', { class: 'log-row ' + cls, html: miniCards(escapeHtml(text)) }));
    while (this.el.dLog.children.length > 60) this.el.dLog.lastElementChild?.remove();
  }

  private showRules() {
    const st = this.state;
    if (!st) return;
    const gd = GAMES[st.game];
    modal(h('div', { class: 'rules' }, h('div', { class: 'modal-kicker' }, 'Masanın kuralları'), h('h2', {}, gd.name), h('p', { class: 'rules-short' }, gd.pitch), h('ol', {}, ...gd.rules.map((r) => h('li', {}, r)))), { closable: true, className: 'rules-modal' });
  }

  private confirmLeave() {
    const m = modal(
      h('div', { class: 'confirm' }, h('h3', {}, 'Masadan kalk?'), h('p', { class: 'muted' }, 'Oyun sürerken kalkarsan elin otomatik oynanır ve koltuğun maç sonunda boşalır.'),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Vazgeç'), h('button', { class: 'btn danger', onclick: () => { m.close(); net.send({ t: 'leave' }); } }, 'Kalk'))),
      { closable: true },
    );
  }

  matchEnd(standings: Standing[]) {
    this.queue = this.queue.then(() => {
      this.ended = true;
      this.clearControls();
      const meSt = standings.find((s) => s.seat === this.state?.you);
      const won = meSt?.place === 1;
      if (won) sfx.bigWin();
      else sfx.lose();
      const content = h('div', { class: 'match-end ' + (won ? 'won' : 'lost') },
        h('div', { class: 'modal-kicker' }, 'Maç bitti'),
        h('h2', {}, won ? 'Zafer' : `${standings[0].name} kazandı`),
        h('div', { class: 'orn-line wide' }),
        ...standings.map((s) => h('div', { class: 'end-row' + (s.seat === this.state?.you ? ' me' : '') }, h('span', { class: 'er-place' }, `${s.place}.`), h('span', { class: 'er-name' }, s.name), h('span', { class: 'er-stack' }, `${s.stack} puan`))),
      );
      const btn = h('button', { class: 'btn primary' }, 'Lobiye dön');
      content.append(btn);
      const m = modal(content, { className: 'end-modal' });
      btn.onclick = () => {
        m.close();
        this.destroy();
        table = null;
        showLobby();
      };
    });
  }
}
