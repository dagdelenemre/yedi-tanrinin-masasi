# VPS'e kurulum (alt alan adı)

Sunucu tek bir Node.js süreci: hem oyunun sayfalarını sunar hem de `/ws` adresinde online odaları yönetir.

## A) VPS'te zaten Docker içinde Caddy varsa (önerilen)

80/443 portlarını bir Caddy container'ı tutuyorsa oyunu da container olarak çalıştır. Oyun dışarıya port açmaz; Caddy ona ortak Docker ağı üzerinden `yedi-tanri:8787` adresiyle ulaşır. HTTPS sertifikasını ve WebSocket'i Caddy kendisi halleder.

```bash
cd /opt/yedi-tanri && git pull && docker compose up -d --build
```

Caddy farklı bir ağdaysa `PROXY_NETWORK=ag_adi docker compose up -d --build` kullan (varsayılan ağ: `kanca_default`).

Caddyfile'a eklenecek blok:

```
yedi-tanrinin-masasi.dagdelean.dev {
	reverse_proxy yedi-tanri:8787
}
```

Ardından ayarı doğrula ve kesintisiz yeniden yükle:

```bash
docker exec CADDY_CONTAINER caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

```bash
docker exec CADDY_CONTAINER caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
```

Güncelleme için `cd /opt/yedi-tanri && git pull && docker compose up -d --build` yeterli.

---

## B) Sunucuda doğrudan nginx ile (Docker yoksa)

Aşağıda alt alan adı olarak `oyun.ornek.com` kullanıldı; kendininkiyle değiştir.

## 1. DNS

Alan adı panelinde `oyun` alt alan adı için VPS'in IP adresine bir **A kaydı** ekle.

## 2. VPS hazırlığı (Ubuntu/Debian)

Node.js 18 veya üstü gerekli:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx git
```

## 3. Kodu çek ve derle

```bash
sudo git clone https://github.com/dagdelenemre/yedi-tanrinin-masasi.git /opt/yedi-tanri
cd /opt/yedi-tanri
sudo npm ci
sudo npm run build
sudo chown -R www-data:www-data /opt/yedi-tanri
```

`npm run build` iki şey üretir:

- `dist/`: oyunun sayfaları
- `dist-server/server.cjs`: oyun sunucusu

## 4. Sunucuyu sürekli çalışır yap (systemd)

```bash
sudo cp /opt/yedi-tanri/deploy/yedi-tanri.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now yedi-tanri
sudo systemctl status yedi-tanri
```

Kontrol: `curl http://127.0.0.1:8787/health` komutu `ok 0 oda` döndürmeli.

## 5. nginx ile alt alan adı

```bash
sudo cp /opt/yedi-tanri/deploy/nginx-oyun.conf /etc/nginx/sites-available/yedi-tanri
sudo nano /etc/nginx/sites-available/yedi-tanri      # server_name satırını düzenle
sudo ln -s /etc/nginx/sites-available/yedi-tanri /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. HTTPS (ücretsiz sertifika)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d oyun.ornek.com
```

İstemci HTTPS'te otomatik olarak güvenli WebSocket'e (`wss://`) bağlanır; ek ayar gerekmez.

## Güncelleme

```bash
cd /opt/yedi-tanri
sudo git pull
sudo npm ci
sudo npm run build
sudo chown -R www-data:www-data /opt/yedi-tanri
sudo systemctl restart yedi-tanri
```

Not: Sunucu yeniden başlarken süren maçlar kapanır (odalar bellekte tutulur).

## Ayarlar (ortam değişkenleri)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `PORT` | 8787 | Sunucunun dinlediği port |
| `HOST` | 127.0.0.1 | nginx arkasında kalsın diye yalnızca yerel |
| `STATIC_DIR` | `../dist` | Oyun sayfalarının klasörü |

## Bilgisayarında online modu denemek

İki terminal aç:

```bash
npm run dev:server
```

```bash
npm run dev
```

Ardından `http://localhost:5173` adresini aç. İkinci oyuncu için başka bir tarayıcıda (ya da gizli pencerede) aynı adresi açıp oda numarasıyla katıl.
