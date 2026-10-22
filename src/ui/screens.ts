import { GAMES, GameId, GODS, GOD_ORDER, GodId, pick } from '../engine/gods';
import { EntrantId, simulateMatch } from '../engine/match';
import { BracketMatch, START_STACK, Tournament } from '../engine/tournament';
import { portrait, sevenStar } from './art';
import { isMuted, setMuted, sfx, startAmbient, stopAmbient } from './audio';
import { h, modal, save, sleep, stageEl, store } from './dom';
import { godFigure } from './figures';
import { ICON } from './icons';
import { showBook } from './book';
import { showOnline } from './online';
import { GOD_PARTICLES, Particles, godScene, templeScene } from './scenes';
import { AbortMatch, MatchResult, TableView, jokerPicker, rulesContent } from './table';

const PROGRESS_KEY = 'ytm-progress';
interface Progress {
  beaten: GodId[];
  storySeen: boolean;
  titles: number;
}

function progress(): Progress {
  return store<Progress>(PROGRESS_KEY, { beaten: [], storySeen: false, titles: 0 });
}
function setProgress(p: Progress) {
  save(PROGRESS_KEY, p);
}

let activeParticles: Particles | null = null;

function clearStage() {
  activeParticles?.destroy();
  activeParticles = null;
  const s = stageEl();
  s.innerHTML = '';
  return s;
}

/** Tapınak arka planlı menü ekranı */
function screen(cls: string, ...children: (Node | null)[]): HTMLElement {
  const st = clearStage();
  activeParticles = new Particles('dust', 45);
  const el = h('div', { class: 'screen ' + cls }, h('div', { class: 'scene-bg', html: templeScene() }), activeParticles.canvas, h('div', { class: 'menu-shade' }), ...children);
  st.append(el);
  startAmbient(41.2);
  return el;
}

function muteButton() {
  const b = h('button', { class: 'hud-btn corner-mute', html: `${isMuted() ? ICON.soundOff : ICON.soundOn}<span>Ses</span>` });
  b.onclick = () => {
    setMuted(!isMuted());
    b.innerHTML = `${isMuted() ? ICON.soundOff : ICON.soundOn}<span>Ses</span>`;
  };
  return b;
}

// ---------------------------------------------------------------------------
// Açılış: hikâye → yol ayrımı
// ---------------------------------------------------------------------------
export function boot() {
  showStory(() => showCrossroads());
}

/** Hikâyeden sonra: Sınav mı, Turnuva mı? İki tarot kartı. */
export function showCrossroads() {
  const p = progress();
  const tarot = (num: string, title: string, art: string, lines: string[], foot: string, onPick: () => void, cls = '') => {
    const b = h(
      'button',
      { class: 'tarot ' + cls },
      h('div', { class: 'tr-frame' }),
      h('div', { class: 'tr-num' }, num),
      h('div', { class: 'tr-art', html: art }),
      h('div', { class: 'tr-title' }, title),
      ...lines.map((l) => h('div', { class: 'tr-line' }, l)),
      h('div', { class: 'tr-foot' }, foot),
    );
    b.onclick = () => {
      sfx.flip();
      onPick();
    };
    return b;
  };
  const ring = GOD_ORDER.map((g, i) => {
    const a = (-172 + i * (164 / 6)) * (Math.PI / 180);
    const x = 50 + Math.cos(a) * 44;
    const y = 66 + Math.sin(a) * 50;
    const beaten = p.beaten.includes(g);
    return `<div class="tr-god${beaten ? ' beaten' : ''}" style="left:${x}%;top:${y}%">${portrait(g)}</div>`;
  }).join('');
  const sinavArt = `<div class="tr-ring">${ring}<div class="tr-candle"></div></div>`;
  const throne = `<svg viewBox="0 0 200 220" class="tr-throne"><defs><linearGradient id="thG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dc9a"/><stop offset="1" stop-color="#7a5a1e"/></linearGradient></defs>
    <g opacity=".95"><path d="M60 200 L60 90 Q60 50 100 40 Q140 50 140 90 L140 200 Z" fill="#1a120a" stroke="url(#thG)" stroke-width="3"/>
    <path d="M44 200 L44 140 L156 140 L156 200" fill="none" stroke="url(#thG)" stroke-width="4"/><rect x="52" y="140" width="96" height="14" fill="#3a2410" stroke="url(#thG)" stroke-width="2"/>
    <path d="M70 100 Q100 70 130 100" fill="none" stroke="url(#thG)" stroke-width="1.5" opacity=".7"/></g>
    <g transform="translate(100 22)">${sevenStar(56).replace(/<svg[^>]*>/, '<g transform="translate(-28 -28) scale(.56)">').replace('</svg>', '</g>')}</g></svg>`;
  const roundTable = `<svg viewBox="0 0 200 220" class="tr-throne"><defs><radialGradient id="rtF" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#22705f"/><stop offset="1" stop-color="#0a2a24"/></radialGradient><linearGradient id="rtG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3dc9a"/><stop offset="1" stop-color="#7a5a1e"/></linearGradient></defs>
    <ellipse cx="100" cy="120" rx="78" ry="44" fill="#2a1a0a" stroke="url(#rtG)" stroke-width="3"/><ellipse cx="100" cy="116" rx="68" ry="36" fill="url(#rtF)"/>
    ${[[100, 58], [182, 118], [100, 178], [18, 118]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="13" fill="#1a120a" stroke="url(#rtG)" stroke-width="2"/><circle cx="${x}" cy="${y}" r="4" fill="#f3dc9a"/>`).join('')}
    ${[0, 1, 2].map((i) => `<rect x="${80 + i * 14}" y="104" width="12" height="17" rx="1.5" fill="#f4ead2" stroke="#7a5a1e" stroke-width=".8" transform="rotate(${-10 + i * 10} ${86 + i * 14} 112)"/>`).join('')}
    <g transform="translate(100 20)">${sevenStar(40).replace(/<svg[^>]*>/, '<g transform="translate(-20 -20) scale(.4)">').replace('</svg>', '</g>')}</g></svg>`;
  const t = h(
    'div',
    { class: 'cross' },
    h('div', { class: 'cross-head' }, h('div', { class: 'cross-kicker' }, 'Yedi tanrı seni bekliyor'), h('h1', { class: 'cross-title' }, 'Yolunu seç')),
    h(
      'div',
      { class: 'tarot-row' },
      tarot('I', 'Sınav', sinavArt, ['Yedi tanrının oyununu tek tek öğren', 've her birini kendi masasında yen.'], p.beaten.length ? `${p.beaten.length} / 7 tanrı yenildi` : 'Önerilen başlangıç', showChapter1),
      tarot('II', 'Turnuva', throne, ['Sekiz oyuncu, tek taht.', 'Rakibini ve oyunu kader seçer.'], p.titles ? `${p.titles} kez taht senindi` : 'Puanlar maçtan maça taşınır', startTournament, 'gold'),
      tarot('III', 'Çevrimiçi', roundTable, ['İki ila dört kişi aynı masada.', 'Masayı kur ya da numarayla katıl.'], 'Arkadaşlarınla oyna', () => showOnline(showCrossroads), 'night'),
    ),
    h(
      'div',
      { class: 'cross-links' },
      h('button', { class: 'text-link', onclick: () => showBook(), html: `${ICON.book}<span>Hizmetçinin Defteri</span>` }),
      h('span', { class: 'dot' }, '·'),
      h('button', { class: 'text-link', onclick: () => showStory(() => showCrossroads()), html: `${ICON.scroll}<span>Hikâyeyi yeniden dinle</span>` }),
    ),
  );
  screen('cross-screen', t, muteButton());
}

/** Eski adıyla da çağrılabilsin */
export const showTitle = showCrossroads;

// ---------------------------------------------------------------------------
// Hikâye
// ---------------------------------------------------------------------------
const STORY = [
  'Poker tanrıları taht kavgasına tutuştu.\nYedi tanrı vardı, ama taht bir taneydi.',
  'Gerçek Poker Tanrısını seçmek için her biri kendi oyununu yarattı.\nKuralları bükülmüş, ruhlarını yansıtan yedi oyun.',
  'Bu oyunları sınamak için herkesin ortak hizmetçisi çağrıldı.\nYani sen.',
  'Hizmetçi yedi oyunda yedi tanrıyı da yendi.\nTanrılar oybirliğiyle karar verdi: hizmetçi de turnuvaya katılacak.',
  'Ama hizmetçinin kendi oyunu yoktu.\nBu yüzden ona bir hak tanındı: turnuvada bir kez, masadaki oyunu dilediği oyunla değiştirmek.',
  'Destede ne renge ne de tanrıya ait olan tek bir kart vardır.\nJoker.\n\nMasaya otur, Joker. Herkes 20 puanla başlar. İflas eden elenir.',
];

export function showStory(next: () => void) {
  let i = 0;
  const text = h('div', { class: 'story-text' });
  const img = h('div', { class: 'story-img' });
  const nextBtn = h('button', { class: 'text-link big' }, 'Devam ›');
  const skip = h('button', { class: 'text-link' }, 'Hikâyeyi atla');
  const done = () => {
    const p = progress();
    p.storySeen = true;
    setProgress(p);
    next();
  };
  const render = () => {
    text.classList.remove('in');
    void text.offsetWidth;
    text.textContent = STORY[i];
    text.classList.add('in');
    img.innerHTML = '';
    if (i <= 1) {
      const row = h('div', { class: 'story-gods' });
      GOD_ORDER.forEach((g, k) => {
        const d = h('div', { class: 'sg', html: portrait(g) });
        d.style.animationDelay = `${k * 0.12}s`;
        row.append(d);
      });
      img.append(row);
    } else if (i === 2 || i === 5) {
      img.append(h('div', { class: 'story-joker', html: portrait('player') }));
    } else {
      img.append(h('div', { class: 'story-star', html: sevenStar(140) }));
    }
    nextBtn.textContent = i === STORY.length - 1 ? 'Yolunu seç ›' : 'Devam ›';
  };
  nextBtn.onclick = () => {
    sfx.flip();
    i++;
    if (i >= STORY.length) done();
    else render();
  };
  skip.onclick = done;
  const sc = screen('story-screen', img, text, h('div', { class: 'story-nav' }, skip, nextBtn), h('div', { class: 'story-dots' }, ...STORY.map(() => h('i', {}))));
  const onKey = (e: KeyboardEvent) => {
    if (!sc.isConnected) return window.removeEventListener('keydown', onKey);
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') nextBtn.click();
    if (e.key === 'Escape') skip.click();
  };
  window.addEventListener('keydown', onKey);
  const origRender = render;
  void origRender;
  const dots = () => sc.querySelectorAll('.story-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
  nextBtn.addEventListener('click', dots);
  render();
  dots();
}

// ---------------------------------------------------------------------------
// Bölüm I — Sınav
// ---------------------------------------------------------------------------
export function showChapter1() {
  const p = progress();
  const grid = h('div', { class: 'ch1-grid' });
  GOD_ORDER.forEach((g, i) => {
    const god = GODS[g];
    const beaten = p.beaten.includes(g);
    const card = h(
      'button',
      { class: 'alcove' + (beaten ? ' beaten' : '') },
      h('div', { class: 'al-num' }, ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][i]),
      h('div', { class: 'al-portrait', html: portrait(g) }),
      h('div', { class: 'al-name' }, god.name),
      h('div', { class: 'al-title' }, god.title),
      h('div', { class: 'al-game' }, god.gameName),
      h('div', { class: 'al-short' }, GAMES[g].short),
      beaten ? h('div', { class: 'al-seal' }, 'Yenildi') : h('div', { class: 'al-candle' }),
    );
    card.style.setProperty('--god', god.color);
    card.style.animationDelay = `${i * 0.07}s`;
    card.onclick = () => {
      sfx.click();
      godIntro(g);
    };
    grid.append(card);
  });
  const all = p.beaten.length === 7;
  screen(
    'ch1-screen',
    h(
      'div',
      { class: 'ch-head' },
      h('button', { class: 'text-link', onclick: showCrossroads, html: `${ICON.back}<span>Yol ayrımı</span>` }),
      h('div', {}, h('h2', {}, 'Sınav'), h('div', { class: 'sub' }, 'Bir tanrı seç ve masasına otur. Her sınav 20 - 20 puanla başlar.')),
      h('div', { class: 'ch-progress' }, `${p.beaten.length} / 7`),
    ),
    grid,
    all
      ? h('div', { class: 'ch1-foot' }, 'Yedi tanrıyı da yendin. Tanrılar seni turnuvaya kabul etti.', h('button', { class: 'text-link big', onclick: startTournament }, 'Turnuvaya yürü ›'))
      : h('div', { class: 'ch1-foot' }, 'Sınavları bitirmeden de turnuvaya katılabilirsin, ama önce kuralları öğrenmek akıllıca olur.'),
    muteButton(),
  );
}

export async function godIntro(g: GodId) {
  const r = await playMatch({ god: g, game: g, playerStack: START_STACK, godStack: START_STACK, mode: 'tutorial', roundLabel: 'Sınav' });
  if (r && r.winner === 'player') {
    const p = progress();
    if (!p.beaten.includes(g)) p.beaten.push(g);
    setProgress(p);
  }
  showChapter1();
}

// ---------------------------------------------------------------------------
// Maç oynatma
// ---------------------------------------------------------------------------
async function playMatch(o: {
  god: GodId;
  game: GameId;
  playerStack: number;
  godStack: number;
  mode: 'tutorial' | 'tournament';
  roundLabel: string;
  jokerAvailable?: boolean;
  onJokerUsed?: (g: GameId) => void;
}): Promise<MatchResult | null> {
  const stage = clearStage();
  stopAmbient();
  const view = new TableView({
    stage,
    godId: o.god,
    game: o.game,
    player: { id: 'player', name: 'Sen', stack: o.playerStack },
    god: { id: o.god, name: GODS[o.god].name, stack: o.godStack },
    mode: o.mode,
    roundLabel: o.roundLabel,
    jokerAvailable: !!o.jokerAvailable,
    onJokerUsed: o.onJokerUsed,
  });
  try {
    const r = await view.run();
    view.destroy();
    return r;
  } catch (e) {
    view.destroy();
    if (!(e instanceof AbortMatch)) console.error(e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Bölüm II — Turnuva
// ---------------------------------------------------------------------------
let T: Tournament | null = null;

function startTournament() {
  T = new Tournament();
  showBracket();
}

function entrantName(id: EntrantId) {
  return id === 'player' ? 'Sen · Joker' : GODS[id].name;
}

function showBracket(simulating: Set<BracketMatch> = new Set()) {
  const t = T!;
  const cols = h('div', { class: 'bracket' });
  const names = ['Çeyrek Final', 'Yarı Final', 'Final'];
  for (let r = 0; r < 3; r++) {
    const body = h('div', { class: 'br-col-body' });
    const col = h('div', { class: 'br-col' }, h('div', { class: 'br-col-title' }, names[r]), body);
    const ms = t.rounds[r] ?? [];
    const count = [4, 2, 1][r];
    for (let i = 0; i < count; i++) {
      const m = ms[i];
      body.append(m ? matchBox(m, r === t.round, simulating.has(m)) : h('div', { class: 'br-match empty' }, h('div', { class: 'br-row' }, '—'), h('div', { class: 'br-row' }, '—')));
    }
    cols.append(col);
  }
  const champ = t.champion;
  cols.append(
    h(
      'div',
      { class: 'br-col' },
      h('div', { class: 'br-col-title' }, 'Taht'),
      h('div', { class: 'br-col-body' }, h('div', { class: 'br-champ' }, champ ? h('div', { class: 'champ-portrait', html: portrait(champ) }) : h('div', { class: 'champ-throne', html: sevenStar(80) }), h('div', { class: 'champ-name' }, champ ? entrantName(champ) : 'Boş'))),
    ),
  );

  const pm = t.playerMatch;
  const actions = h('div', { class: 'br-actions' });
  if (!t.finished && pm && !pm.winner && simulating.size === 0) {
    const opp = (pm.a === 'player' ? pm.b : pm.a) as GodId;
    const b = h('button', { class: 'text-link big glow' }, `${t.roundName} · ${GODS[opp].name} seni bekliyor ›`);
    b.onclick = () => {
      sfx.click();
      showVersus(pm);
    };
    actions.append(b);
  }
  const me = t.entrants.player;
  screen(
    'bracket-screen',
    h(
      'div',
      { class: 'ch-head' },
      h('button', { class: 'text-link', onclick: () => confirmLeaveTournament(), html: `${ICON.back}<span>Yol ayrımı</span>` }),
      h('div', {}, h('h2', {}, 'Turnuva'), h('div', { class: 'sub' }, 'Puanlar maçtan maça taşınır. Rakip ve oyun kader tarafından seçilir.')),
      h('div', { class: 'br-status' }, h('div', {}, 'Puanın ', h('b', {}, String(me.stack))), h('div', { class: t.jokerUsed ? 'muted' : 'joker-ready' }, t.jokerUsed ? 'Joker hakkı kullanıldı' : 'Joker hakkı hazır')),
    ),
    cols,
    actions,
    muteButton(),
  );
}

function matchBox(m: BracketMatch, current: boolean, sim: boolean) {
  const row = (id: EntrantId) => {
    const t = T!;
    const isW = m.winner === id;
    const isL = !!m.winner && m.winner !== id;
    return h(
      'div',
      { class: 'br-row' + (isW ? ' win' : '') + (isL ? ' lose' : '') + (id === 'player' ? ' me' : '') },
      h('div', { class: 'br-face', html: portrait(id) }),
      h('div', { class: 'br-name' }, entrantName(id)),
      h('div', { class: 'br-stack' }, isW ? String(m.finalStack) : isL ? '0' : String(t.entrants[id].stack)),
    );
  };
  return h(
    'div',
    { class: 'br-match' + (current ? ' current' : '') + (sim ? ' sim' : '') + (m.a === 'player' || m.b === 'player' ? ' mine' : '') },
    row(m.a),
    row(m.b),
    h('div', { class: 'br-game' }, sim ? 'masada…' : GAMES[m.game].name),
  );
}

function confirmLeaveTournament() {
  const m = modal(
    h(
      'div',
      { class: 'confirm' },
      h('h3', {}, 'Turnuvadan çekil?'),
      h('p', { class: 'muted' }, 'Turnuva ilerlemen kaybolur.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => m.close() }, 'Vazgeç'), h('button', { class: 'btn danger', onclick: () => { m.close(); T = null; showCrossroads(); } }, 'Çekil')),
    ),
    { closable: true },
  );
}

function showVersus(m: BracketMatch) {
  const t = T!;
  const opp = (m.a === 'player' ? m.b : m.a) as GodId;
  const god = GODS[opp];
  const st = clearStage();
  const parts = new Particles(GOD_PARTICLES[opp], 50);
  activeParticles = parts;
  const fig = godFigure(opp);
  const rulesBox = h('div', { class: 'vs-rules' });
  const renderGame = () => {
    const gd = GAMES[m.game];
    rulesBox.innerHTML = `<div class="vs-game-kicker">Oynanacak oyun</div><div class="vs-game-name">${gd.name}</div><div class="vs-game-short">${gd.short}</div>`;
  };
  renderGame();
  const quote = h('div', { class: 'vs-quote' }, `“${pick(god.lines.intro)}”`);
  const jokerBtn = h('button', { class: 'btn' }, t.jokerUsed ? 'Joker kullanıldı' : 'Joker · oyunu değiştir');
  if (t.jokerUsed) jokerBtn.setAttribute('disabled', '');
  jokerBtn.onclick = () => {
    const md = jokerPicker(m.game, `${god.name} ile hangi oyunu oynamak istersin?`, (id) => {
      m.game = id;
      t.jokerUsed = true;
      md.close();
      sfx.magic();
      jokerBtn.textContent = 'Joker kullanıldı';
      jokerBtn.setAttribute('disabled', '');
      renderGame();
      stage.dataset.mood = 'angry';
      quote.textContent = `“${pick(['Kuralları sen mi koyuyorsun, hizmetçi?', 'Cüretkâr... Peki.', 'Benim masamda başka bir oyun mu?!'])}”`;
    });
  };
  const go = h('button', { class: 'btn primary big' }, 'Masaya otur');
  const stage = h('div', { class: 'god-stage', 'data-mood': 'smug', html: fig.body });
  const el = h(
    'div',
    { class: `screen vs-screen table-screen god-${opp}` },
    h('div', { class: 'scene', html: godScene(opp) }),
    h('div', { class: 'god-aura', style: { left: '600px' } }),
    stage,
    parts.canvas,
    h('div', { class: 'vignette' }),
    h(
      'div',
      { class: 'vs-left' },
      h('div', { class: 'vs-kicker' }, `Turnuva · ${t.roundName}`),
      h('div', { class: 'vs-vs' }, 'Karşında'),
      h('div', { class: 'vs-name' }, god.name),
      h('div', { class: 'vs-title' }, god.title),
      quote,
      h('div', { class: 'vs-stacks' }, 'Sen ', h('b', {}, String(t.entrants.player.stack)), ' · ', god.name, ' ', h('b', {}, String(t.entrants[opp].stack)), ' puan'),
      rulesBox,
      h('div', { class: 'vs-style' }, h('b', {}, 'Tarzı · '), god.style),
      h('div', { class: 'vs-actions' }, go, jokerBtn),
      h('div', { class: 'vs-note' }, 'Masaya oturduğunda tanrı sana oyununu anlatacak.'),
    ),
  );
  el.style.setProperty('--god', god.color);
  el.style.setProperty('--god-accent', god.accent);
  st.append(el);
  setTimeout(() => (stage.dataset.mood = 'neutral'), 2500);
  go.onclick = async () => {
    sfx.click();
    const r = await playMatch({
      god: opp,
      game: m.game,
      playerStack: t.entrants.player.stack,
      godStack: t.entrants[opp].stack,
      mode: 'tournament',
      roundLabel: `Turnuva · ${t.roundName}`,
      jokerAvailable: !t.jokerUsed,
      onJokerUsed: () => (t.jokerUsed = true),
    });
    if (!r) {
      T = null;
      showCrossroads();
      return;
    }
    const winner: EntrantId = r.winner === 'player' ? 'player' : opp;
    t.recordPlayed(m, winner, { player: r.stacks[0], [opp]: r.stacks[1] });
    await runOtherMatches();
  };
}

async function runOtherMatches() {
  const t = T!;
  const others = t.current.filter((m) => !m.winner);
  const sim = new Set(others);
  showBracket(sim);
  for (const m of others) {
    await sleep(600);
    const w = await simulateMatch({ ...t.entrants[m.a] }, { ...t.entrants[m.b] }, m.game);
    t.recordResult(m, w === 0 ? m.a : m.b);
    sim.delete(m);
    sfx.chips();
    if (T !== t) return;
    showBracket(sim);
  }
  await sleep(800);
  if (t.playerOut) {
    while (t.round < 3) {
      if (t.current.every((m) => m.winner)) {
        t.advance();
        if (t.round >= 3) break;
      }
      for (const m of t.current.filter((x) => !x.winner)) {
        const w = await simulateMatch({ ...t.entrants[m.a] }, { ...t.entrants[m.b] }, m.game);
        t.recordResult(m, w === 0 ? m.a : m.b);
      }
    }
    showEnding(false);
    return;
  }
  t.advance();
  if (t.round >= 3) {
    showEnding(true);
    return;
  }
  showBracket();
  const b = h('div', { class: 'banner info' }, h('span', {}, `${t.roundName} başlıyor`));
  stageEl().querySelector('.screen')?.append(b);
  setTimeout(() => b.remove(), 1600);
}

function showEnding(won: boolean) {
  const t = T!;
  if (won) {
    const p = progress();
    p.titles++;
    setProgress(p);
    sfx.bigWin();
  } else sfx.lose();
  const champ = t.champion;
  const lines = won
    ? ['Yedi tanrı, tek tek masadan kalktı.', 'Kuralları kendisi koymayan ama her kuralda kazanan tek oyuncu, hizmetçiydi.', "Taht artık Joker'in. Yeni Poker Tanrısı sensin."]
    : [`Turnuva sona erdi. Tahtın yeni sahibi: ${champ ? entrantName(champ) : '?'}.`, 'Hizmetçi bu sefer elendi... ama Joker her zaman destede kalır.'];
  screen(
    'ending-screen ' + (won ? 'won' : 'lost'),
    h(
      'div',
      { class: 'ending' },
      h('div', { class: 'ending-portrait', html: portrait(won ? 'player' : champ ?? 'player') }),
      h('h1', { class: 'game-title' }, won ? 'Poker Tanrısı' : 'Elendin'),
      h('div', { class: 'orn-line wide' }),
      ...lines.map((l, i) => {
        const p = h('p', { class: 'ending-line' }, l);
        p.style.animationDelay = `${0.6 + i * 1}s`;
        return p;
      }),
      h(
        'div',
        { class: 'row' },
        h('button', { class: 'text-link', onclick: showCrossroads }, 'Yol ayrımı'),
        h('span', { class: 'dot' }, '·'),
        h('button', { class: 'text-link big', onclick: startTournament }, 'Yeni turnuva ›'),
        h('span', { class: 'dot' }, '·'),
        h('button', { class: 'text-link', onclick: () => showBracket() }, 'Turnuva ağacı'),
      ),
    ),
  );
}

// ---------------------------------------------------------------------------
// Kılavuz → Hizmetçinin Defteri
// ---------------------------------------------------------------------------
export function showGuide() {
  showBook();
}

