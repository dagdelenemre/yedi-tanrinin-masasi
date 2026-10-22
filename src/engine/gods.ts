export type GameId = 'klasik' | 'nadir' | 'kesh' | 'veyla' | 'kronvel' | 'oris' | 'barbaz' | 'prisma';
export type GodId = Exclude<GameId, 'klasik'>;

export interface Personality {
  /** 0..1 — bahis/yükseltme isteği */
  aggression: number;
  /** 0..1 — zayıf elleri bırakma eğilimi */
  tightness: number;
  /** 0..1 — blöf sıklığı */
  bluff: number;
  /** tahmine eklenen rastgelelik */
  variance: number;
  /** kendine güven (kazanma şansına eklenir) */
  confidence: number;
  /** güçlü elde pusu kurma (check/call ile bekleme) olasılığı */
  slowplay: number;
  /** yetenek kullanma eşiği (küçük = daha kolay kullanır) */
  abilityEdge: number;
}

export interface GodDef {
  id: GodId;
  name: string;
  title: string;
  gameName: string;
  color: string;
  accent: string;
  bio: string;
  style: string; // oynayış tarzı (oyuncuya gösterilir)
  p: Personality;
  lines: {
    intro: string[];
    raise: string[];
    allin: string[];
    fold: string[];
    win: string[];
    lose: string[];
    ability: string[];
    matchWin: string[];
    matchLose: string[];
  };
}

export interface GameDef {
  id: GameId;
  name: string;
  short: string;
  /** tanrının kendi ağzından oyun tanıtımı */
  pitch: string;
  /** hizmetçinin notu: kısa strateji ipucu */
  tip: string;
  rules: string[];
  abilityName?: string;
  abilityHint?: string;
  low?: boolean;
}

export const GAMES: Record<GameId, GameDef> = {
  klasik: {
    id: 'klasik',
    name: 'Klasik Hold\'em',
    short: 'Tanrıların hepsinin üzerine kurduğu temel oyun.',
    pitch: 'Tanrıların hepsinin üzerine kurduğu, süssüz oyun. Hile yok, sihir yok; yalnızca kartlar, sabır ve cesaret.',
    tip: 'İki kartın da yüksekse ya da çiftse bahisten korkma. Zayıfsan pas geçmek bedava.',
    rules: [
      'Herkese 2 kart, yere 5 kapalı ortak kart dağıtılır. Yer kartları birer birer açılır.',
      'Kendi 2 kartın ve yerdeki 5 kart ile en iyi 5 kartlık eli kurarsın.',
      'Kartlar açılmadan önce ve açılan her karttan sonra bahis turu olur: Pas, Gör, Artır veya Çekil.',
      'Rakip çekilirse ya da elin daha iyiyse ortadaki pot senin.',
    ],
  },
  nadir: {
    id: 'nadir',
    name: 'Ters Taç',
    short: 'Düşük el kazanır.',
    pitch: 'Dünyada büyük olan kazanır, öyle mi? Benim sarayımda değil. Burada taç baş aşağı durur: en DÜŞÜK el potu alır. As en küçük karttır ve A-2-3-4-5 mükemmelliğin ta kendisidir. Çiftler mi? Onlar köylülere layık.',
    tip: 'Küçük kartlar altın değerinde. Elindeki büyük bir kart (Papaz, Kız...) ya da bir çift seni batırır.',
    low: true,
    rules: [
      'Her şey tersine döner: EN DÜŞÜK el potu alır.',
      'As en küçük karttır (1 sayılır). Kent ve floş sayılmaz, zarar da vermez.',
      'En iyi el A-2-3-4-5 ("Tekerlek"). En büyük kartın küçük olması iyidir.',
      'Çift, üçlü gibi eşleşmeler elini kötüleştirir.',
    ],
  },
  kesh: {
    id: 'kesh',
    name: 'Kapalı Takas',
    short: 'El başında, hiçbir kart görünmeden kör takas yapılır.',
    pitch: "Her şeyin bir fiyatı var, hizmetçi, kartların bile. El başlarken hiçbir kart görünmez, seninki bile. İçinden bir ses 'bu kart kötü' derse, onu yerdeki kapalı kartlardan biriyle değiştir. Ama ikimiz aynı kartı istersek, elimizde tuttuğumuz kartı açarız: büyük olan alır, küçük olan desteye razı olur.",
    tip: 'Takas tamamen içgüdü. Bir kart değiştirmek eli ne bozar ne düzeltir; ama Kesh aynı kartı seçerse elindeki kart açığa çıkar.',
    abilityName: 'Kör Takas',
    abilityHint: 'Kapalı kartlarından birini, yerdeki kapalı kartlardan biriyle değiştir.',
    rules: [
      'Her elin başında bütün kartlar kapalıdır, kendi kartların bile.',
      'İki oyuncu da gizlice, içgüdüyle seçer: elindeki bir kart ile yerdeki bir kapalı kart yer değiştirir (isteğe bağlı).',
      'Rakibin kartını alamazsın, sadece yerdekilerle değişebilirsin.',
      'İki oyuncu AYNI yer kartını seçerse: elinde tuttuğun diğer kart herkese açılır. Değeri büyük olan yer kartını alır, küçük olan destenin en üstündeki kartı alır. Eşitlikte zar atılır.',
      'Takastan sonra kartlarına bakarsın ve el normal oynanır.',
    ],
  },
  veyla: {
    id: 'veyla',
    name: 'Ayna',
    short: 'Rakibin elini görürsün, kendi elini göremezsin.',
    pitch: 'Bana bak. Kendini görüyor musun? Hayır. Benim masamda kendi kartlarını göremezsin; benimkiler ise önünde apaçık durur. Ben de seninkileri görürüm. Her elde bir kez, yerdeki bir kartı yakabilirsin; yerine destenin üstündeki kart gelir.',
    tip: "Kendi elini bilmediğin için Veyla'nın kartlarına bak. Onun eli güçlüyse dikkatli ol, zayıfsa bastır. Ona yarayan kartı yak.",
    abilityName: 'Yak',
    abilityHint: 'Yerdeki bir kartı yak: yerine destenin en üstündeki kart gelir.',
    rules: [
      'Kendi kartlarını göremezsin ama rakibin kartlarını görürsün. Rakip de seninkileri görür.',
      'Yer kartları herkese açıktır.',
      'Her elde bir kez, yerdeki bir kartı yakabilirsin: o kart çıkar, yerine destenin en üstündeki kart gelir.',
      'Rakibe yarayan kartı yakmak çoğu zaman en iyi hamledir.',
    ],
  },
  kronvel: {
    id: 'kronvel',
    name: 'Pişmanlık',
    short: 'Son bahsinin yarısını geri alabilirsin.',
    pitch: 'Acele etme evlat. Benim masamda pişmanlığın bir bedeli vardır, ama yarısı kadar. Her elde bir kez, yeni bir kart açıldıktan sonra son bahsinin yarısını geri alabilirsin. Yalnızca seninkini; benim koyduğum potta kalır.',
    tip: 'Büyük bir bahis yapıp beklediğin kart gelmediyse geri alma hakkını kullan. Kronvel temkinlidir, kolay çekilir.',
    abilityName: 'Geri Al',
    abilityHint: 'Yeni kart açıldıysa, önceki son bahsinin yarısını geri al.',
    rules: [
      'Normal Hold\'em gibi oynanır.',
      'Her elde bir kez, yeni bir kart açıldıktan sonra bir önceki son bahsinin YARISINI geri alabilirsin.',
      'Rakibin koyduğu puanlar iade edilmez, potta kalır.',
      'Beklediğin kart gelmediyse zararını azaltmak için kullan.',
    ],
  },
  oris: {
    id: 'oris',
    name: 'Kehanet',
    short: 'Yere açılacak sıradaki kartı görebilirsin.',
    pitch: 'Ben geleceği görürüm, hizmetçi. Bu masada sen de görebilirsin, ama yalnızca bir kez. Her elde bir kez, yere açılacak sıradaki kartı gizlice görebilirsin. Kullandığını ben bilmem, kullandığımı sen bilmezsin.',
    tip: 'Kehanet, son kartlardan önce en değerlidir. Bekleyen bir elin varsa sıradaki kartın geleceğini görmek kararını kolaylaştırır.',
    abilityName: 'Kehanet',
    abilityHint: 'Yerdeki kapalı kartlardan sıradaki açılacak olanı gizlice gör.',
    rules: [
      'Normal Hold\'em gibi oynanır.',
      'Her elde bir kez, yere açılacak SIRADAKİ kapalı kartı gizlice görebilirsin.',
      'Rakip kehaneti kullandığını görmez (o da kullanabilir, sen de bilemezsin).',
      'Hak her yeni dağıtımda yenilenir.',
    ],
  },
  barbaz: {
    id: 'barbaz',
    name: 'Zar-ı Talih',
    short: 'Her elin başında zar atılır, kazanan rakibin puanının %10\'unu çalar.',
    pitch: 'HAHA! Benim masamda her el zarla başlar! Yüksek atan, rakibinin puanının onda birini cebe indirir. Eşit mi geldi? Bir daha at! Sonrası bildiğin gibi... ya da bildiğini sandığın gibi.',
    tip: 'Zar şanstır, önemli olan sonrasında sakin kalmak. Barbaz çok blöf yapar; güçlü elle onu bekle.',
    rules: [
      'Her el başında iki oyuncu da zorunlu olarak zar atar.',
      'Yüksek atan, rakibinin puanının %10\'unu çalar (en yakın tam sayıya yuvarlanır).',
      'Zarlar eşit gelirse tekrar atılır.',
      'Sonra el normal Hold\'em olarak oynanır.',
    ],
  },
  prisma: {
    id: 'prisma',
    name: 'Simya',
    short: 'Elindeki kartların rengini çevirebilirsin: kırmızı siyaha, siyah kırmızıya.',
    pitch: 'Gerçek, ışığın nereden düştüğüne bağlıdır. Her elde bir kez, elindeki kartların rengini çevirebilirsin: kupa maçaya, maça kupaya, karo sineğe, sinek karoya döner. Sayılar aynı kalır; değişen yalnızca kaderin rengidir.',
    tip: 'Yerdeki kartların çoğu aynı tipse, rengi çevirerek floşa yaklaşabilirsin. Çevirmeden önce şansını karşılaştır.',
    abilityName: 'Renk Çevir',
    abilityHint: 'Elindeki iki kartın rengi çevrilir: ♥↔♠, ♦↔♣. Sayılar aynı kalır.',
    rules: [
      'Normal Hold\'em gibi oynanır.',
      'Her elde bir kez, elindeki kartların rengini çevirebilirsin: kırmızı siyah, siyah kırmızı olur.',
      'Her kart eş tipine geçer: Kupa ↔ Maça, Karo ↔ Sinek. Değeri değişmez.',
      'Çevirme iki kartına birden uygulanır. Aynı karttan iki tane oluşabilir: bu Prisma\'nın sihri!',
    ],
  },
};

export const GODS: Record<GodId, GodDef> = {
  nadir: {
    id: 'nadir',
    name: 'Nadir',
    title: 'Ters Kral',
    gameName: GAMES.nadir.name,
    color: '#6b3fa0',
    accent: '#f2c14e',
    bio: 'Tacı baş aşağı duran kibirli kral. Alçakgönüllülüğü över ama kendinden başkasını beğenmez.',
    style: 'Kendine fazla güvenir, sık sık bahsi büyütür.',
    p: { aggression: 0.62, tightness: 0.45, bluff: 0.18, variance: 0.06, confidence: 0.06, slowplay: 0.1, abilityEdge: 0.03 },
    lines: {
      intro: ['Diz çök, hizmetçi. Ya da diz çökme... ters dünyada fark etmez.', 'En aşağıda olan, en yukarıdadır.'],
      raise: ['Tacım bunu emrediyor.', 'Bir kralı görebilir misin?', 'Fiyat yükseldi.'],
      allin: ['Hepsi. Bir kral pazarlık etmez.', 'Tahtım ortada!'],
      fold: ['Bu el bana layık değil.', 'Kral, savaşını seçer.'],
      win: ['Elbette.', 'Ters dünyanın kralı benim.'],
      lose: ['Bu... bir hataydı. Senin hatan.', 'Saygısızlık!'],
      ability: ['Dünya ters dönsün.'],
      matchWin: ['Yerine dön, hizmetçi.'],
      matchLose: ['Tacım... düşmedi. Sadece eğildi.'],
    },
  },
  kesh: {
    id: 'kesh',
    name: 'Kesh',
    title: 'Pazarlık Tanrısı',
    gameName: GAMES.kesh.name,
    color: '#1f7a74',
    accent: '#e8b84a',
    bio: 'Çok kollu tüccar. Gözlerinin yerinde sikkeler parlar, her şeyin bir fiyatı vardır.',
    style: 'Hesapçı ve değer odaklı. Kötü fiyata gelmez, iyi fiyatı kaçırmaz.',
    p: { aggression: 0.5, tightness: 0.58, bluff: 0.1, variance: 0.03, confidence: 0, slowplay: 0.15, abilityEdge: 0.01 },
    lines: {
      intro: ['Hoş geldin müşterim. Bugün neyi takas edelim?', 'Her şeyin bir fiyatı var. Seninki ne?'],
      raise: ['Fiyat bu.', 'Pazarlık payı yok.', 'Biraz daha koyalım mı?'],
      allin: ['Bütün sermayem masada!', 'Büyük alım, büyük satım.'],
      fold: ['Kârlı değil.', 'Bu mal bana pahalı.'],
      win: ['Kârlı bir alışveriş.', 'Teşekkürler, yine beklerim.'],
      lose: ['Zarar yazdım...', 'Hmm, kötü yatırım.'],
      ability: ['Takas zamanı!', 'Benimkini al, seninkini ver...'],
      matchWin: ['Hesabını kapattım.'],
      matchLose: ['İflas... nasıl bir kelime bu?'],
    },
  },
  veyla: {
    id: 'veyla',
    name: 'Veyla',
    title: 'Ayna Tanrıçası',
    gameName: GAMES.veyla.name,
    color: '#5a7fa8',
    accent: '#d9e7f5',
    bio: 'Gözleri bağlı, yüzü ayna. Kendini göremez ama karşısındakini olduğu gibi yansıtır.',
    style: 'Pusucu. Güçlü elde sessiz bekler, sonra tuzağı kapatır.',
    p: { aggression: 0.42, tightness: 0.5, bluff: 0.16, variance: 0.04, confidence: 0, slowplay: 0.5, abilityEdge: 0.02 },
    lines: {
      intro: ['Bana bak. Kendini görüyor musun?', 'Ayna yalan söylemez. Sen söylersin.'],
      raise: ['Yansıman titriyor.', 'Bunu bekliyordum.'],
      allin: ['Aynanın içine gel.', 'Şimdi kırılma zamanı.'],
      fold: ['Gördüğüm yeterli.', 'Bu yansıma bana ait değil.'],
      win: ['Ayna her zaman kazanır.', 'Kendi gözlerinle göremediğin şey buydu.'],
      lose: ['Çatlak...', 'Yansımam bulandı.'],
      ability: ['Bu kart yansımaz.', 'Yansın.'],
      matchWin: ['Artık sadece bir yansımasın.'],
      matchLose: ['Ayna kırıldı... ama parçalarda hep sen varsın.'],
    },
  },
  kronvel: {
    id: 'kronvel',
    name: 'Kronvel',
    title: 'Pişmanlık Tanrısı',
    gameName: GAMES.kronvel.name,
    color: '#8a6a3c',
    accent: '#f0d9a6',
    bio: 'Gövdesi kum saati olan yaşlı tanrı. Kumu hep yarıda kalır, her kararından biraz pişmandır.',
    style: 'Temkinli ve sabırlı. Kolay bırakır, nadiren saldırır.',
    p: { aggression: 0.26, tightness: 0.7, bluff: 0.05, variance: 0.03, confidence: -0.02, slowplay: 0.2, abilityEdge: 0.0 },
    lines: {
      intro: ['Zaman... her şeyi geri getirir. Neredeyse her şeyi.', 'Acele etme evlat. Pişman olursun.'],
      raise: ['Bunu... yapmalı mıyım? Evet.', 'Kum akıyor.'],
      allin: ['Bu sefer geri dönüş yok.', 'Bütün zamanım bu ele.'],
      fold: ['Pişman olmaktansa...', 'Bekleyelim. Hep beklerim.'],
      win: ['Sabır kazandı.', 'Zaman benden yana.'],
      lose: ['Keşke...', 'Bunu da pişmanlıklarıma ekliyorum.'],
      ability: ['Zamanı biraz geri saralım.', 'Yarısı kadar pişmanım.'],
      matchWin: ['Kum bitti, evlat.'],
      matchLose: ['En büyük pişmanlığım: seni hafife almak.'],
    },
  },
  oris: {
    id: 'oris',
    name: 'Oris',
    title: 'Kehanet Tanrısı',
    gameName: GAMES.oris.name,
    color: '#1c3f7a',
    accent: '#5ee6ff',
    bio: 'Üçüncü gözü olan kâhin. Geleceği bildiğine inanır, şaşırmaktan nefret eder.',
    style: 'Soğukkanlı ve hesapçı. Az hata yapar, duygusuz oynar.',
    p: { aggression: 0.55, tightness: 0.5, bluff: 0.12, variance: 0.015, confidence: 0, slowplay: 0.2, abilityEdge: 0.0 },
    lines: {
      intro: ['Bu maçı çoktan gördüm.', 'Kartlar bana önceden fısıldar.'],
      raise: ['Yazgı böyle.', 'Gördüğüm şey bu.'],
      allin: ['Gelecek açık. Hepsi.', 'Kehanet tamamlanıyor.'],
      fold: ['Bu yol karanlık.', 'Gelecek burada bitmiyor.'],
      win: ['Öngörülebilirdi.', 'Söylemiştim.'],
      lose: ['Bu... görünmüyordu.', 'Gelecek bulanık.'],
      ability: ['Üçüncü göz açılıyor...'],
      matchWin: ['Yazgın buraya kadarmış.'],
      matchLose: ['Bunu... görememiştim.'],
    },
  },
  barbaz: {
    id: 'barbaz',
    name: 'Barbaz',
    title: 'Talih Tanrısı',
    gameName: GAMES.barbaz.name,
    color: '#a8321e',
    accent: '#ffb347',
    bio: 'Dişleri zardan kahkahacı. Kaos onun evi, talih onun oyuncağı.',
    style: 'Çılgın ve saldırgan. Çok blöf yapar, sık sık her şeyini ortaya koyar.',
    p: { aggression: 0.86, tightness: 0.22, bluff: 0.38, variance: 0.12, confidence: 0.03, slowplay: 0.05, abilityEdge: 0.03 },
    lines: {
      intro: ['HAHAHA! Zarlar konuşsun!', 'Şans mı? Şans benim adım!'],
      raise: ['Daha! Daha!', 'Hadi bakalım!', 'Isınıyoruz!'],
      allin: ['HEPSİ! HAHAHA!', 'Talih cesurları sever!'],
      fold: ['Sıkıcı. Geç.', 'Bu el uyuyor.'],
      win: ['HAHAHA!', 'Talih yine benimle!'],
      lose: ['Grr! Zarlar tersti!', 'Bir dahaki sefere!'],
      ability: ['Zarlar dönüyor!'],
      matchWin: ['Kaos kazanır! HAHAHA!'],
      matchLose: ['Ha! İyi attın, hizmetçi. İyi attın.'],
    },
  },
  prisma: {
    id: 'prisma',
    name: 'Prisma',
    title: 'Simya Tanrıçası',
    gameName: GAMES.prisma.name,
    color: '#b0408f',
    accent: '#8ff7e0',
    bio: 'Kristal gövdeli simyager. Işığı kırar, gerçeği istediği renge boyar.',
    style: 'Tahmin edilemez. Bahis büyüklükleri ve tarzı sürekli değişir.',
    p: { aggression: 0.6, tightness: 0.4, bluff: 0.24, variance: 0.1, confidence: 0.02, slowplay: 0.25, abilityEdge: 0.02 },
    lines: {
      intro: ['Hangi renk olmak istersin, hizmetçi?', 'Gerçek, sadece bir kırılmadır.'],
      raise: ['Renk değişiyor.', 'Işığa bak.'],
      allin: ['Bütün spektrum!', 'Gökkuşağının sonu burası.'],
      fold: ['Bu renk bana yakışmaz.', 'Soluk bir el.'],
      win: ['Ne güzel bir parıltı.', 'Simya tamamlandı.'],
      lose: ['Rengim söndü...', 'Bulanık bir dönüşüm.'],
      ability: ['Dönüş!', 'Yeni bir renk...'],
      matchWin: ['Seni griye boyadım.'],
      matchLose: ['Sen... hangi renksin ki?'],
    },
  },
};

export const GOD_ORDER: GodId[] = ['nadir', 'kesh', 'veyla', 'kronvel', 'oris', 'barbaz', 'prisma'];

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
