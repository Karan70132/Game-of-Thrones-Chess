// Shared UI helpers: themes, board colours, crests, toasts and small storage wrappers.

export const store = {
  get(key, fallback = null) { try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } },
};

export const BOARD_THEMES = {
  tourney: { name: 'Tourney green', light: '#eeeed2', dark: '#769656' },
  walnut: { name: 'Walnut', light: '#f0d9b5', dark: '#b58863' },
  frost: { name: 'Frost', light: '#dee3e6', dark: '#8ca2ad' },
  night: { name: 'Night stone', light: '#b9b2c9', dark: '#5a5170' },
};

export function currentTheme() { return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'; }
export function currentBoard() { const b = document.documentElement.dataset.board; return BOARD_THEMES[b] ? b : 'tourney'; }

export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  store.set('got.theme', theme);
  document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}
export function setBoard(name) {
  if (!BOARD_THEMES[name]) return;
  document.documentElement.dataset.board = name;
  store.set('got.board', name);
  document.dispatchEvent(new CustomEvent('boardchange', { detail: name }));
}

export function initChrome() {
  for (const b of document.querySelectorAll('.theme-toggle')) {
    const paint = () => b.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    paint();
    b.addEventListener('click', () => { setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); paint(); });
  }
}

let toastTimer;
export function toast(text, ms = 2600) {
  let el = document.querySelector('.toast');
  if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// Flat 2D pieces (web/make_flat_pieces.py) for the flat board, puzzles, captured pieces and promotion.
export const pieceImage = (p) => `/static/img/flat/${p === p.toUpperCase() ? 'w' : 'b'}${p.toUpperCase()}.svg`;

// ---- crests (same drawing as kingdom/templatetags/crests.py) -----------------
const SHIELD = 'M50 3 L94 13 L94 56 C94 86 74 105 50 117 C26 105 6 86 6 56 L6 13 Z';
const INNER = 'M50 10 L87 18.5 L87 56 C87 81 70 97.5 50 108 C30 97.5 13 81 13 56 L13 18.5 Z';
let crestId = 0;
export function crestSVG({ field = '#1f4d3a', metal = '#d7b25a', piece = 'N', side = 'w', photo = '' } = {}) {
  const id = `jc${++crestId}`;
  const art = photo
    ? `<image href="${photo}" x="0" y="0" width="100" height="120" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id}c)"/>`
    : `<image href="/static/img/pieces/${side}${piece}.webp" x="9" y="13" width="82" height="82"/>`;
  return `<svg viewBox="0 0 100 120" role="img" aria-hidden="true"><defs>
<linearGradient id="${id}g" x1="0" y1="0" x2=".35" y2="1"><stop offset="0" stop-color="${field}"/><stop offset="1" stop-color="${field}" stop-opacity=".72"/></linearGradient>
<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="${id}c"><path d="${SHIELD}"/></clipPath></defs>
<path d="${SHIELD}" fill="#0b0a08"/><path d="${SHIELD}" fill="url(#${id}g)"/>${art}
<path d="${SHIELD}" fill="url(#${id}s)"/><path d="${SHIELD}" fill="none" stroke="${metal}" stroke-width="4.5"/>
<path d="${INNER}" fill="none" stroke="${metal}" stroke-opacity=".5" stroke-width="1.3"/></svg>`;
}
export const ROBO_CREST = { field: '#cfd9df', metal: '#2a3442', piece: 'K', side: 'b' };
