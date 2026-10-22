export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, any> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return el;
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function nextFrame(): Promise<void> {
  // arka planda rAF durur; oyunun takılmaması için zaman aşımıyla yarıştır
  return new Promise((r) => {
    let done = false;
    const fin = () => {
      if (!done) {
        done = true;
        r();
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(fin));
    setTimeout(fin, 60);
  });
}

export function stageEl(): HTMLElement {
  return document.getElementById('stage')!;
}

/** Sahne üzerinde modal pencere */
export function modal(content: HTMLElement, opts: { closable?: boolean; className?: string } = {}): { close: () => void; el: HTMLElement } {
  const backdrop = h('div', { class: 'modal-backdrop' });
  const box = h('div', { class: 'modal ' + (opts.className ?? '') }, content);
  backdrop.append(box);
  const close = () => {
    backdrop.classList.add('closing');
    setTimeout(() => backdrop.remove(), 220);
  };
  if (opts.closable) {
    const x = h('button', { class: 'modal-x', onclick: close, title: 'Kapat' }, '✕');
    box.append(x);
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) close();
    });
  }
  stageEl().append(backdrop);
  return { close, el: box };
}

export function fitStage() {
  const stage = stageEl();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s = Math.min(vw / 1280, vh / 720);
  stage.style.transform = `scale(${s})`;
  stage.style.left = `${(vw - 1280 * s) / 2}px`;
  stage.style.top = `${(vh - 720 * s) / 2}px`;
}

export function store<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {}
}
