import { ClientMsg, ServerMsg } from './protocol';

// ---------------------------------------------------------------------------
// WebSocket bağlantısı: otomatik yeniden bağlanma + kalıcı oyuncu kimliği
// ---------------------------------------------------------------------------

function getToken(): string {
  try {
    let t = localStorage.getItem('ytm-token');
    if (!t) {
      t = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^\w-]/g, '');
      localStorage.setItem('ytm-token', t);
    }
    return t;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2, 12);
  }
}

export type NetStatus = 'connecting' | 'open' | 'closed';

class NetClient {
  private ws: WebSocket | null = null;
  private queue: ClientMsg[] = [];
  private listeners = new Set<(m: ServerMsg) => void>();
  private statusListeners = new Set<(s: NetStatus) => void>();
  private retry = 0;
  private wanted = false;
  status: NetStatus = 'closed';
  readonly token = getToken();
  private lastMsg = 0;

  constructor() {
    // canlılık sinyali: bağlantı boşta kalıp araya giren vekiller (Cloudflare vb.) tarafından kapatılmasın
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'ping' }));
    }, 20000);
    // ekran kapanıp açılınca (telefon uykudan dönünce) bağlantıyı hemen tazele
    document.addEventListener('visibilitychange', () => {
      if (document.hidden || !this.wanted) return;
      const stale = Date.now() - this.lastMsg > 25000;
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || stale) this.reconnectNow();
    });
    addEventListener('online', () => this.wanted && this.reconnectNow());
  }

  /** Mevcut bağlantıyı bırakıp hemen yeniden bağlan */
  reconnectNow() {
    const old = this.ws;
    this.ws = null;
    if (old) {
      old.onclose = null;
      try {
        old.close();
      } catch {}
    }
    this.retry = 0;
    this.connect();
  }

  url(): string {
    const env = (import.meta as any).env?.VITE_WS_URL as string | undefined;
    if (env) return env;
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  }

  connect() {
    this.wanted = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.setStatus('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url());
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.lastMsg = Date.now();
      ws.send(JSON.stringify({ t: 'hello', token: this.token }));
      this.setStatus('open');
      const q = this.queue.splice(0);
      for (const m of q) ws.send(JSON.stringify(m));
    };
    ws.onmessage = (e) => {
      this.lastMsg = Date.now();
      let m: ServerMsg;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (m.t === 'pong') return;
      for (const l of this.listeners) l(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.setStatus('closed');
      if (this.wanted) this.scheduleRetry();
    };
  }

  private scheduleRetry() {
    const d = Math.min(8000, 600 * 2 ** this.retry++);
    setTimeout(() => this.wanted && this.connect(), d);
  }

  private setStatus(s: NetStatus) {
    this.status = s;
    for (const l of this.statusListeners) l(s);
  }

  send(m: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else {
      this.queue.push(m);
      this.connect();
    }
  }

  on(fn: (m: ServerMsg) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onStatus(fn: (s: NetStatus) => void) {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  disconnect() {
    this.wanted = false;
    this.ws?.close();
  }
}

export const net = new NetClient();
