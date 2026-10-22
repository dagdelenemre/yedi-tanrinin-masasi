import { GAMES, GODS, GOD_ORDER, GodId } from '../engine/gods';
import { portrait, sevenStar } from './art';
import { sfx } from './audio';
import { faceHTML } from './cardview';
import { h, stageEl } from './dom';
import { ICON, MEDAL } from './icons';

// ---------------------------------------------------------------------------
// Hizmetçinin Defteri — sayfaları çevrilen el kitabı
// ---------------------------------------------------------------------------

const SUITS: Record<string, number> = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 };
const RANKS: Record<string, number> = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13, A: 14 };

/** "A♠ K♠" gibi metinden küçük kart çizimleri */
function cards(spec: string, hl = ''): string {
  const marks = new Set(hl.split(' ').filter(Boolean));
  return `<span class="bk-cards">${spec
    .split(' ')
    .map((t) => {
      const suit = t.slice(-1);
      const rank = t.slice(0, -1);
      const red = suit === '♥' || suit === '♦';
      return `<span class="bk-card ${red ? 'red' : ''} ${marks.size && !marks.has(t) ? 'dim' : ''}">${faceHTML({ rank: RANKS[rank], suit: SUITS[suit] })}</span>`;
    })
    .join('')}</span>`;
}

function godPage(g: GodId, extra = ''): string {
  const god = GODS[g];
  const game = GAMES[g];
  return `
    <div class="pg-god">
      <div class="pg-portrait">${portrait(g)}</div>
      <div><div class="pg-kicker">${god.title}</div><h2 class="pg-title">${god.name}</h2><div class="pg-game">${game.name}</div></div>
    </div>
    <p class="pg-quote">“${game.pitch}”</p>
    <ol class="pg-rules">${game.rules.map((r) => `<li>${r}</li>`).join('')}</ol>
    <p class="pg-margin"><b>Notum:</b> ${game.tip} ${god.style}</p>
    ${extra}`;
}

const RANK_ROWS: [string, string, string, string][] = [
  ['Royal Floş', '10♠ J♠ Q♠ K♠ A♠', '', 'Aynı tipte 10\'dan As\'a. Ömründe birkaç kez görürsün.'],
  ['Sıralı Floş', '5♥ 6♥ 7♥ 8♥ 9♥', '', 'Aynı tipte beş sıralı kart.'],
  ['Kare', '9♣ 9♦ 9♥ 9♠ K♦', '9♣ 9♦ 9♥ 9♠', 'Aynı değerde dört kart.'],
  ['Ful', 'Q♠ Q♥ Q♦ 4♣ 4♠', '', 'Bir üçlü ve bir çift.'],
  ['Floş', '2♦ 7♦ 9♦ J♦ K♦', '', 'Aynı tipte beş kart, sıra fark etmez.'],
  ['Kent', '6♣ 7♦ 8♠ 9♥ 10♣', '', 'Beş sıralı kart, tip fark etmez.'],
  ['Üçlü', '8♠ 8♥ 8♦ K♣ 3♠', '8♠ 8♥ 8♦', 'Aynı değerde üç kart.'],
  ['Döper', 'J♣ J♦ 5♠ 5♥ A♣', 'J♣ J♦ 5♠ 5♥', 'İki ayrı çift.'],
  ['Per', '10♥ 10♠ A♦ 7♣ 2♠', '10♥ 10♠', 'Bir çift. Masada en sık görülen el.'],
  ['Yüksek Kart', 'A♠ J♦ 8♣ 5♥ 3♠', 'A♠', 'Hiçbiri yoksa en büyük kart konuşur.'],
];

function rankRows(from: number, to: number) {
  return RANK_ROWS.slice(from, to)
    .map(([n, c, hl, d], i) => `<div class="rk"><div class="rk-n"><span>${from + i + 1}</span>${n}</div>${cards(c, hl)}<div class="rk-d">${d}</div></div>`)
    .join('');
}

const medalLine = (icon: string, name: string, text: string) => `<div class="act-line"><span class="al-coin">${icon}</span><div><b>${name}.</b> ${text}</div></div>`;

const PAGES: string[] = [
  // 1 — kapak içi
  `<div class="pg-cover">
     <div class="pc-star">${sevenStar(110, '#7a5a1e')}</div>
     <div class="pc-title">Hizmetçinin<br>Defteri</div>
     <div class="pc-sub">yedi tanrının masasında tutulmuş notlar</div>
     <div class="pc-sign">— Joker</div>
   </div>`,
  `<h2 class="pg-title">Önsöz</h2>
   <p class="dropcap">Bu defteri, yedi tanrının masasında hizmet ederken tuttum. Kurallar değişir, tanrılar huysuzlanır, ama kartlar hep aynı dili konuşur.</p>
   <p>O dili burada, unutmayayım diye yazdım. İlk sayfalar her masada geçerli olan temel kuralları anlatıyor. Sonrasında her tanrının kendi oyununu, huyunu ve ona karşı öğrendiklerimi bulacaksın.</p>
   <p>Bir şeyi baştan söyleyeyim: tanrılar yenilmez değildir. Sabırlı ol, kartlarını say, ve kimse sana bakmıyorken bile blöf yapmaktan korkma.</p>
   <p class="pg-margin">Sayfaları kenardaki oklarla ya da klavyedeki ← → tuşlarıyla çevirebilirsin.</p>`,
  // 2 — masa
  `<div class="pg-num-title"><span>I</span><h2 class="pg-title">Masa</h2></div>
   <p class="dropcap">Her el aynı şekilde başlar. İki oyuncu ortaya zorunlu birer bahis koyar; bunlara <i>blind</i> denir, böylece ortada hep oynanacak bir pot olur.</p>
   <p>Sonra bana iki, rakibime iki kart verilir. Yere de beş ortak kart kapalı dizilir.</p>
   <div class="pg-figure">${cards('K♠ 9♥')}<span class="fig-cap">benim kartlarım</span></div>
   <p>Önce bir bahis turu olur. Ardından yerdeki kartlar <b>birer birer</b> açılır ve her açılan karttan sonra yeni bir bahis turu gelir.</p>
   <p>Beş kart da açıldığında kimse çekilmemişse eller açılır. Kendi iki kartım ve yerdeki beş karttan seçtiğim <b>en iyi beş kart</b> benim elimdir.</p>`,
  `<div class="pg-num-title"><span>II</span><h2 class="pg-title">Sıra sende</h2></div>
   <p>Sıra bana geldiğinde masadaki madalyonlardan birine dokunurum:</p>
   ${medalLine(MEDAL.check, 'Pas', 'Ortada görmem gereken bir bahis yoksa, hiçbir şey koymadan sırayı geçerim.')}
   ${medalLine(MEDAL.call, 'Gör', 'Rakip bahis yaptıysa, aynı miktarı koyup oyunda kalırım.')}
   ${medalLine(MEDAL.raise, 'Artır', 'Bahsi yükseltirim. Miktarı madalyonların üstündeki raydan seçerim.')}
   ${medalLine(MEDAL.allin, 'Hepsi', 'Bütün puanımı ortaya koyarım. Geri dönüşü yoktur.')}
   ${medalLine(MEDAL.fold, 'Çekil', 'Eli bırakırım. Ortaya koyduklarım rakibe gider.')}
   <p class="pg-margin">Kazanmanın iki yolu var: en iyi ele sahip olmak ya da rakibi çekilmeye zorlamak.</p>`,
  // 3 — eller
  `<div class="pg-num-title"><span>III</span><h2 class="pg-title">Ellerin sırası</h2></div>
   <p class="pg-small">Güçlüden zayıfa. Parlak kartlar eli oluşturanlardır.</p>
   ${rankRows(0, 5)}`,
  `<div class="pg-cont">devamı</div>
   ${rankRows(5, 10)}
   <p class="pg-margin">Eşitlikte, eli oluşturmayan en büyük kart (<i>kicker</i>) kazananı belirler.</p>`,
  // 4 — şans ve yardım
  `<div class="pg-num-title"><span>IV</span><h2 class="pg-title">Şans ve pot</h2></div>
   <p class="dropcap">Masada sol altta elimin adı ve yanında bir yüzde yazar. Bu, görünen kartlara göre rakibin bilinmeyen eline karşı binlerce kez denenmiş tahmini kazanma şansımdır.</p>
   <p>Rakip bahis yaptığında şunu sorarım: <i>ödeyeceğim puan, kazanacağım pota göre ne kadar?</i></p>
   <p class="pg-example">Pot 6, rakip 2 bastı. Görmek için 2 ödersem 10'luk potu kazanabilirim. 2 ÷ 10 = <b>%20</b>. Şansım %20'den büyükse görmek uzun vadede kârlıdır.</p>
   <p class="pg-margin">Bu hesabı masada <b>Notlar</b> bölümü benim yerime yapar.</p>`,
  `<div class="pg-num-title"><span>V</span><h2 class="pg-title">Masadaki yardımcılar</h2></div>
   <div class="help-line"><span class="al-coin">${ICON.book}</span><div><b>Notlar</b> · K tuşu. Elimin adı, beklediğim kartlar, kazanma şansım, pot hesabı ve masa kaydı.</div></div>
   <div class="help-line"><span class="al-coin">${ICON.scroll}</span><div><b>Kurallar.</b> Tanrının oyununu bana yeniden anlatır.</div></div>
   <div class="help-line"><span class="al-coin">${ICON.hourglass}</span><div><b>Tempo.</b> Ağır, orta ya da çabuk. Acele etmeye gerek yok.</div></div>
   <div class="help-line"><span class="al-coin">${ICON.joker}</span><div><b>Joker.</b> Yalnızca turnuvada. Bir kez, masadaki oyunu değiştirme hakkım.</div></div>
   <p class="pg-margin">Klavye: F çekil · C pas ya da gör · R artır · boşluk sonraki el.</p>`,
  // 5 — tanrılar
  godPage('nadir'),
  `<div class="pg-num-title"><span>✦</span><h2 class="pg-title">Ters Taç'ın sırası</h2></div>
   <p class="pg-small">Nadir'in masasında küçük olan kazanır. Kent ve floş sayılmaz, As en küçük karttır.</p>
   <div class="rk"><div class="rk-n"><span>1</span>Tekerlek</div>${cards('5♣ 4♦ 3♥ 2♠ A♣')}<div class="rk-d">Mümkün olan en iyi el.</div></div>
   <div class="rk"><div class="rk-n"><span>2</span>6 Düşük</div>${cards('6♠ 4♥ 3♦ 2♣ A♥')}<div class="rk-d">En büyük kartı 6.</div></div>
   <div class="rk"><div class="rk-n"><span>3</span>8 Düşük</div>${cards('8♦ 6♣ 5♠ 3♥ A♠')}<div class="rk-d">En büyük kart ne kadar küçükse o kadar iyi.</div></div>
   <div class="rk"><div class="rk-n"><span>4</span>Per</div>${cards('3♠ 3♥ 5♦ 7♣ 9♠', '3♠ 3♥')}<div class="rk-d">Çift içeren her el temiz elden kötüdür.</div></div>`,
  godPage('kesh'),
  godPage('veyla'),
  godPage('kronvel'),
  godPage('oris'),
  godPage('barbaz'),
  godPage('prisma'),
  // son
  `<div class="pg-num-title"><span>VI</span><h2 class="pg-title">Turnuva ve Joker</h2></div>
   <p class="dropcap">Sınavlardan sonra tanrılar beni kendi turnuvalarına aldı. Sekiz kişiyiz: yedi tanrı ve ben. Rakibimi de oynanacak oyunu da kader seçer.</p>
   <p>Puanlar maçtan maça taşınır. Kim iflas ederse elenir. Üç maç kazanan tahta oturur.</p>
   <p>Kendi oyunum olmadığı için bana bir hak tanıdılar: turnuva boyunca <b>bir kez</b>, masadaki oyunu istediğim oyunla değiştirebilirim. Hangi tanrıya karşı, hangi anda kullanacağımı iyi seçmeliyim.</p>`,
  `<div class="pg-end">
     <p>Destede ne renge ne de tanrıya ait olan tek bir kart vardır.</p>
     <p class="pg-end-big">Joker.</p>
     <p>Her kuralda oynayabilen, hiçbir kurala ait olmayan.</p>
     <div class="pc-star small">${sevenStar(60, '#7a5a1e')}</div>
   </div>`,
];

const MARKS: [string, number][] = [
  ['Masa', 2],
  ['Eller', 4],
  ['Tanrılar', 8],
  ['Turnuva', 16],
];

export function showBook(startPage = 0) {
  let spread = Math.floor(startPage / 2);
  const total = Math.ceil(PAGES.length / 2);
  const left = h('div', { class: 'page left' });
  const right = h('div', { class: 'page right' });
  const prev = h('button', { class: 'pg-arrow prev', title: 'Önceki sayfa' }, '‹');
  const next = h('button', { class: 'pg-arrow next', title: 'Sonraki sayfa' }, '›');
  const marks = h('div', { class: 'ribbons' });
  const render = (dir = 0) => {
    const li = spread * 2;
    left.innerHTML = `<div class="pg-in">${PAGES[li] ?? ''}</div><div class="pg-no">${li + 1}</div>`;
    right.innerHTML = `<div class="pg-in">${PAGES[li + 1] ?? ''}</div><div class="pg-no">${li + 2}</div>`;
    prev.toggleAttribute('disabled', spread === 0);
    next.toggleAttribute('disabled', spread >= total - 1);
    marks.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', Math.floor(MARKS[i][1] / 2) <= spread && (i === MARKS.length - 1 || Math.floor(MARKS[i + 1][1] / 2) > spread)));
    if (dir) {
      book.classList.remove('turn-l', 'turn-r');
      void book.offsetWidth;
      book.classList.add(dir > 0 ? 'turn-r' : 'turn-l');
    }
  };
  const go = (d: number) => {
    const n = Math.max(0, Math.min(total - 1, spread + d));
    if (n === spread) return;
    spread = n;
    sfx.flip();
    render(d);
  };
  prev.onclick = () => go(-1);
  next.onclick = () => go(1);
  MARKS.forEach(([n, p]) => {
    const b = h('button', { class: 'ribbon' }, n);
    b.onclick = () => {
      const d = Math.floor(p / 2) - spread;
      if (d) {
        spread = Math.floor(p / 2);
        sfx.flip();
        render(d);
      }
    };
    marks.append(b);
  });
  const close = h('button', { class: 'book-close', html: `${ICON.close}<span>Defteri kapat</span>` });
  const book = h('div', { class: 'book' }, marks, left, right, h('div', { class: 'spine' }), prev, next);
  const wrap = h('div', { class: 'book-wrap' }, book, close);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'Escape') shut();
  };
  const shut = () => {
    window.removeEventListener('keydown', onKey);
    wrap.classList.add('out');
    setTimeout(() => wrap.remove(), 400);
  };
  close.onclick = shut;
  wrap.addEventListener('mousedown', (e) => {
    if (e.target === wrap) shut();
  });
  window.addEventListener('keydown', onKey);
  stageEl().append(wrap);
  sfx.flip();
  render();
  void GOD_ORDER;
}
