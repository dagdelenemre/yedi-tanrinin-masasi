#!/bin/sh
# GitHub'da yeni commit varsa çeker ve oyun container'ını yeniden derler.
# Süren bir maç varsa güncellemeyi bir sonraki çalışmaya erteler.
# cron ile çalıştırılır (bkz. deploy/KURULUM.md).

# Betik git pull ile kendi üzerine yazılabileceği için tamamı bir fonksiyonda:
# sh önce fonksiyonun hepsini okur, sonra çalıştırır.
main() {
  set -eu
  PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  DIR="${YEDI_TANRI_DIR:-/opt/yedi-tanri}"
  cd "$DIR"

  # aynı anda iki kez çalışmasın
  exec 9>/tmp/yedi-tanri-guncelle.lock
  flock -n 9 || exit 0

  git fetch -q origin main
  LOCAL=$(git rev-parse HEAD)
  REMOTE=$(git rev-parse origin/main)
  [ "$LOCAL" = "$REMOTE" ] && exit 0

  # süren maç var mı? ("ok <oda> oda <maç> masa")
  PLAYING=$(docker exec yedi-tanri wget -qO- http://127.0.0.1:8787/health 2>/dev/null | awk '{print $4}' || true)
  if [ -n "$PLAYING" ] && [ "$PLAYING" != "0" ]; then
    echo "$(date '+%F %T') yeni sürüm var ama $PLAYING masada oyun sürüyor, sonra denenecek"
    exit 0
  fi

  echo "$(date '+%F %T') güncelleniyor: $(git log -1 --format='%h %s' origin/main)"
  git merge -q --ff-only origin/main
  docker compose up -d --build
  docker image prune -f >/dev/null 2>&1 || true
  echo "$(date '+%F %T') güncellendi"
}

main "$@"
