// ---------------------------------------------------------------------------
// Mobil: tam ekran / ana ekrana ekle teklifi ve ekranın kapanmasını engelleme
// ---------------------------------------------------------------------------

const nav = navigator as Navigator & { standalone?: boolean; wakeLock?: { request(t: 'screen'): Promise<WakeLockSentinelLike> } };
interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(t: 'release', fn: () => void): void;
}

export const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function isStandalone() {
  return matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches || !!nav.standalone;
}

function fsElement(): Element | null {
  return document.fullscreenElement ?? (document as any).webkitFullscreenElement ?? null;
}

function canFullscreen() {
  const el = document.documentElement as any;
  return !!(el.requestFullscreen || el.webkitRequestFullscreen) && (document.fullscreenEnabled ?? (document as any).webkitFullscreenEnabled ?? false);
}

async function enterFullscreen() {
  const el = document.documentElement as any;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch {}
  try {
    await (screen.orientation as any)?.lock?.('landscape');
  } catch {}
}

function landscape() {
  return innerWidth > innerHeight;
}

// --- tam ekran teklifi -----------------------------------------------------
let declined = false; // bu oturumda "böyle devam et" dendi mi
let prompt: HTMLElement | null = null;

function storeGet(k: string) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function storeSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}

function hidePrompt() {
  prompt?.remove();
  prompt = null;
}

function showPrompt() {
  if (prompt || !isTouch || !landscape() || isStandalone() || fsElement()) return;
  if (canFullscreen()) {
    if (declined) return;
    prompt = document.createElement('div');
    prompt.id = 'fs-prompt';
    prompt.innerHTML = `<div class="fs-card"><div class="fs-title">Tam ekran oyna</div><div class="fs-text">Adres çubuğu ve sekmeler kalkar, masa bütün ekranı kaplar.</div><button class="fs-go">Tam ekrana geç</button><button class="fs-no">Böyle devam et</button></div>`;
    prompt.querySelector('.fs-go')!.addEventListener('click', async () => {
      hidePrompt();
      await enterFullscreen();
    });
    prompt.querySelector('.fs-no')!.addEventListener('click', () => {
      declined = true;
      hidePrompt();
    });
    document.body.append(prompt);
  } else if (isIOS && !storeGet('ytm-ios-hint')) {
    // iPhone Safari sitelerin araç çubuklarını kapatmasına izin vermez: tek yol ana ekrana eklemek
    prompt = document.createElement('div');
    prompt.id = 'fs-prompt';
    prompt.innerHTML = `<div class="fs-card"><div class="fs-title">Tam ekran için</div><div class="fs-text">Safari'de alttaki <b>Paylaş</b> simgesine dokun, ardından <b>Ana Ekrana Ekle</b>'yi seç. Oyunu ana ekrandaki simgesinden açınca adres çubuğu olmadan, tam ekran açılır.</div><button class="fs-go">Anladım</button></div>`;
    prompt.querySelector('.fs-go')!.addEventListener('click', () => {
      storeSet('ytm-ios-hint', '1');
      hidePrompt();
    });
    document.body.append(prompt);
  }
}

export function initMobile(onResize: () => void) {
  const check = () => {
    onResize();
    if (!landscape() || fsElement() || isStandalone()) hidePrompt();
    else setTimeout(showPrompt, 400);
  };
  addEventListener('resize', check);
  addEventListener('orientationchange', () => setTimeout(check, 250));
  document.addEventListener('fullscreenchange', check);
  document.addEventListener('webkitfullscreenchange', check);
  visualViewport?.addEventListener('resize', onResize);
  // iOS: ilk dokunuşta bir kez daha dene (yön yeni değişmiş olabilir)
  addEventListener('touchend', () => !prompt && landscape() && showPrompt(), { once: true });
  check();
}

// --- ekran kapanmasın (Wake Lock) ------------------------------------------
let wanted = false;
let lock: WakeLockSentinelLike | null = null;

async function acquire() {
  if (!wanted || lock || document.hidden || !nav.wakeLock) return;
  try {
    lock = await nav.wakeLock.request('screen');
    lock.addEventListener('release', () => (lock = null));
  } catch {
    lock = null;
  }
}

/** Masadayken ekranın kendiliğinden kapanmasını engeller */
export function keepAwake(on: boolean) {
  wanted = on;
  if (on) acquire();
  else {
    lock?.release().catch(() => {});
    lock = null;
  }
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) acquire();
});
// bazı tarayıcılar kilidi yalnızca kullanıcı etkileşiminden sonra verir
addEventListener('pointerdown', () => acquire(), { passive: true });
