// İnce çizgili, temaya uygun ikonlar (currentColor)
const s = (d: string, vb = 24) =>
  `<svg viewBox="0 0 ${vb} ${vb}" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="ic">${d}</svg>`;

// Madalyon ikonları (32'lik, kabartma çizgi)
const m = (d: string) =>
  `<svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="mic">${d}</svg>`;

export const MEDAL = {
  fold: m('<rect x="5" y="8" width="12" height="17" rx="1.5" transform="rotate(-16 11 16)"/><rect x="14" y="7" width="12" height="17" rx="1.5" transform="rotate(12 20 15)"/><path d="M6 29h20"/>'),
  check: m('<path d="M5 24h22"/><path d="M12 19a4 4 0 0 1 8 0"/><path d="M8.5 15a7.5 7.5 0 0 1 15 0"/>'),
  call: m('<ellipse cx="16" cy="23" rx="8" ry="3"/><path d="M8 23v-4M24 23v-4"/><ellipse cx="16" cy="19" rx="8" ry="3"/><path d="M8 19v-4M24 19v-4"/><ellipse cx="16" cy="15" rx="8" ry="3"/>'),
  raise: m('<ellipse cx="13" cy="24" rx="7" ry="2.6"/><path d="M6 24v-4M20 24v-4"/><ellipse cx="13" cy="20" rx="7" ry="2.6"/><path d="M6 20v-4M20 20v-4"/><ellipse cx="13" cy="16" rx="7" ry="2.6"/><path d="M26 22V7M22 11l4-4 4 4"/>'),
  allin: m('<path d="M6 22l2-11 5 6 3-9 3 9 5-6 2 11z"/><path d="M6 26h20"/>'),
  next: m('<rect x="6" y="8" width="13" height="18" rx="1.5"/><path d="M9 5h12a2 2 0 0 1 2 2v15"/><path d="M22 17h6M25 14l3 3-3 3"/>'),
  swap: m('<path d="M7 11h16l-4-4M25 21H9l4 4"/>'),
  no: m('<circle cx="16" cy="16" r="9"/><path d="M10 22l12-12"/>'),
};

export const ICON = {
  menu: s('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  soundOn: s('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
  soundOff: s('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>'),
  book: s('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7M8 11h7"/>'),
  scroll: s('<path d="M7 4h11a2 2 0 0 1 2 2v1h-3"/><path d="M17 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1h11"/><path d="M7 4a2 2 0 0 0-2 2v11M9 9h5M9 13h5"/>'),
  joker: s('<rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M8 9l2-3 2 2 2-2 2 3M9 14q3 3 6 0"/>'),
  close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
  back: s('<path d="M15 5l-7 7 7 7"/>'),
  eye: s('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  flame: s('<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 2 3 4 1-2 1-5 1-8z"/>'),
  hourglass: s('<path d="M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9"/>'),
  swap: s('<path d="M7 7h12l-3-3M17 17H5l3 3"/>'),
  prism: s('<path d="M12 3l9 16H3z"/><path d="M12 3v16M7 12h10"/>'),
};
