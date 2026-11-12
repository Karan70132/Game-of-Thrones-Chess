// Play page controller. Rules, Robo's search and the Colab evaluator come from the
// project's own engine files (engine.mjs, robot.mjs via worker.mjs, evaluator.mjs).
import { start, legal, apply, side, square, check, key, code, outcome } from '../engine.mjs';
import { FlatBoard } from './flatboard.js';
import { toSan, VALUE } from './notation.js';
import { play as sfx, sound } from './sounds.js';
import { store, toast, pieceImage, BOARD_THEMES, currentBoard, setBoard } from './ui.js';
import { openingName } from './openings.js';

const $ = (id) => document.getElementById(id);
const NAMES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
const RIVALS = { 1: 'The Squire', 2: 'The Knight Errant', 3: 'The Old Lord', 4: 'The Night King' };
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const LINES = {
  start: ['The board is set. Your move, challenger.', 'Two kings. One board. You move first.'],
  roboCheck: ['Your king is exposed. Find shelter.', 'Robo gives check.'],
  youCheck: ['A bold strike at the obsidian king.', 'Check! Robo must answer.'],
  roboCapture: ['One of yours has fallen.', 'Robo takes its due.'],
  youCapture: ['A clean strike.', 'One fewer in the obsidian ranks.'],
  win: ['All kings must fall. Today it was Robo’s.', 'The obsidian crown is yours.'],
  lose: ['All kings must fall. Today it was yours.', 'Robo holds the board. Rise and try again.'],
  draw: ['Neither crown prevails.', 'The war ends in a truce.'],
};

const player = document.querySelector('main').dataset.player;
const SAVE = 'rookroom-v2-' + player; // same key as before, so unfinished games carry over
let states = [start()], history = [], sans = [];
let selected = null, hinted = null, worker = null, epoch = 0, busy = false, over = false, reported = false;
let level = 2, model = null, spatial = null, view = store.get('got.view', '3d'), animateNext = false;
const state = () => states.at(-1);

// ---- persistence ------------------------------------------------------------
function persist() {
  try { localStorage.setItem(SAVE, JSON.stringify({ moves: history.map(code), level: String(level), reported })); } catch { /* ignore */ }
}
try {
  const data = JSON.parse(localStorage.getItem(SAVE));
  if (data) {
    for (const c of data.moves || []) {
      const m = legal(state()).find((x) => code(x) === c); if (!m) break;
      sans.push(toSan(state(), m)); history.push(m); states.push(apply(state(), m));
    }
    if (['1', '2', '3', '4'].includes(data.level)) level = Number(data.level);
    reported = !!data.reported;
  }
} catch { /* ignore */ }

// ---- boards -----------------------------------------------------------------
const flat = new FlatBoard($('flat-host'), {
  onSquare: (i, o) => onSquare(i, o),
  onDrop: (a, b) => onDrop(a, b),
  canDrag: (i) => !busy && !over && state().t === 'W' && side(state().b[i]) === 'W',
});

function targetsFor(s, from) {
  if (from === null) return [];
  const seen = new Map();
  for (const m of legal(s)) if (m[0] === from && !seen.has(m[1])) {
    seen.set(m[1], { i: m[1], capture: !!s.b[m[1]] || (s.b[from].toUpperCase() === 'P' && from % 8 !== m[1] % 8) });
  }
  return [...seen.values()];
}

function render(message) {
  const s = state(), moves = legal(s), ending = outcome(s, states.map(key), moves), white = s.t === 'W';
  const inCheck = check(s), kingSq = s.b.indexOf(white ? 'K' : 'k');
  $('status').textContent = ending ? ending + '.' : white ? (inCheck ? 'You are in check.' : 'Your move.') : 'Robo is thinking…';
  $('tip').textContent = message || (ending ? 'Play again, or take back the last move.' : white ? 'Select a white piece to see where it can go.' : level === 4 ? 'The Night King searches deep: about five seconds a move.' : 'Robo is weighing its replies.');
  $('dispatch').classList.toggle('check', !ending && inCheck && white);
  $('you-bar').classList.toggle('turn', !ending && white);
  $('robo-bar').classList.toggle('turn', !ending && !white);
  const opts = { selected, targets: targetsFor(s, selected), last: history.at(-1)?.slice(0, 2) || null, hint: hinted?.slice(0, 2) || null, check: inCheck ? kingSq : null };
  flat.set(s.b, opts);
  spatial?.update(s.b, { ...opts, mate: !!ending && /checkmate/i.test(ending), animate: animateNext });
  animateNext = false;
  $('hint').disabled = !!ending || !white || busy;
  $('undo').disabled = !history.length || busy;
  $('explain').disabled = !hinted || busy;
  $('resign').disabled = over || !!ending || !history.length;
  renderMoves(); renderTaken(s);
  const name = openingName(history.map(code)), op = $('opening');
  op.textContent = name || (history.length ? 'Out of the book: your own game now' : 'Opening: make your first move');
  op.classList.toggle('named', !!name);
  return ending;
}

function renderMoves() {
  const box = $('moves');
  if (!sans.length) { box.innerHTML = '<p class="empty">No moves yet. White moves first.</p>'; return; }
  let html = '<ol>';
  for (let i = 0; i < sans.length; i += 2) {
    const nowW = i === sans.length - 1, nowB = i + 1 === sans.length - 1;
    html += `<li><span>${i / 2 + 1}.</span><span class="${nowW ? 'now' : ''}">${sans[i]}</span><span class="${nowB ? 'now' : ''}">${sans[i + 1] || ''}</span></li>`;
  }
  box.innerHTML = html + '</ol>';
  box.scrollTop = box.scrollHeight;
}

function renderTaken(s) {
  const full = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
  const count = { W: { P: 0, N: 0, B: 0, R: 0, Q: 0 }, B: { P: 0, N: 0, B: 0, R: 0, Q: 0 } };
  for (const p of s.b) if (p && p.toUpperCase() !== 'K') count[side(p)][p.toUpperCase()] = (count[side(p)][p.toUpperCase()] || 0) + 1;
  const lost = (c) => Object.entries(full).flatMap(([t, n]) => Array(Math.max(0, n - (count[c][t] || 0))).fill(t));
  const material = (c) => Object.entries(count[c]).reduce((n, [t, k]) => n + VALUE[t] * k, 0);
  const diff = material('W') - material('B');
  const draw = (host, pieces, color, lead) => {
    host.innerHTML = pieces.map((t) => `<img src="${pieceImage(color === 'w' ? t : t.toLowerCase())}" alt="${NAMES[t]}">`).join('') + (lead > 0 ? `<em>+${lead}</em>` : '');
  };
  draw($('you-taken'), lost('B'), 'b', diff);
  draw($('robo-taken'), lost('W'), 'w', -diff);
}

function setEval(cp) {
  const bar = $('evalbar');
  const share = 50 + 50 * Math.tanh(cp / 650);
  bar.querySelector('i').style.height = `${share}%`;
  const text = Math.abs(cp) >= 15000 ? 'M' : (Math.abs(cp) / 100).toFixed(1);
  bar.querySelector('b').textContent = text;
  bar.classList.toggle('black-ahead', cp < 0);
  bar.setAttribute('aria-label', `Evaluation: ${cp >= 0 ? 'White' : 'Black'} ${text}`);
}

// ---- input ------------------------------------------------------------------
function onSquare(i, o = {}) {
  const s = state();
  if (over || busy || s.t !== 'W') return;
  if (o.dragStart) { if (side(s.b[i]) === 'W') { selected = i; render(); } return; }
  if (selected !== null) {
    const options = legal(s).filter((m) => m[0] === selected && m[1] === i);
    if (options.length) return choose(options);
  }
  if (side(s.b[i]) === 'W') { selected = selected === i ? null : i; render(); }
  else { if (selected !== null && s.b[i]) sfx('illegal'); selected = null; render(); }
}
function onDrop(a, b) {
  const options = legal(state()).filter((m) => m[0] === a && m[1] === b);
  if (options.length) choose(options); else { sfx('illegal'); selected = a; render(); }
}
async function choose(options) {
  let m = options[0];
  if (options.length > 1) {
    const p = await askPromotion(); if (!p) return;
    m = options.find((x) => x[2] === p) || m;
  }
  playMove(m);
}
function askPromotion() {
  return new Promise((resolve) => {
    const dlg = $('promotion'), box = $('promo-choices');
    box.replaceChildren();
    for (const p of 'QRBN') {
      const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = `<img src="${pieceImage(p)}" alt="${NAMES[p]}">`;
      b.setAttribute('aria-label', `Promote to ${NAMES[p]}`);
      b.onclick = () => { dlg.close(); resolve(p); };
      box.append(b);
    }
    dlg.onclose = () => resolve(null);
    dlg.showModal();
  });
}

// ---- moves ------------------------------------------------------------------
function stop() { epoch++; worker?.terminate(); worker = null; busy = false; selected = null; hinted = null; $('coach').hidden = true; }

function playMove(m) {
  const s = state(), piece = s.b[m[0]];
  const capture = !!s.b[m[1]] || (piece.toUpperCase() === 'P' && m[0] % 8 !== m[1] % 8);
  const san = toSan(s, m), byYou = side(piece) === 'W';
  stop();
  states.push(apply(s, m)); history.push(m); sans.push(san); persist();
  sfx(/[+#]/.test(san) ? 'check' : san.startsWith('O-O') ? 'castle' : m[2] ? 'promote' : capture ? 'capture' : 'move');
  animateNext = true;
  let msg;
  if (byYou) msg = san.includes('+') ? pick(LINES.youCheck) : capture ? pick(LINES.youCapture) : undefined;
  else msg = `Robo plays ${san}. ` + (san.includes('+') ? pick(LINES.roboCheck) : capture ? pick(LINES.roboCapture) : '');
  const ending = render(msg);
  if (ending) return finish(ending);
  if (state().t === 'B') {
    const token = epoch;
    setTimeout(() => { if (epoch === token && state().t === 'B') think(false); }, view === 'flat' || matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 780);
  }
}

function think(hint) {
  busy = true; selected = null;
  render(hint ? 'Robo is looking for your best move…' : undefined);
  worker = new Worker(new URL('../worker.mjs?v=8', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    worker.terminate(); worker = null; busy = false;
    if (data.error) { console.error('Robo search error:', data.error); render('Robo hit an error: ' + data.error.split('\n')[0]); return; }
    const m = data.move;
    if (!m) { render(); return; }
    if (hint) {
      hinted = m; sfx('hint');
      render(`Try ${toSan(state(), m)}: your ${NAMES[state().b[m[0]].toUpperCase()]} from ${square(m[0])} to ${square(m[1])}.`);
    } else { setEval(data.score); playMove(m); if (level === 4 && data.depth) $('tip').textContent = `The Night King looked ${data.depth} moves deep.`; else if (level === 4 && data.book) $('tip').textContent = 'The Night King plays from its opening book.'; }
  };
  worker.onerror = (e) => { console.error('Robo worker failed to start:', e.message || e); stop(); render('Robo’s search could not start. Press Ctrl+Shift+R; if it persists, open the browser console (F12) and send the red error.'); };
  worker.postMessage({ s: state(), model, ply: history.length, level: hint ? 2 : level, codes: history.map(code), prior: states.slice(-40, -1), timeMs: 5000 });
}

async function report(result) {
  if (reported) return null;
  reported = true; persist();
  try {
    const r = await fetch('/api/result/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf() }, body: JSON.stringify({ result }) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
const csrf = () => document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';

async function finish(ending, resigned = false) {
  over = true;
  const win = /^You win/.test(ending), lose = resigned || /^Robo wins/.test(ending);
  const result = win ? 'win' : lose ? 'loss' : 'draw';
  sfx(win ? 'win' : 'end');
  const record = await report(result);
  setTimeout(() => {
    $('end-title').textContent = resigned ? 'Resigned' : /checkmate/.test(ending) ? 'Checkmate' : /stalemate/.test(ending) ? 'Stalemate' : 'Draw';
    $('end-saying').textContent = (resigned ? 'You laid down your king. ' : ending + '. ') + pick(LINES[result === 'win' ? 'win' : result === 'loss' ? 'lose' : 'draw']);
    $('end-record').innerHTML = record ? `<span>Wins ${record.wins}</span><span>Losses ${record.losses}</span><span>Draws ${record.draws}</span>` : '';
    $('ending').showModal();
  }, resigned ? 50 : 900);
}

function newGame() {
  stop(); states = [start()]; history = []; sans = []; over = false; reported = false; persist();
  setEval(18); render(pick(LINES.start)); sfx('start');
  spatial?.rain(); // the armies take the field
}

// ---- controls ---------------------------------------------------------------
$('hint').onclick = () => think(true);
$('undo').onclick = () => {
  stop(); over = false;
  const n = state().t === 'B' ? 1 : 2;
  states.splice(-n); history.splice(-n); sans.splice(-n); persist(); render('Move taken back.');
};
$('new').onclick = () => (history.length ? $('confirm-new').showModal() : newGame());
$('new-yes').onclick = () => { $('confirm-new').close(); newGame(); };
$('new-no').onclick = () => $('confirm-new').close();
$('resign').onclick = () => $('confirm-resign').showModal();
$('resign-no').onclick = () => $('confirm-resign').close();
$('resign-yes').onclick = () => { $('confirm-resign').close(); stop(); render('You resigned.'); finish('Robo wins by resignation', true); };
$('again').onclick = () => { $('ending').close(); newGame(); };
$('review').onclick = () => $('ending').close();
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && selected !== null) { selected = null; render(); } });

for (const b of document.querySelectorAll('.rival')) {
  b.onclick = () => {
    level = Number(b.dataset.level); persist();
    document.querySelectorAll('.rival').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('rival-name').textContent = RIVALS[level]; $('settings-sum').textContent = RIVALS[level];
  };
  b.setAttribute('aria-pressed', String(Number(b.dataset.level) === level));
}
$('rival-name').textContent = RIVALS[level];
$('settings-sum').textContent = RIVALS[level];

// full screen: the board column fills the screen (Esc leaves)
const fsBtn = $('fullscreen'), col = document.querySelector('.board-col');
if (!col.requestFullscreen) fsBtn.hidden = true;
fsBtn.onclick = () => (document.fullscreenElement ? document.exitFullscreen() : col.requestFullscreen().catch(() => {}));
document.addEventListener('fullscreenchange', () => {
  const on = document.fullscreenElement === col;
  fsBtn.textContent = on ? 'Exit full screen' : 'Full screen'; fsBtn.setAttribute('aria-pressed', String(on));
});

const sw = $('swatches');
for (const [name, th] of Object.entries(BOARD_THEMES)) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'swatch'; b.title = th.name; b.setAttribute('aria-label', th.name);
  b.style.setProperty('--a', th.light); b.style.setProperty('--b', th.dark);
  b.innerHTML = '<i></i><i></i><i></i><i></i>';
  b.setAttribute('aria-pressed', String(name === currentBoard()));
  b.onclick = () => { setBoard(name); sw.querySelectorAll('.swatch').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); };
  sw.append(b);
}

const sb = $('sound');
sb.setAttribute('aria-pressed', String(sound.on));
sb.onclick = () => { sound.on = !sound.on; sb.setAttribute('aria-pressed', String(sound.on)); if (sound.on) sfx('move'); };

$('explain').onclick = async () => {
  const token = epoch, m = hinted, s = state(); if (!m) return;
  const box = $('coach'); box.hidden = false; box.textContent = 'Asking the coach…';
  $('explain').disabled = true;
  const pieces = s.b.flatMap((p, i) => (p ? [square(i) + ' ' + (side(p) === 'W' ? 'white ' : 'black ') + NAMES[p.toUpperCase()]] : []));
  const prompt = 'Explain the suggested legal chess move to a beginner in at most two sentences. White to move. Suggested move: ' + code(m) + '. Pieces: ' + pieces.join(', ') + '. Avoid speculative tactical claims.';
  let session;
  try {
    let answer;
    if (globalThis.LanguageModel && await LanguageModel.availability() !== 'unavailable') { session = await LanguageModel.create(); answer = await session.prompt(prompt); }
    else {
      const r = await fetch('/api/coach/', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf() }, body: JSON.stringify({ prompt }) });
      if (!r.ok) throw Error(); answer = (await r.json()).answer;
    }
    if (token === epoch) box.textContent = answer;
  } catch { if (token === epoch) box.textContent = 'The LLM coach needs a supported browser model or the local Ollama setup. Your hint is ' + toSan(s, m) + '.'; }
  finally { session?.destroy(); $('explain').disabled = !hinted; }
};

function setView(v) {
  view = spatial ? v : 'flat';
  store.set('got.view', view);
  $('scene').hidden = view !== '3d';
  $('flat-host').hidden = view !== 'flat';
  for (const id of ['cam-angle', 'cam-top', 'gesture']) $(id).hidden = view !== '3d';
  $('view-3d').setAttribute('aria-pressed', String(view === '3d'));
  $('view-flat').setAttribute('aria-pressed', String(view === 'flat'));
}
$('view-3d').onclick = () => setView('3d');
$('view-flat').onclick = () => setView('flat');
$('cam-angle').onclick = () => spatial?.reset();
$('cam-top').onclick = () => spatial?.top();

// ---- boot -------------------------------------------------------------------
async function boot() {
  $('scene').hidden = false;
  try {
    const { mountBoard } = await import('./board3d.js');
    spatial = await mountBoard($('scene'), (i) => onSquare(i));
  } catch (err) {
    console.warn('3D board unavailable, using the flat board:', err);
    spatial = null; $('view-3d').disabled = true; $('view-3d').title = '3D needs WebGL';
  }
  setView(view);
  try {
    const r = await fetch('/api/model/', { cache: 'no-store' });
    if (!r.ok) throw Error();
    model = (await r.json()).model;
    const m = model?.metrics, err = m ? ` (error ${m.validation_mae_cp} cp vs ${m.material_mae_cp} cp for material alone)` : '';
    $('model-state').innerHTML = !model ? 'Baseline evaluation active · no trained model installed yet.'
      : m && m.validation_mae_cp >= m.material_mae_cp ? `Model installed but not used: it is not yet better than counting material${err}.`
      : model.format === 'rook-eval-v2' ? `<b>GPU model active</b> · ${Number(m?.positions || 0).toLocaleString()} positions${err}.`
      : `<b>Colab model active</b> · Robo blends your trained network into its search${err}.`;
  } catch { $('model-state').textContent = 'Model load failed · baseline evaluation active.'; }
  const ending = render(history.length ? 'Welcome back. Your game is where you left it.' : pick(LINES.start));
  if (!history.length && view === '3d') spatial?.rain();
  if (ending) over = true;
  else if (state().t === 'B') think(false);
}
boot();
