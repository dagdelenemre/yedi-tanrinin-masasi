import { AIController, SpeechKind } from '../engine/ai';
import { Card, RANK_LABELS, SUIT_SYMBOLS, cardLabel } from '../engine/cards';
import { HIGH_GUIDE, LOW_GUIDE, describe, drawHints } from '../engine/evaluator';
import { equity } from '../engine/equity';
import { GAMES, GameId, GODS, GodDef, GodId, pick } from '../engine/gods';
import { Action, Controller, FLIP_SUIT, HandEngine, HandEvent, HandOutcome, STREET_NAMES, SwapChoice } from '../engine/hand';
import { Match, Participant } from '../engine/match';
import { portrait, sevenStar } from './art';
import { isMuted, setMuted, sfx, startAmbient, stopAmbient } from './audio';
import { createCardEl, miniCards, setCardFace } from './cardview';
import { h, modal, nextFrame, sleep, store, save } from './dom';
import { Mood, godFigure } from './figures';
import { ICON, MEDAL } from './icons';
import { PACE_LABEL, T, getPace, nextPace, paceFactor } from './settings';
import { keepAwake } from './mobile';
import { GOD_PARTICLES, Particles, godScene } from './scenes';

// ---------------------------------------------------------------------------
// Yerleşim (sahne 1280x720) — birinci şahıs: tanrı karşıda, masa önümüzde
// ---------------------------------------------------------------------------
interface Rect { x: number; y: number; w: number; h: number }
const DECK: Rect = { x: 426, y: 404, w: 50, h: 72 };
const PEEK: Rect = { x: 330, y: 480, w: 62, h: 88 };
const boardRect = (i: number): Rect => ({ x: 422 + i * 90, y: 476, w: 76, h: 106 });
const godRect = (i: number): Rect => ({ x: 588 + i * 54, y: 398, w: 50, h: 72 });
const meRect = (i: number): Rect => ({ x: 500 + i * 158, y: 618, w: 120, h: 168 });

const HUMAN = 0;
const GOD = 1;

const GOD_TONE: Record<GodId, number> = { nadir: 55, kesh: 61.7, veyla: 73.4, kronvel: 49, oris: 65.4, barbaz: 43.7, prisma: 82.4 };

export class AbortMatch extends Error {}

interface CardSpec {
  key: string;
  card: Card | null;
  rect: Rect;
  faceUp: boolean;
  cls?: string;
  z: number;
  tilt?: boolean;
  rot?: number;
}

export interface TableOptions {
  stage: HTMLElement;
  godId: GodId;
  game: GameId;
  player: Participant;
  god: Participant;
  mode: 'tutorial' | 'tournament';
  roundLabel: string;
  jokerAvailable: boolean;
  onJokerUsed?: (game: GameId) => void;
}

export interface MatchResult {
  winner: 'player' | 'god';
  stacks: [number, number];
  hands: number;
}

export class TableView {
  root: HTMLElement;
  god: GodDef;
  engine: HandEngine | null = null;
  match!: Match;
  aborted = false;
  private cards = new Map<string, HTMLElement>();
  private cardShown = new Map<string, string>();
  private layer: HTMLElement;
  private el: Record<string, HTMLElement> = {};
  private pending: { reject: (e: any) => void } | null = null;
  private eqSig = '';
  private eqVal: { win: number; tie: number; share: number } | null = null;
  private selectMode: null | { kind: 'burn' | 'swap'; hand?: number; board?: number; resolve: (v: any) => void } = null;
  private lastHandResult = '';
  private jokerAvailable: boolean;
  private keyHandler: (e: KeyboardEvent) => void;
  private particles: Particles;
  private moodTimer = 0;
  private drawerOpen: boolean;
  private lastBB = 0;
  private continueFn: (() => void) | null = null;
  private introducedGame: GameId | null = null;

  constructor(private opts: TableOptions) {
    this.god = GODS[opts.godId];
    this.jokerAvailable = opts.jokerAvailable;
    this.drawerOpen = store('ytm-drawer', false);
    this.root = h('div', { class: `screen table-screen god-${opts.godId}` + (this.drawerOpen ? ' drawer-open' : '') });
    this.root.style.setProperty('--god', this.god.color);
    this.root.style.setProperty('--god-accent', this.god.accent);
    this.layer = h('div', { class: 'cards-layer' });
    this.particles = new Particles(GOD_PARTICLES[opts.godId], opts.godId === 'oris' ? 90 : 70);
    this.build();
    opts.stage.append(this.root);
    this.keyHandler = (e) => this.onKey(e);
    window.addEventListener('keydown', this.keyHandler);
    startAmbient(GOD_TONE[opts.godId]);
    keepAwake(true);
  }

  destroy() {
    window.removeEventListener('keydown', this.keyHandler);
    keepAwake(false);
    this.particles.destroy();
    stopAmbient();
    clearTimeout(this.moodTimer);
    this.root.remove();
  }

  // ---------------------------------------------------------------------------
  private build() {
    const g = this.god;
    const r = this.root;
    const fig = godFigure(g.id);

    r.append(h('div', { class: 'scene', html: godScene(g.id) }));
    r.append(h('div', { class: 'god-aura' }));
    this.el.godStage = h('div', { class: 'god-stage', 'data-mood': 'neutral' });
    this.el.godStage.append(h('div', { class: 'god-body', html: fig.body }));
    r.append(this.el.godStage);
    r.append(this.particles.canvas);
    r.append(h('div', { class: 'table-surface', html: tableSVG() }));
    this.el.godHands = h('div', { class: 'god-hands', 'data-mood': 'neutral', html: fig.hands });
    r.append(this.el.godHands);

    // masa üstü nesneler
    this.el.deck = h('div', { class: 'deck', style: { left: DECK.x + 'px', top: DECK.y + 'px' } });
    for (let i = 0; i < 5; i++) {
      const c = createCardEl();
      c.classList.add('on-table');
      c.style.cssText = `left:${-i * 1.2}px;top:${-i * 1.6}px;width:${DECK.w}px;height:${DECK.h}px`;
      this.el.deck.append(c);
    }
    r.append(this.el.deck);
    this.el.pot = h('div', { class: 'pot' });
    this.el.godBet = h('div', { class: 'bet god-bet' });
    this.el.meBet = h('div', { class: 'bet me-bet' });
    this.el.godDealer = h('div', { class: 'dealer-chip god-dealer' }, 'D');
    this.el.meDealer = h('div', { class: 'dealer-chip me-dealer' }, 'D');
    r.append(this.el.pot, this.el.godBet, this.el.meBet, this.el.godDealer, this.el.meDealer);

    r.append(this.layer);
    r.append(h('div', { class: 'vignette' }));

    // tanrının levhası (sol üst)
    this.el.godStack = h('div', { class: 'gp-stack' });
    this.el.godPlate = h(
      'div',
      { class: 'god-plate' },
      h('div', { class: 'gp-name' }, g.name),
      h('div', { class: 'gp-title' }, g.title),
      h('div', { class: 'orn-line' }),
      this.el.godStack,
    );
    r.append(this.el.godPlate);

    // konuşma (altyazı)
    this.el.speech = h('div', { class: 'speech' });
    r.append(this.el.speech);

    // üst sağ kontroller
    const btn = (icon: string, label: string, fn: () => void, cls = '') => {
      const b = h('button', { class: 'hud-link ' + cls, title: label, html: `${icon}<span>${label}</span>` });
      b.onclick = fn;
      return b;
    };
    const paceBtn = btn(ICON.hourglass, `Tempo · ${PACE_LABEL[getPace()]}`, () => {
      const p = nextPace();
      paceBtn.innerHTML = `${ICON.hourglass}<span>Tempo · ${PACE_LABEL[p]}</span>`;
    });
    this.el.joker = btn(ICON.joker, 'Joker', () => this.openJoker(), 'joker-btn');
    const mute = btn(isMuted() ? ICON.soundOff : ICON.soundOn, 'Ses', () => {
      setMuted(!isMuted());
      mute.innerHTML = `${isMuted() ? ICON.soundOff : ICON.soundOn}<span>Ses</span>`;
    });
    this.el.guideBtn = btn(ICON.book, 'Notlar', () => this.toggleDrawer(), this.drawerOpen ? 'on' : '');
    r.append(
      h(
        'div',
        { class: 'hud-top' },
        this.el.guideBtn,
        btn(ICON.scroll, 'Kurallar', () => this.showGameIntro(this.game, 'rules')),
        this.el.joker,
        paceBtn,
        mute,
        btn(ICON.close, 'Masadan kalk', () => this.confirmQuit()),
      ),
    );
    this.el.gameTag = h('div', { class: 'game-tag' });
    this.el.handInfo = h('div', { class: 'hand-info' });
    r.append(h('div', { class: 'top-center' }, this.el.gameTag, this.el.handInfo));

    // oyuncu levhası (sol alt)
    this.el.meStack = h('div', { class: 'mp-stack' });
    this.el.meHand = h('div', { class: 'mp-hand' });
    this.el.mePlate = h(
      'div',
      { class: 'me-plate' },
      h('div', { class: 'mp-label' }, 'Sen · Joker'),
      this.el.meStack,
      h('div', { class: 'orn-line' }),
      this.el.meHand,
    );
    r.append(this.el.mePlate);

    this.el.ability = h('div', { class: 'ability' });
    this.el.actions = h('div', { class: 'actions' });
    this.el.prompt = h('div', { class: 'prompt' });
    r.append(this.el.ability, this.el.actions, this.el.prompt);

    this.el.godAct = h('div', { class: 'act-float god-act' });
    this.el.meAct = h('div', { class: 'act-float me-act' });
    this.el.godHL = h('div', { class: 'hand-label god-hl' });
    this.el.meHL = h('div', { class: 'hand-label me-hl' });
    r.append(this.el.godAct, this.el.meAct, this.el.godHL, this.el.meHL);

    // kılavuz çekmecesi
    this.el.drawer = h('div', { class: 'drawer' + (this.drawerOpen ? ' open' : '') });
    this.el.dGame = h('div', { class: 'd-game' });
    this.el.dHand = h('div', { class: 'd-hand' });
    this.el.dEq = h('div', { class: 'd-eq' });
    this.el.dAdvice = h('div', { class: 'd-advice' });
    this.el.dGuide = h('div', { class: 'd-guide' });
    this.el.dLog = h('div', { class: 'd-log' });
    const closeD = h('button', { class: 'd-close', html: ICON.close, title: 'Kapat' });
    closeD.onclick = () => this.toggleDrawer(false);
    this.el.drawer.append(
      closeD,
      this.el.dGame,
      h('div', { class: 'd-sec' }, h('div', { class: 'd-label' }, 'Elin'), this.el.dHand, this.el.dEq, this.el.dAdvice),
      h('div', { class: 'd-sec grow' }, h('div', { class: 'd-label' }, 'El Sıralaması'), this.el.dGuide),
      h('div', { class: 'd-sec log' }, h('div', { class: 'd-label' }, 'Masa Kaydı'), this.el.dLog),
    );
    r.append(this.el.drawer);

    this.el.overlay = h('div', { class: 'overlay-layer' });
    r.append(this.el.overlay);
    this.renderGameInfo();
    this.renderGuide();
    this.updateJoker();
    this.syncStacks();
  }

  private get game(): GameId {
    if (this.engine && this.engine.phase !== 'done') return this.engine.game;
    return this.match?.game ?? this.opts.game;
  }

  private renderGameInfo() {
    const gd = GAMES[this.game];
    const owner = this.game === 'klasik' ? 'Temel oyun' : `${GODS[this.game as GodId].name}'in oyunu`;
    this.el.gameTag.innerHTML = `<span class="gt-name">${gd.name}</span><span class="gt-owner">${owner}</span>`;
    this.el.dGame.innerHTML = '';
    this.el.dGame.append(h('div', { class: 'dg-name' }, gd.name), h('div', { class: 'dg-short' }, gd.short));
  }

  private renderGuide(activeCat = -1) {
    const low = !!GAMES[this.game].low;
    const list = low ? LOW_GUIDE : HIGH_GUIDE;
    this.el.dGuide.innerHTML = '';
    list.forEach((row, i) => {
      const cat = low ? -1 : 9 - i;
      this.el.dGuide.append(
        h('div', { class: 'gr' + (!low && cat === activeCat ? ' active' : '') }, h('span', { class: 'gr-name' }, row.name), h('span', { class: 'gr-ex', html: miniCards(row.example) })),
      );
    });
  }

  private updateJoker() {
    const show = this.opts.mode === 'tournament';
    this.el.joker.style.display = show ? '' : 'none';
    this.el.joker.classList.toggle('used', !this.jokerAvailable);
    this.el.joker.toggleAttribute('disabled', !this.jokerAvailable);
  }

  private toggleDrawer(open = !this.drawerOpen) {
    this.drawerOpen = open;
    save('ytm-drawer', open);
    this.el.drawer.classList.toggle('open', open);
    this.root.classList.toggle('drawer-open', open);
    this.el.guideBtn.classList.toggle('on', open);
    sfx.flip();
  }

  // ---------------------------------------------------------------------------
  // Maç akışı
  // ---------------------------------------------------------------------------
  async run(): Promise<MatchResult> {
    const human = new HumanController(this);
    const ai = new AIController(this.god, { think: true, pace: paceFactor, samples: 450, say: (k) => this.godSays(k) });
    this.match = new Match([this.opts.player, this.opts.god], this.opts.game, [human, ai], {
      emit: (e, eng) => this.onEvent(e, eng),
      beforeHand: (m) => this.beforeHand(m),
      afterHand: (m, o, eng) => this.afterHand(m, o, eng),
    });
    this.syncStacks();
    await this.showGameIntro(this.opts.game, 'start');
    const w = await this.match.play();
    const result: MatchResult = {
      winner: w === HUMAN ? 'player' : 'god',
      stacks: [this.match.players[0].stack, this.match.players[1].stack],
      hands: this.match.handNo,
    };
    await this.showMatchEnd(result);
    return result;
  }

  /** Tanrı oyununu anlatır; oyuncu kapatana kadar bekler */
  private showGameIntro(game: GameId, mode: 'start' | 'switch' | 'rules' = 'start'): Promise<void> {
    if (mode !== 'rules') this.introducedGame = game;
    const gd = GAMES[game];
    const owner = game === 'klasik' ? null : GODS[game as GodId];
    const m = this.match;
    const kicker = mode === 'switch' ? 'Joker oyunu değiştirdi' : mode === 'rules' ? 'Masanın kuralları' : `${this.opts.roundLabel} · ${this.god.name}'in masası`;
    const prevContinue = this.continueFn;
    return new Promise<void>((resolve) => {
      const seal = h('button', { class: 'wax-seal', html: `<span>${mode === 'rules' ? 'Kapat' : 'Masaya<br>otur'}</span>` });
      const stacks = m ? `Sen ${m.players[0].stack} · ${this.god.name} ${m.players[1].stack} puan · blind ${m.sb}/${m.bb}` : '';
      const scroll = h(
        'div',
        { class: 'intro-scroll' },
        h('div', { class: 'is-kicker' }, kicker),
        h('div', { class: 'is-title' }, gd.name),
        h('div', { class: 'is-owner' }, owner ? `${owner.name} anlatıyor` : 'Temel oyun'),
        h('p', { class: 'is-pitch' }, gd.pitch),
        h('div', { class: 'is-rule-head' }, 'Masanın kuralları'),
        h('ol', { class: 'is-rules' }, ...gd.rules.map((r) => h('li', {}, r))),
        h('div', { class: 'is-tip' }, h('span', { class: 'is-tip-head' }, 'Hizmetçinin notu · '), gd.tip),
        h('div', { class: 'is-foot' }, h('span', { class: 'is-stacks' }, stacks), seal),
      );
      const wrap = h('div', { class: 'intro-wrap' }, scroll);
      this.root.append(wrap);
      if (mode !== 'rules') {
        this.setMood('smug', 4000);
        if (mode === 'start') this.say(pick(this.god.lines.intro), 5000);
        else this.say(pick(['Kuralları sen mi koyuyorsun?', 'Peki. Görelim bakalım.', 'Cüretkâr bir hizmetçi...']), 4000);
      }
      sfx.flip();
      const close = () => {
        this.continueFn = prevContinue;
        sfx.click();
        wrap.classList.add('out');
        setTimeout(() => wrap.remove(), 500);
        resolve();
      };
      seal.onclick = close;
      this.continueFn = close;
    });
  }

  private async beforeHand(m: Match) {
    if (m.handNo > 0) await this.waitContinue();
    this.renderGameInfo();
    this.renderGuide();
    if (this.lastBB && this.lastBB !== m.bb) await this.banner(`Blindlar yükseldi · ${m.sb} / ${m.bb}`, 'info', T(2000));
    this.lastBB = m.bb;
    this.updateHandInfo();
  }

  private updateHandInfo() {
    const m = this.match;
    if (!m) return;
    this.el.handInfo.textContent = `${m.handNo + 1}. el · blind ${m.sb}/${m.bb} · artışa ${m.handsToNextLevel} el`;
  }

  private async afterHand(_m: Match, _o: HandOutcome, _e: HandEngine) {
    this.syncStacks();
  }

  private waitContinue(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.pending = { reject };
      this.clearControls();
      const go = () => {
        this.pending = null;
        this.continueFn = null;
        this.clearControls();
        resolve();
      };
      this.continueFn = go;
      const b = medal('next', MEDAL.next, 'Sonraki el', 'boşluk');
      b.onclick = go;
      this.el.actions.className = 'actions active single';
      this.el.actions.append(h('div', { class: 'cont-result' }, this.lastHandResult), h('div', { class: 'medal-row' }, b));
    });
  }

  private clearControls() {
    this.el.actions.innerHTML = '';
    this.el.actions.className = 'actions';
    this.el.ability.innerHTML = '';
    this.el.ability.className = 'ability';
    this.el.prompt.innerHTML = '';
    this.el.prompt.classList.remove('show');
  }

  private onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') {
      if (e.key === 'Enter') (this.el.actions.querySelector('.raise-btn') as HTMLButtonElement)?.click();
      return;
    }
    if (document.querySelector('.modal-backdrop')) return;
    if ((e.key === ' ' || e.key === 'Enter') && this.continueFn) {
      e.preventDefault();
      this.continueFn();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'k') return this.toggleDrawer();
    const map: Record<string, string> = { f: '.fold-btn', c: '.call-btn', r: '.raise-btn' };
    if (map[k]) (this.el.actions.querySelector(map[k]) as HTMLButtonElement)?.click();
  }

  // ---------------------------------------------------------------------------
  // Motor olayları
  // ---------------------------------------------------------------------------
  async onEvent(e: HandEvent, eng: HandEngine) {
    if (this.aborted) throw new AbortMatch();
    this.engine = eng;
    const godName = this.god.name;
    switch (e.type) {
      case 'start': {
        if (eng.game !== this.introducedGame) {
          this.engine = null;
          this.renderGameInfo();
          await this.showGameIntro(eng.game, 'switch');
          this.engine = eng;
        }
        this.clearTable();
        this.renderGameInfo();
        this.renderGuide();
        this.updateHandInfo();
        this.eqSig = '';
        this.el.meDealer.classList.toggle('on', eng.dealer === HUMAN);
        this.el.godDealer.classList.toggle('on', eng.dealer === GOD);
        this.log(`— ${this.match.handNo + 1}. el —`, 'sep');
        this.sync();
        await sleep(T(500));
        break;
      }
      case 'dice':
        await this.animateDice(e.rolls, e.tie, e.context);
        break;
      case 'steal': {
        const who = e.to === HUMAN ? 'Sen' : godName;
        if (e.amount > 0) {
          sfx.steal();
          this.flyChips(e.from === HUMAN ? 'me' : 'god', e.to === HUMAN ? 'me' : 'god', e.amount);
          this.log(`${who} zarda kazandı, ${e.amount} puan çaldı.`, e.to === HUMAN ? 'good' : 'bad');
          this.setMood(e.to === GOD ? 'smug' : 'angry');
          await this.banner(`${who} ${e.amount} puan çaldı`, e.to === HUMAN ? 'good' : 'bad', T(1900));
        } else {
          this.log(`${who} zarda kazandı ama çalınacak puan yok.`);
        }
        this.clearDice();
        this.sync();
        break;
      }
      case 'blind':
        sfx.chip();
        this.sync();
        await sleep(T(280));
        break;
      case 'deal':
        this.log(`Blindlar ${eng.sb}/${eng.bb}. Kartlar dağıtıldı.`);
        await this.dealAnimation();
        break;
      case 'swapStart':
        this.flash('Kör Takas');
        this.log('Kör takas: iki taraf da gizlice seçiyor.');
        await sleep(T(700));
        break;
      case 'swapNone':
        this.log('Kimse takas yapmadı.');
        await this.banner('Takas yapılmadı', 'info', T(1300));
        break;
      case 'swapConflict': {
        this.sync();
        const [k0, k1] = e.kept;
        const c0 = eng.seats[HUMAN].hole[k0];
        const c1 = eng.seats[GOD].hole[k1];
        if (!e.byDice) {
          sfx.alert();
          this.log(`Aynı kart seçildi! Tutulan kartlar açıldı: Sen ${cardLabel(c0)}, ${godName} ${cardLabel(c1)}`, 'bad');
          await this.banner('Aynı kart seçildi', 'info', T(1600));
          if (e.winner === -1) {
            await this.banner('Değerler eşit · zar atılıyor', 'info', T(1600));
            break;
          }
        }
        this.clearDice();
        const msg = e.winner === HUMAN ? 'Yer kartı senin' : `Yer kartı ${godName}'in`;
        this.log(msg, e.winner === HUMAN ? 'good' : '');
        this.setMood(e.winner === GOD ? 'smug' : 'angry');
        await this.banner(msg, e.winner === HUMAN ? 'good' : 'bad', T(1800));
        break;
      }
      case 'swap': {
        sfx.card();
        const me = e.seat === HUMAN;
        this.log(`${me ? 'Sen' : godName} kör takas yaptı (yerdeki ${e.board + 1}. kart).`, me ? 'good' : 'god');
        this.sync();
        await sleep(T(1100));
        break;
      }
      case 'swapDraw': {
        const me = e.seat === HUMAN;
        const el = this.cards.get('c' + e.old.uid);
        if (el) {
          place(el, DECK);
          el.classList.add('leaving');
          setTimeout(() => el.remove(), 600);
          this.cards.delete('c' + e.old.uid);
          this.cardShown.delete('c' + e.old.uid);
        }
        this.log(`${me ? 'Sen' : godName} destenin üstünden kart aldı.`);
        await sleep(T(500));
        this.sync();
        sfx.card();
        await sleep(T(850));
        break;
      }
      case 'cardsReady':
        this.clearControls();
        this.sync();
        if (eng.game === 'kesh') sfx.flip();
        await sleep(T(eng.game === 'kesh' ? 900 : 250));
        break;
      case 'reveal': {
        await sleep(T(650));
        const c = eng.board[eng.board.length - 1];
        this.log(`${STREET_NAMES[e.street]}: ${cardLabel(c)}`);
        this.flash(STREET_NAMES[e.street]);
        sfx.flip();
        this.sync();
        await sleep(T(1150));
        break;
      }
      case 'act': {
        const me = e.seat === HUMAN;
        const txt = actText(e.kind, e.amount, e.to);
        this.floatAction(me ? 'me' : 'god', txt, e.kind);
        this.log(`${me ? 'Sen' : godName}: ${txt}`, me ? '' : 'god');
        if (e.amount > 0) (e.kind === 'allin' ? sfx.chips() : sfx.chip());
        else if (e.kind === 'fold') sfx.card();
        else sfx.click();
        if (!me) {
          if (e.kind === 'raise' || e.kind === 'bet' || e.kind === 'allin') this.setMood('smug');
          else if (e.kind === 'fold') this.setMood('angry');
          else this.setMood('neutral');
        }
        this.sync();
        await sleep(T(me ? 500 : 1000));
        break;
      }
      case 'uncalled':
        this.log(`${e.seat === HUMAN ? 'Sana' : godName + "'e"} karşılıksız ${e.amount} puan iade edildi.`);
        this.sync();
        break;
      case 'collect':
        await this.collectBets();
        this.sync();
        break;
      case 'burn': {
        const me = e.seat === HUMAN;
        sfx.burn();
        const el = this.cards.get('c' + e.old.uid);
        if (el) {
          el.classList.add('burning');
          await sleep(780);
          el.remove();
          this.cards.delete('c' + e.old.uid);
          this.cardShown.delete('c' + e.old.uid);
        }
        this.log(`${me ? 'Sen' : godName} ${cardLabel(e.old)} kartını yaktı.`, me ? 'good' : 'god');
        if (!me) {
          this.say(pick(this.god.lines.ability));
          this.setMood('smug');
        }
        this.sync();
        sfx.flip();
        await sleep(T(900));
        break;
      }
      case 'refund': {
        const me = e.seat === HUMAN;
        sfx.magic();
        this.flyChips('pot', me ? 'me' : 'god', e.amount);
        this.floatAction(me ? 'me' : 'god', `Geri aldı +${e.amount}`, 'refund');
        this.log(`${me ? 'Sen' : godName} son bahsinin yarısını geri aldı (+${e.amount}).`, me ? 'good' : 'god');
        this.sync();
        await sleep(T(1100));
        break;
      }
      case 'peek':
        if (e.seat === HUMAN) {
          sfx.magic();
          this.log(`Kehanet: sıradaki kart ${cardLabel(e.card)}`, 'good');
          this.sync();
          await sleep(T(1300));
        }
        break;
      case 'flip':
        if (e.seat === HUMAN) {
          sfx.magic();
          for (const c of eng.seats[HUMAN].hole) {
            const el = this.cards.get('c' + c.uid);
            el?.classList.add('transmute');
            setTimeout(() => el?.classList.remove('transmute'), 1000);
          }
          this.log(`Simya: kartlarının rengi çevrildi (${eng.seats[HUMAN].hole.map(cardLabel).join(' ')}).`, 'good');
          await sleep(T(450));
          this.sync();
          await sleep(T(900));
        }
        break;
      case 'showdown': {
        this.sync();
        sfx.flip();
        const [i0, i1] = e.infos;
        if (i0) this.showHandLabel('me', `${i0.name}${i0.detail ? ' · ' + i0.detail : ''}`);
        if (i1) this.showHandLabel('god', `${i1.name}${i1.detail ? ' · ' + i1.detail : ''}`);
        this.log(`Açılış: Sen ${i0?.name}, ${godName} ${i1?.name}`);
        this.setMood('think');
        await sleep(T(2800));
        break;
      }
      case 'win': {
        const humanWon = e.seats.includes(HUMAN);
        const godWon = e.seats.includes(GOD);
        const amt = e.amounts.reduce((a, b) => a + b, 0);
        this.sync();
        if (humanWon && godWon) {
          this.lastHandResult = `Pot bölündü (${e.amounts.join(' / ')})`;
          this.flyChips('pot', 'me', e.amounts[0]);
          this.flyChips('pot', 'god', e.amounts[1]);
          await this.banner('Pot bölündü', 'info', T(2000));
        } else if (humanWon) {
          this.lastHandResult = `Eli kazandın · pot ${amt}`;
          sfx.win();
          this.flyChips('pot', 'me', amt);
          this.setMood('angry', 3000);
          if (Math.random() < 0.5) this.say(pick(this.god.lines.lose));
          await this.banner(e.reason === 'fold' ? `${this.god.name} çekildi · +${amt}` : `Eli kazandın · +${amt}`, 'good', T(2300));
        } else {
          this.lastHandResult = `${this.god.name} eli aldı · pot ${amt}`;
          sfx.lose();
          this.flyChips('pot', 'god', amt);
          this.setMood('smug', 3000);
          if (Math.random() < 0.6) this.say(pick(this.god.lines.win));
          await this.banner(`${this.god.name} potu aldı · ${amt}`, 'bad', T(2300));
        }
        this.log(this.lastHandResult, humanWon && !godWon ? 'good' : godWon && !humanWon ? 'bad' : '');
        break;
      }
      case 'end':
        this.sync();
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Kart senkronizasyonu
  // ---------------------------------------------------------------------------
  private desiredCards(): CardSpec[] {
    const e = this.engine;
    if (!e) return [];
    const out: CardSpec[] = [];
    const showdown = e.phase === 'showdown' || (e.phase === 'done' && !e.seats[0].folded && !e.seats[1].folded && e.board.length === 5);
    const veyla = e.game === 'veyla';
    const me = e.seats[HUMAN];
    const gd = e.seats[GOD];
    me.hole.forEach((c, i) => {
      const faceUp = e.seesOwnCards(HUMAN) || me.revealed[i] || showdown;
      out.push({ key: 'c' + c.uid, card: c, rect: meRect(i), faceUp, z: 70 + i, rot: i ? 7 : -7, cls: me.folded ? 'folded' : '' });
    });
    gd.hole.forEach((c, i) => {
      const faceUp = veyla || gd.revealed[i] || (showdown && !gd.folded);
      out.push({ key: 'c' + c.uid, card: c, rect: godRect(i), faceUp, z: 30 + i, tilt: true, cls: gd.folded ? 'folded' : '' });
    });
    e.board.forEach((c, i) => out.push({ key: 'c' + c.uid, card: c, rect: boardRect(i), faceUp: true, z: 40 + i, tilt: true }));
    e.pending.forEach((c, j) => out.push({ key: 'c' + c.uid, card: c, rect: boardRect(e.board.length + j), faceUp: false, z: 40 + e.board.length + j, tilt: true }));
    if (me.peek && e.pending[0] && e.pending[0].uid === me.peek.uid) {
      out.push({ key: 'peek' + me.peek.uid, card: me.peek, rect: PEEK, faceUp: true, z: 80, cls: 'peek-card' });
    }
    return out;
  }

  sync() {
    const specs = this.desiredCards();
    const keep = new Set(specs.map((s) => s.key));
    for (const [k, el] of this.cards) {
      if (!keep.has(k)) {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 400);
        this.cards.delete(k);
        this.cardShown.delete(k);
      }
    }
    for (const s of specs) {
      let el = this.cards.get(s.key);
      const fresh = !el;
      if (!el) {
        el = createCardEl();
        place(el, s.key.startsWith('peek') ? s.rect : DECK);
        el.dataset.key = s.key;
        el.addEventListener('click', () => this.onCardClick(s.key));
        this.layer.append(el);
        this.cards.set(s.key, el);
      }
      const sig = s.card && s.faceUp ? `${s.card.rank}-${s.card.suit}` : 'x';
      if (this.cardShown.get(s.key) !== sig) {
        // kapalı kartın yüzü DOM'a yazılmaz
        if (s.faceUp) setCardFace(el, s.card);
        this.cardShown.set(s.key, sig);
      }
      el.style.zIndex = String(s.z);
      const transient = ['transmute', 'burning'].filter((c) => el!.classList.contains(c)).map((c) => ' ' + c).join('');
      el.className = 'card' + (s.faceUp ? '' : ' down') + (s.tilt ? ' on-table' : ' in-hand') + (s.cls ? ' ' + s.cls : '') + this.extraClass(s) + transient;
      el.style.setProperty('--rot', `${s.rot ?? 0}deg`);
      if (fresh) {
        el.classList.add('down');
        const elc = el;
        nextFrame().then(() => {
          place(elc, s.rect);
          if (s.faceUp) setTimeout(() => elc.classList.remove('down'), 280);
        });
      } else {
        place(el, s.rect);
      }
    }
    this.syncChips();
    this.syncStacks();
    this.syncHighlights();
    this.syncInfo();
  }

  private extraClass(s: CardSpec): string {
    const sm = this.selectMode;
    if (!sm || !this.engine) return '';
    const e = this.engine;
    if (sm.kind === 'burn') {
      if (e.board.some((c) => 'c' + c.uid === s.key)) return ' selectable';
    }
    if (sm.kind === 'swap') {
      const hi = e.seats[HUMAN].hole.findIndex((c) => 'c' + c.uid === s.key);
      const bi = e.pending.findIndex((c) => 'c' + c.uid === s.key);
      if (hi >= 0) return ' selectable' + (sm.hand === hi ? ' selected' : '');
      if (bi >= 0) return ' selectable' + (sm.board === bi ? ' selected' : '');
    }
    return '';
  }

  private onCardClick(key: string) {
    const sm = this.selectMode;
    const e = this.engine;
    if (!sm || !e) return;
    if (sm.kind === 'burn') {
      const bi = e.board.findIndex((c) => 'c' + c.uid === key);
      if (bi >= 0) {
        sfx.click();
        const res = sm.resolve;
        this.selectMode = null;
        res({ type: 'burn', index: bi });
      }
    } else if (sm.kind === 'swap') {
      const hi = e.seats[HUMAN].hole.findIndex((c) => 'c' + c.uid === key);
      const bi = e.pending.findIndex((c) => 'c' + c.uid === key);
      if (hi >= 0) sm.hand = sm.hand === hi ? undefined : hi;
      if (bi >= 0) sm.board = sm.board === bi ? undefined : bi;
      sfx.click();
      this.sync();
      this.renderSwapBar();
    }
  }

  private syncHighlights() {
    const e = this.engine;
    for (const el of this.cards.values()) el.classList.remove('hl');
    if (!e) return;
    const done = e.phase === 'showdown' || e.phase === 'done';
    if (done && e.showdownInfos[0] && e.showdownInfos[1] && !e.seats[0].folded && !e.seats[1].folded) {
      const sc0 = e.showdownInfos[0]!.score;
      const sc1 = e.showdownInfos[1]!.score;
      const seats = sc0 === sc1 ? [0, 1] : [sc0 > sc1 ? 0 : 1];
      for (const si of seats) {
        const all = e.seats[si].hole.concat(e.board);
        const info = describe(all, e.low);
        all.forEach((c, idx) => {
          if (info.best.includes(idx)) this.cards.get('c' + c.uid)?.classList.add('hl');
        });
      }
      return;
    }
    if (!e.seesOwnCards(HUMAN) || e.low) return;
    const me = e.seats[HUMAN];
    if (me.folded || me.hole.length < 2 || e.board.length < 1) return;
    const all = me.hole.concat(e.board);
    const info = describe(all, e.low);
    if (info.category === 0) return;
    all.forEach((c, idx) => {
      if (info.best.includes(idx)) this.cards.get('c' + c.uid)?.classList.add('hl');
    });
  }

  private syncStacks() {
    const e = this.engine;
    const meStack = e ? e.seats[HUMAN].stack : this.opts.player.stack;
    const godStack = e ? e.seats[GOD].stack : this.opts.god.stack;
    this.el.meStack.innerHTML = `<span class="coin"></span><b>${meStack}</b><span class="unit">puan</span>`;
    this.el.godStack.innerHTML = `<span class="coin"></span><b>${godStack}</b><span class="unit">puan</span>`;
    const live = !!e && e.phase !== 'done';
    this.el.mePlate.classList.toggle('allin', live && e!.seats[HUMAN].allIn);
    this.el.godPlate.classList.toggle('allin', live && e!.seats[GOD].allIn);
    this.el.mePlate.classList.toggle('acting', !!e && e.actor === HUMAN);
    this.el.godPlate.classList.toggle('acting', !!e && e.actor === GOD);
    if (e && e.actor === GOD && this.el.godStage.dataset.mood === 'neutral') this.setMood('think', 0);
  }

  private syncChips() {
    const e = this.engine;
    if (!e) {
      this.el.pot.innerHTML = '';
      this.el.godBet.innerHTML = '';
      this.el.meBet.innerHTML = '';
      return;
    }
    const pot = e.phase === 'done' ? 0 : e.collectedPot;
    this.el.pot.innerHTML = pot > 0 ? `${chipStacks(pot)}<div class="pot-label">${pot}</div>` : '';
    const gb = e.seats[GOD].streetBet;
    const mb = e.seats[HUMAN].streetBet;
    this.el.godBet.innerHTML = gb > 0 ? `${chipStacks(gb, 2)}<span>${gb}</span>` : '';
    this.el.meBet.innerHTML = mb > 0 ? `${chipStacks(mb, 2)}<span>${mb}</span>` : '';
  }

  private clearTable() {
    for (const [k, el] of this.cards) {
      el.classList.add('down');
      place(el, DECK);
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 450);
      this.cards.delete(k);
    }
    this.cardShown.clear();
    this.el.godHL.classList.remove('show');
    this.el.meHL.classList.remove('show');
  }

  private async dealAnimation() {
    const e = this.engine!;
    const bbSeat = 1 - e.dealer;
    const order: Card[] = [];
    for (let k = 0; k < 2; k++) order.push(e.seats[bbSeat].hole[k], e.seats[1 - bbSeat].hole[k]);
    order.push(...e.pending);
    const specs = this.desiredCards();
    for (const c of order) {
      const s = specs.find((x) => x.key === 'c' + c.uid);
      if (!s || this.cards.has(s.key)) continue;
      const el = createCardEl();
      place(el, DECK);
      el.dataset.key = s.key;
      el.addEventListener('click', () => this.onCardClick(s.key));
      el.className = 'card down ' + (s.tilt ? 'on-table' : 'in-hand');
      el.style.setProperty('--rot', `${s.rot ?? 0}deg`);
      el.style.zIndex = String(s.z);
      this.layer.append(el);
      this.cards.set(s.key, el);
      if (s.faceUp) setCardFace(el, s.card);
      this.cardShown.set(s.key, s.faceUp && s.card ? `${s.card.rank}-${s.card.suit}` : 'x');
      await nextFrame();
      place(el, s.rect);
      sfx.card();
      if (s.faceUp) setTimeout(() => el.classList.remove('down'), 320);
      await sleep(T(230));
    }
    await sleep(T(500));
    this.sync();
  }

  private async collectBets() {
    const moves: Promise<void>[] = [];
    for (const el of [this.el.godBet, this.el.meBet]) {
      if (!el.innerHTML) continue;
      const ghost = el.cloneNode(true) as HTMLElement;
      ghost.classList.add('ghost-bet');
      this.root.append(ghost);
      el.innerHTML = '';
      await nextFrame();
      ghost.classList.add('to-pot');
      moves.push(sleep(450).then(() => ghost.remove()));
    }
    if (moves.length) {
      sfx.chips();
      await Promise.all(moves);
    }
  }

  private flyChips(from: 'me' | 'god' | 'pot', to: 'me' | 'god' | 'pot', amount: number) {
    const pos = { me: [150, 650], god: [120, 80], pot: [930, 450] } as const;
    const [x0, y0] = pos[from];
    const [x1, y1] = pos[to];
    const n = Math.min(10, Math.max(3, Math.ceil(amount / 3)));
    for (let i = 0; i < n; i++) {
      const c = h('div', { class: 'fly-chip' });
      c.style.left = x0 + (Math.random() * 30 - 15) + 'px';
      c.style.top = y0 + (Math.random() * 20 - 10) + 'px';
      this.root.append(c);
      setTimeout(() => {
        c.style.left = x1 + (Math.random() * 20 - 10) + 'px';
        c.style.top = y1 + (Math.random() * 20 - 10) + 'px';
        c.style.opacity = '0.1';
      }, 30 + i * 45);
      setTimeout(() => c.remove(), 950 + i * 45);
    }
  }

  private showHandLabel(who: 'me' | 'god', text: string) {
    const el = who === 'me' ? this.el.meHL : this.el.godHL;
    el.textContent = text;
    el.classList.add('show');
  }

  // ---------------------------------------------------------------------------
  // Bilgi: oyuncu levhası + kılavuz çekmecesi
  // ---------------------------------------------------------------------------
  private syncInfo() {
    const e = this.engine;
    if (!e) return;
    const me = e.seats[HUMAN];
    const sees = e.seesOwnCards(HUMAN);
    let handLine = '';
    this.el.dHand.innerHTML = '';
    if (me.folded) {
      handLine = '<i>Çekildin</i>';
    } else if (!sees && e.phase !== 'showdown' && e.phase !== 'done') {
      if (e.game === 'veyla') {
        handLine = '<i>Elin gizli</i>';
        this.el.dHand.innerHTML = `<div class="dh-name">Elin gizli</div><div class="dh-detail">Kendi kartlarını göremezsin. ${this.god.name}'in kartları: ${miniCards(e.seats[GOD].hole.map(cardLabel).join(' '))}</div>`;
      } else {
        handLine = '<i>Kartlar kapalı</i>';
        this.el.dHand.innerHTML = `<div class="dh-name">Kartlar kapalı</div><div class="dh-detail">Kör takas: hiçbir kart görünmüyor. İçgüdüne güven.</div>`;
      }
    } else if (me.hole.length === 2) {
      const info = describe(me.hole.concat(e.board), e.low);
      handLine = `<b>${info.name}</b>`;
      this.el.dHand.innerHTML = `<div class="dh-cards">${miniCards(me.hole.map(cardLabel).join(' '))}</div><div class="dh-name">${info.name}</div><div class="dh-detail">${info.detail}</div>`;
      if (!e.low && e.phase === 'betting') {
        for (const d of drawHints(me.hole, e.board, e.knowledge(HUMAN).dead)) {
          this.el.dHand.insertAdjacentHTML('beforeend', `<div class="dh-draw">${d.name} için: ${miniCards(d.cards)} <span>(${d.outs} kart · sıradakinde %${Math.round(d.chance * 100)})</span></div>`);
        }
      }
      this.renderGuide(e.low ? -1 : info.category);
    }
    let eqTxt = '';
    if (!me.folded && me.hole.length === 2 && e.phase === 'betting') {
      const k = e.knowledge(HUMAN);
      const sig = JSON.stringify([k, e.low]);
      if (sig !== this.eqSig) {
        this.eqSig = sig;
        this.eqVal = equity({ ...k, low: e.low, samples: 1500 });
      }
      const r = this.eqVal!;
      eqTxt = `<span class="mp-eq" title="Tahmini kazanma şansı">%${Math.round(r.share * 100)}</span>`;
      this.el.dEq.innerHTML = `<div class="eq-row"><span>Tahmini kazanma şansı</span><b>%${Math.round(r.win * 100)}</b></div>
        <div class="eq-bar"><div class="eq-win" style="width:${r.win * 100}%"></div><div class="eq-tie" style="width:${r.tie * 100}%"></div></div>
        <div class="eq-sub">${r.tie > 0.01 ? `beraberlik %${Math.round(r.tie * 100)} · ` : ''}${k.opp.length === 2 ? 'rakibin kartlarına göre' : 'rakibin bilinmeyen eline karşı'}${k.next.length ? ' · kehanet dahil' : ''}</div>`;
      this.el.dAdvice.innerHTML = this.advice(r.share);
    } else {
      this.el.dEq.innerHTML = '';
      this.el.dAdvice.innerHTML = '';
    }
    this.el.meHand.innerHTML = handLine ? `${handLine}${eqTxt}` : '';
  }

  private advice(share: number): string {
    const e = this.engine!;
    if (e.actor !== HUMAN) return '';
    const L = e.legal(HUMAN);
    const pot = e.pot;
    const pct = (x: number) => `%${Math.round(x * 100)}`;
    if (L.toCall > 0) {
      const need = L.toCall / (pot + L.toCall);
      let v: string;
      if (share >= need + 0.15) v = '<b class="good">Şansın iyi.</b> Görmek mantıklı, artırmayı da düşünebilirsin.';
      else if (share >= need) v = '<b class="warn">Sınırda.</b> Görmek kabul edilebilir.';
      else v = '<b class="bad">Şansın düşük.</b> Çekilmek mantıklı olabilir, ya da cesur bir blöf.';
      return `Görmek için <b>${L.toCall}</b> puan ödemelisin, pot <b>${pot}</b>. Kârlı olması için en az <b>${pct(need)}</b> şans gerekir. ${v}`;
    }
    if (share > 0.65) return '<b class="good">Güçlü el.</b> Bahis yaparak potu büyütebilirsin.';
    if (share > 0.45) return '<b class="warn">Orta güçte el.</b> Pas geçip sıradaki kartı bedavaya görmek iyi bir seçenek.';
    return '<b class="bad">Zayıf el.</b> Pas geçmek bedava; bahis yaparsan bu bir blöf olur.';
  }

  log(text: string, cls = '') {
    const row = h('div', { class: 'log-row ' + cls, html: miniCards(escapeHtml(text)) });
    this.el.dLog.prepend(row);
    while (this.el.dLog.children.length > 50) this.el.dLog.lastElementChild?.remove();
  }

  // ---------------------------------------------------------------------------
  // İnsan kararları
  // ---------------------------------------------------------------------------
  requestAction(e: HandEngine): Promise<Action> {
    if (this.aborted) return Promise.reject(new AbortMatch());
    this.engine = e;
    sfx.alert();
    this.sync();
    return new Promise<Action>((resolve, reject) => {
      this.pending = { reject };
      const done = (a: Action) => {
        this.pending = null;
        this.selectMode = null;
        this.clearControls();
        resolve(a);
      };
      this.renderActions(e, done);
      this.renderAbility(e, done);
    });
  }

  private renderActions(e: HandEngine, done: (a: Action) => void) {
    const L = e.legal(HUMAN);
    const bar = this.el.actions;
    bar.innerHTML = '';
    bar.className = 'actions active';
    const s = e.seats[HUMAN];

    const fold = medal('fold', MEDAL.fold, 'Çekil', L.toCall === 0 ? 'gerek yok' : 'eli bırak', 'fold-btn');
    fold.onclick = () => done({ type: 'fold' });
    if (L.toCall === 0) fold.setAttribute('disabled', '');

    const allInCall = L.toCall > 0 && L.toCall >= s.stack;
    const call = L.toCall === 0
      ? medal('check', MEDAL.check, 'Pas', 'bedava', 'call-btn')
      : medal('call', MEDAL.call, 'Gör', allInCall ? `hepsi · ${L.toCall}` : `${L.toCall} puan`, 'call-btn');
    call.onclick = () => done(L.toCall === 0 ? { type: 'check' } : { type: 'call' });

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
        amount.innerHTML = `<b>${value}</b><span>${all ? 'hepsi ortada' : isBet ? 'puan bahis' : "puana çıkar"}</span>`;
        raise.querySelector('.m-label')!.textContent = all ? 'Hepsi' : isBet ? 'Bahis' : 'Artır';
        raise.querySelector('.m-sub')!.textContent = `${value}`;
        raise.querySelector('.m-coin')!.innerHTML = all ? MEDAL.allin : MEDAL.raise;
        raise.classList.toggle('m-allin', all);
        const pct = max > min ? ((value - min) / (max - min)) * 100 : 100;
        slider.style.setProperty('--p', pct + '%');
      };
      slider.oninput = () => setV(+slider.value);
      raise.onclick = () => done({ type: 'raise', to: value });
      const pot = e.pot;
      const presets: [string, number][] = [
        ['en az', min],
        ['yarım pot', L.currentBet + Math.round((pot + L.toCall) / 2)],
        ['pot', L.currentBet + pot + L.toCall],
        ['hepsi', max],
      ];
      const pr = h('div', { class: 'rail-presets' });
      presets.forEach(([n, v], i) => {
        if (i) pr.append(h('span', { class: 'dot' }, '·'));
        const b = h('button', { class: 'rail-preset' }, n);
        b.onclick = () => {
          sfx.click();
          setV(v);
        };
        pr.append(b);
      });
      bar.append(h('div', { class: 'bet-rail' }, amount, slider, pr));
      row.append(raise);
      setV(min);
      slider.addEventListener('wheel', (ev) => {
        ev.preventDefault();
        setV(value + (ev.deltaY < 0 ? 1 : -1));
      });
    }
    bar.append(row);
  }

  private renderAbility(e: HandEngine, done: (a: Action) => void) {
    const L = e.legal(HUMAN);
    const g = GAMES[e.game];
    const p = this.el.ability;
    p.innerHTML = '';
    p.className = 'ability';
    if (!g.abilityName || e.game === 'kesh') return;
    const s = e.seats[HUMAN];
    const usedKey = ({ veyla: 'burn', kronvel: 'refund', oris: 'peek', prisma: 'flip' } as Record<string, keyof typeof s.used>)[e.game];
    const icon = ({ veyla: ICON.flame, kronvel: ICON.hourglass, oris: ICON.eye, prisma: ICON.prism } as Record<string, string>)[e.game];
    p.classList.add('show');
    const text = h('div', { class: 'ab-text' });
    const btn = medal('rune', icon, g.abilityName, '');
    p.append(btn, text);
    if (s.used[usedKey]) {
      btn.setAttribute('disabled', '');
      btn.querySelector('.m-sub')!.textContent = 'kullanıldı';
      text.append(h('div', { class: 'ab-hint' }, 'Bu elde hakkını kullandın. Yeni dağıtımda yenilenir.'));
      p.classList.add('spent');
      return;
    }
    let enabled = true;
    let note = '';
    if (e.game === 'veyla') {
      enabled = L.abilities.burn;
      if (!enabled) note = 'Yere kart açılınca kullanılabilir.';
      btn.onclick = () => {
        sfx.click();
        this.selectMode = { kind: 'burn', resolve: done };
        this.sync();
        text.innerHTML = '';
        const cancel = h('button', { class: 'text-link' }, 'vazgeç');
        cancel.onclick = () => {
          this.selectMode = null;
          this.sync();
          this.renderAbility(e, done);
        };
        text.append(h('div', { class: 'ab-hint glow' }, 'Yakmak istediğin yer kartına dokun.'), cancel);
      };
    } else if (e.game === 'kronvel') {
      enabled = !!L.abilities.refund;
      if (enabled) {
        btn.querySelector('.m-sub')!.textContent = `+${L.abilities.refund}`;
        note = `Son bahsin ${s.lastBet?.amount} puandı; yarısı geri gelir.`;
      } else note = s.lastBet ? 'Yeni kart açıldıktan sonra kullanılabilir.' : 'Henüz geri alınacak bir bahsin yok.';
      btn.onclick = () => done({ type: 'refund' });
    } else if (e.game === 'oris') {
      enabled = L.abilities.peek;
      btn.onclick = () => done({ type: 'peek' });
    } else {
      enabled = L.abilities.flip;
      if (enabled) {
        const k = e.knowledge(HUMAN);
        const now = equity({ ...k, low: e.low, samples: 600 }).share;
        const flipped = s.hole.map((c) => ({ rank: c.rank, suit: FLIP_SUIT[c.suit] }));
        const v = equity({ ...k, mine: flipped, low: e.low, samples: 600 }).share;
        const txt = flipped.map((c) => `${RANK_LABELS[c.rank]}${SUIT_SYMBOLS[c.suit]}`).join(' ');
        note = `Çevrilirse ${miniCards(txt)} olur · şansın %${Math.round(now * 100)} → %${Math.round(v * 100)}`;
      }
      btn.onclick = () => done({ type: 'flip' });
    }
    if (!enabled) btn.setAttribute('disabled', '');
    text.append(h('div', { class: 'ab-hint' }, g.abilityHint ?? ''));
    if (note) text.append(h('div', { class: 'ab-note', html: note }));
  }

  requestSwap(e: HandEngine): Promise<SwapChoice | null> {
    if (this.aborted) return Promise.reject(new AbortMatch());
    this.engine = e;
    sfx.alert();
    return new Promise((resolve, reject) => {
      this.pending = { reject };
      this.selectMode = {
        kind: 'swap',
        resolve: (v: SwapChoice | null) => {
          this.pending = null;
          this.selectMode = null;
          this.clearControls();
          this.sync();
          resolve(v);
        },
      };
      this.sync();
      this.renderSwapBar();
    });
  }

  private renderSwapBar() {
    const sm = this.selectMode;
    if (!sm || sm.kind !== 'swap') return;
    const bar = this.el.actions;
    bar.innerHTML = '';
    bar.className = 'actions active';
    const ready = sm.hand !== undefined && sm.board !== undefined;
    const ok = medal('raise', MEDAL.swap, 'Takas et', ready ? 'hazır' : 'seç');
    if (!ready) ok.setAttribute('disabled', '');
    ok.onclick = () => sm.resolve({ hand: sm.hand!, board: sm.board! });
    const no = medal('fold', MEDAL.no, 'Dokunma', 'kartlar kalsın');
    no.onclick = () => sm.resolve(null);
    bar.append(
      h('div', { class: 'swap-text' }, ready ? 'Seçimin hazır. İçgüdüne güveniyor musun?' : 'Elinden bir kart, yerden bir kart seç.'),
      h('div', { class: 'medal-row' }, no, ok),
    );
    this.el.prompt.innerHTML = `<div class="pr-title">Kör Takas</div><div class="pr-text">Hiçbir kart görünmüyor. ${this.god.name} de gizlice seçiyor. Aynı yer kartını seçerseniz elinizde tuttuğunuz kartlar açılır; büyük olan kazanır.</div>`;
    this.el.prompt.classList.add('show');
  }

  // ---------------------------------------------------------------------------
  // Görsel efektler
  // ---------------------------------------------------------------------------
  setMood(m: Mood, ms = 2400) {
    this.el.godStage.dataset.mood = m;
    this.el.godHands.dataset.mood = m;
    clearTimeout(this.moodTimer);
    if (ms > 0)
      this.moodTimer = window.setTimeout(() => {
        const acting = this.engine?.actor === GOD;
        this.el.godStage.dataset.mood = acting ? 'think' : 'neutral';
      }, ms);
  }

  godSays(kind: SpeechKind) {
    const lines = this.god.lines[kind];
    if (lines) this.say(pick(lines));
  }

  say(text: string, ms = 3200) {
    const s = this.el.speech as HTMLElement & { _iv?: number; _t?: number };
    s.innerHTML = '';
    const t = h('div', { class: 'sp-text' });
    s.append(h('div', { class: 'sp-name' }, this.god.name), t);
    s.classList.add('show');
    let i = 0;
    clearInterval(s._iv);
    s._iv = window.setInterval(() => {
      i++;
      t.textContent = `“${text.slice(0, i)}${i < text.length ? '' : '”'}`;
      if (i >= text.length) clearInterval(s._iv);
    }, 28);
    clearTimeout(s._t);
    s._t = window.setTimeout(() => s.classList.remove('show'), ms + text.length * 28);
  }

  private floatAction(who: 'me' | 'god', text: string, kind: string) {
    const el = who === 'me' ? this.el.meAct : this.el.godAct;
    el.textContent = text;
    el.className = `act-float ${who}-act k-${kind}`;
    void el.offsetWidth;
    el.classList.add('show');
  }

  private flash(text: string) {
    const f = h('div', { class: 'street-flash' }, text);
    this.root.append(f);
    setTimeout(() => f.remove(), 1500);
  }

  async banner(text: string, kind: 'good' | 'bad' | 'info' = 'info', ms = 1300) {
    const b = h('div', { class: `banner ${kind}` }, h('span', {}, text));
    this.el.overlay.append(b);
    await sleep(ms);
    b.classList.add('out');
    setTimeout(() => b.remove(), 400);
  }

  private async animateDice(rolls: [number, number], tie: boolean, context: 'hand' | 'swap') {
    this.clearDice();
    const wrap = h('div', { class: 'dice-wrap' });
    if (context === 'swap') wrap.append(h('div', { class: 'dice-title' }, 'Eşitlik · zar'));
    const mk = (label: string) => {
      const d = h('div', { class: 'die rolling' });
      wrap.append(h('div', { class: 'die-box' }, d, h('div', { class: 'die-label' }, label)));
      return d;
    };
    const dMe = mk('Sen');
    const dGod = mk(this.god.name);
    this.el.overlay.append(wrap);
    sfx.dice();
    for (let i = 0; i < 11; i++) {
      dMe.innerHTML = pips(1 + Math.floor(Math.random() * 6));
      dGod.innerHTML = pips(1 + Math.floor(Math.random() * 6));
      await sleep(70);
    }
    dMe.classList.remove('rolling');
    dGod.classList.remove('rolling');
    dMe.innerHTML = pips(rolls[0]);
    dGod.innerHTML = pips(rolls[1]);
    this.log(`Zar: Sen ${rolls[0]}, ${this.god.name} ${rolls[1]}`);
    if (tie) {
      wrap.append(h('div', { class: 'dice-msg' }, 'Eşit · tekrar'));
      await sleep(T(1400));
      return;
    }
    (rolls[0] > rolls[1] ? dMe : dGod).classList.add('win');
    await sleep(T(1300));
  }

  private clearDice() {
    this.el.overlay.querySelectorAll('.dice-wrap').forEach((d) => d.remove());
  }

  // ---------------------------------------------------------------------------
  // Modallar
  // ---------------------------------------------------------------------------
  showRules(game: GameId = this.game) {
    modal(rulesContent(game), { closable: true, className: 'rules-modal' });
  }

  private openJoker() {
    if (!this.jokerAvailable || this.opts.mode !== 'tournament') return;
    const m = jokerPicker(this.game, `Seçtiğin oyun bir sonraki elden itibaren ${this.god.name} ile bu maçın sonuna kadar oynanır.`, (id) => {
      this.jokerAvailable = false;
      this.match.pendingGame = id;
      this.opts.onJokerUsed?.(id);
      this.updateJoker();
      m.close();
      sfx.magic();
      this.log(`Joker hakkı: sonraki elden itibaren ${GAMES[id].name} oynanacak.`, 'good');
      this.banner(`Joker · oyun değişiyor: ${GAMES[id].name}`, 'good', 1800);
      this.setMood('angry', 3000);
      this.say(pick(['Ne?! Kuralları sen mi koyuyorsun?', 'Hizmetçi... cüretkâr.', 'Peki. Görelim bakalım.']));
    });
  }

  private confirmQuit() {
    const m = modal(
      h(
        'div',
        { class: 'confirm' },
        h('h3', {}, 'Masadan kalk?'),
        h('p', { class: 'muted' }, 'Bu maçtaki ilerleme kaybolur.'),
        h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Vazgeç'), h('button', { class: 'btn danger', onclick: () => { m.close(); this.abort(); } }, 'Kalk')),
      ),
      { closable: true },
    );
  }

  abort() {
    this.aborted = true;
    this.pending?.reject(new AbortMatch());
    this.pending = null;
  }

  private async showMatchEnd(r: MatchResult) {
    this.clearControls();
    const won = r.winner === 'player';
    if (won) sfx.bigWin();
    else sfx.lose();
    const line = pick(won ? this.god.lines.matchLose : this.god.lines.matchWin);
    this.setMood(won ? 'angry' : 'smug', 0);
    this.say(line, 8000);
    await sleep(1200);
    await new Promise<void>((resolve) => {
      const content = h(
        'div',
        { class: 'match-end ' + (won ? 'won' : 'lost') },
        h('div', { class: 'modal-kicker' }, won ? `${this.god.name} iflas etti` : 'Puanların tükendi'),
        h('h2', {}, won ? 'Zafer' : 'Yenilgi'),
        h('div', { class: 'orn-line wide' }),
        h('p', { class: 'quote' }, `“${line}”`),
        h('div', { class: 'muted' }, won ? `${r.stacks[0]} puanla masadan kalkıyorsun · ${r.hands} el` : `${r.hands} el oynandı`),
      );
      const btn = h('button', { class: 'btn primary' }, 'Devam');
      content.append(btn);
      const m = modal(content, { className: 'end-modal' });
      btn.onclick = () => {
        m.close();
        resolve();
      };
    });
  }
}

class HumanController implements Controller {
  constructor(private view: TableView) {}
  act(e: HandEngine): Promise<Action> {
    return this.view.requestAction(e);
  }
  chooseSwap(e: HandEngine): Promise<SwapChoice | null> {
    return this.view.requestSwap(e);
  }
}

// ---------------------------------------------------------------------------
/** Masaya konmuş madalyon düğme */
export function medal(kind: string, icon: string, label: string, sub = '', cls = ''): HTMLButtonElement {
  return h('button', {
    class: `medal m-${kind} ${cls}`,
    html: `<span class="m-coin">${icon}</span><span class="m-label">${label}</span><span class="m-sub">${sub}</span>`,
  }) as HTMLButtonElement;
}

export function place(el: HTMLElement, r: Rect) {
  el.style.left = r.x + 'px';
  el.style.top = r.y + 'px';
  el.style.width = r.w + 'px';
  el.style.height = r.h + 'px';
}

export function clampInt(v: number, a: number, b: number) {
  if (!isFinite(v)) v = a;
  return Math.max(a, Math.min(b, Math.round(v)));
}

export function actText(kind: string, amount: number, to: number): string {
  switch (kind) {
    case 'fold': return 'Çekildi';
    case 'check': return 'Pas';
    case 'call': return `Gördü · ${amount}`;
    case 'bet': return `Bahis · ${to}`;
    case 'raise': return `Artırdı · ${to}`;
    case 'allin': return `Hepsi · ${to}`;
  }
  return kind;
}

/** Pul kuleleri */
export function chipStacks(amount: number, maxCols = 3): string {
  const colors = ['#8c1c24', '#1d5a4e', '#c9a14a', '#2a2f5e', '#e8e0cc'];
  const total = Math.min(24, Math.max(1, Math.round(Math.sqrt(amount) * 2.2)));
  const cols = Math.min(maxCols, Math.ceil(total / 7));
  let s = '<div class="stacks">';
  let left = total;
  for (let c = 0; c < cols; c++) {
    const n = Math.ceil(left / (cols - c));
    left -= n;
    s += `<div class="stk" style="--c:${colors[(c + amount) % colors.length]}">`;
    for (let i = 0; i < n; i++) s += `<i style="bottom:${i * 3.2}px"></i>`;
    s += '</div>';
  }
  return s + '</div>';
}

export function pips(n: number): string {
  const P: Record<number, number[][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[25, 25], [50, 50], [75, 75]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
    6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
  };
  return P[n].map(([x, y]) => `<span style="left:${x}%;top:${y}%"></span>`).join('');
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

/** Perspektifli masa (birinci şahıs) */
export function tableSVG(): string {
  const far = 392;
  const star = sevenStar(100, '#d4af6a').replace(/<svg[^>]*>/, '<g transform="translate(-150 -150) scale(3)">').replace('</svg>', '</g>');
  return `<svg viewBox="0 0 1280 720" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="tWood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3a1c"/><stop offset=".4" stop-color="#3a2410"/><stop offset="1" stop-color="#1a0f06"/></linearGradient>
      <radialGradient id="tFelt" cx="50%" cy="38%" r="70%"><stop offset="0" class="felt-hi"/><stop offset=".55" class="felt-mid"/><stop offset="1" class="felt-lo"/></radialGradient>
      <radialGradient id="tLight" cx="50%" cy="45%" r="45%"><stop offset="0" stop-color="#ffe8b0" stop-opacity=".2"/><stop offset="1" stop-color="#ffe8b0" stop-opacity="0"/></radialGradient>
      <filter id="tNoise"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .08 0"/></filter>
    </defs>
    <path d="M232 ${far - 14} L1048 ${far - 14} L1520 760 L-240 760Z" fill="url(#tWood)"/>
    <path d="M232 ${far - 14} L1048 ${far - 14}" stroke="#c9a14a" stroke-width="2" opacity=".6"/>
    <path d="M256 ${far} L1024 ${far} L1460 760 L-180 760Z" fill="url(#tFelt)"/>
    <path d="M256 ${far} L1024 ${far} L1460 760 L-180 760Z" filter="url(#tNoise)"/>
    <path d="M286 ${far + 14} L994 ${far + 14} L1380 760 L-100 760Z" fill="none" stroke="#d4af6a" stroke-width="1.6" opacity=".35"/>
    <g transform="translate(640 556) scale(1 .34)" opacity=".1">${star}</g>
    <ellipse cx="640" cy="556" rx="520" ry="190" fill="url(#tLight)"/>
    ${[312, 968].map((x) => `<g class="candle" transform="translate(${x} ${far + 2})">
      <circle class="glow" cy="-34" r="70" fill="#ffb347" opacity=".16"/>
      <ellipse cy="6" rx="22" ry="7" fill="#2a1a0a"/><rect x="-9" y="-30" width="18" height="36" fill="#efe3c8"/><ellipse cy="-30" rx="9" ry="3" fill="#fff5dc"/>
      <path class="flame" d="M0 -32 Q-7 -44 0 -60 Q7 -44 0 -32Z" fill="#ffd27a"/><path class="flame" d="M0 -34 Q-3 -42 0 -50 Q3 -42 0 -34Z" fill="#fff"/></g>`).join('')}
  </svg>`;
}

export function rulesContent(game: GameId): HTMLElement {
  const gd = GAMES[game];
  const god = game === 'klasik' ? null : GODS[game as GodId];
  return h(
    'div',
    { class: 'rules' },
    h(
      'div',
      { class: 'rules-head' },
      god ? h('div', { class: 'rules-portrait', html: portrait(god.id) }) : null,
      h('div', {}, h('div', { class: 'modal-kicker' }, god ? `${god.name} · ${god.title}` : 'Temel oyun'), h('h2', {}, gd.name), h('p', { class: 'rules-short' }, gd.short)),
    ),
    h('ol', {}, ...gd.rules.map((r) => h('li', {}, r))),
    h(
      'div',
      { class: 'rules-base' },
      h('b', {}, 'Temel akış: '),
      'Herkese 2 kart, yere 5 kapalı ortak kart. Yer kartları birer birer açılır, her kartın ardından bahis turu olur. En iyi 5 kartlık el ya da rakibi çekilmeye zorlayan potu alır. Puanı biten iflas eder.',
    ),
  );
}

export function jokerPicker(current: GameId, note: string, onPick: (id: GameId) => void) {
  const grid = h('div', { class: 'joker-grid' });
  const m = modal(h('div', {}, h('div', { class: 'modal-kicker' }, 'Turnuvada yalnızca bir kez'), h('h2', {}, 'Joker Hakkı'), h('p', { class: 'muted' }, note), grid), { closable: true, className: 'joker-modal' });
  for (const id of Object.keys(GAMES) as GameId[]) {
    if (id === current) continue;
    const gd = GAMES[id];
    const b = h('button', { class: 'joker-opt' }, h('div', { class: 'jo-name' }, gd.name), h('div', { class: 'jo-owner' }, id === 'klasik' ? 'Temel oyun' : GODS[id as GodId].name), h('div', { class: 'jo-short' }, gd.short));
    b.onclick = () => onPick(id);
    grid.append(b);
  }
  return m;
}
