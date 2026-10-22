# Yedi Tanrının Masası

Poker tanrılarının taht kavgasını konu alan, tarayıcıda çalışan 2D kart oyunu (Texas Hold'em tabanlı).
Tek oyunculu bölümler (Sınav, Turnuva) ve 2-4 kişilik online masa içerir.

## Çalıştırma (geliştirme)

```bash
npm install
npm run dev
```

`http://localhost:5173` adresini aç. Belirli bir tanrının masasına doğrudan oturmak için adrese `?mac=kesh` gibi bir ek koyabilirsin.

Online modu denemek için ikinci bir terminalde oyun sunucusunu da başlat:

```bash
npm run dev:server
```

## Yayınlama

```bash
npm run build
```

Komut `dist/` (oyun) ve `dist-server/server.cjs` (online sunucu) üretir. VPS kurulumu için: [deploy/KURULUM.md](deploy/KURULUM.md)

## Yapı

- `src/engine/`: oyun motoru (arayüzden bağımsız; sunucu da kullanır)
  - `hand.ts`: 1'e 1 el motoru (tek oyunculu mod)
  - `multi.ts`: 2-4 kişilik el motoru (online): yan potlar ve çok oyunculu kurallar
  - `ai.ts`, `aimulti.ts`: tanrıların kişiliğe göre oynayan yapay zekâsı
  - `evaluator.ts`, `equity.ts`: el değerlendirme ve kazanma şansı
  - `gods.ts`: tanrılar, oyunlar, kurallar, tanrı anlatımları
- `src/net/`: online mod mesajları (`protocol.ts`) ve bağlantı (`client.ts`)
- `server/server.ts`: odalar, maç döngüsü, sıra süresi, kişiye özel görünüm
- `src/ui/`: ekranlar, masa (`table.ts`), online masa (`online.ts`), defter (`book.ts`), figürler, sahneler
