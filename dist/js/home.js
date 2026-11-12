// Home page: a scroll story over one 3D scene.
// 0 kings face off → 1 they part and the board rises → 2 five Game of Thrones moments replayed as chess
// → 3 one piece on a pedestal → 4 daily puzzle → 5 lore → 6 banner quiz → 7 the kings return.
import { start, legal, apply, check } from '../engine.mjs';
import { toSan, fromSan, parseFen } from './notation.js';
import { FlatBoard } from './flatboard.js';
import { play as sfx, scene as ambience, sound } from './sounds.js';
import { crestSVG } from './ui.js';
import { webglAvailable, reducedMotion } from './realm3d.js';

const $ = (id) => document.getElementById(id);
const chapters = [...document.querySelectorAll('[data-chapter]')];
const rail = [...document.querySelectorAll('.rail a')];
const houses = JSON.parse($('houses-data').textContent);
const THREE_FOV_HALF = (32 / 2) * Math.PI / 180; // matches the versus.js camera
const ramp = (x, a, b) => Math.min(1, Math.max(0, (x - a) / (b - a)));
const smooth = (x) => x * x * (3 - 2 * x);

// ---------------------------------------------------------------------------
// Chapter II: five turning points of HBO's Game of Thrones, each replayed as the chess tactic it resembles.
// Every line was checked with the project's own engine (node scripts/check-saga.mjs).
const SAGA = [
  {
    ep: 'Season 1 · Episode 9', ambience: 'toll', title: 'Baelor', clip: 'winter-is-coming', phrase: 'Winter is coming.', idea: 'The pin', focus: 'c3',
    story: 'Ned Stark confesses to a treason he never committed, on the steps of the Great Sept, to keep his daughters safe. The boy king orders his execution anyway.',
    lesson: 'A pinned piece cannot move without exposing something more valuable behind it. The knight on c3 is bound to its king, so it can only wait.',
    fen: '4k3/p4ppp/8/3p4/1b6/2N5/PP3PPP/4K3 b - - 0 1', moves: ['d5d4', 'h2h3', 'd4c3'], line: ['b4', 'c3', 'd2', 'e1'],
    notes: ['The pawn steps up and attacks the pinned knight.', 'White can only wait. The knight may not leave the line to its king.', 'The knight falls to a pawn.'],
  },
  {
    ep: 'Season 2 · Episode 9', ambience: 'wildfire', title: 'Blackwater', clip: 'hear-me-roar', phrase: 'Hear me roar.', idea: 'The discovered attack', focus: 'd6',
    story: 'Stannis Baratheon’s fleet sails into the bay below King’s Landing. Tyrion Lannister sends one ship out to meet it, leaking wildfire, and a single arrow sets the water alight.',
    lesson: 'One piece moves aside and unmasks the weapon hidden behind it. The knight jumps with a threat of its own while the rook behind it gives check.',
    fen: '3qk3/pp3ppp/8/4N3/8/8/5PPP/4R1K1 w - - 0 1', moves: ['e5c6', 'd8e7', 'c6e7'], line: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8'],
    notes: ['The knight leaps away: the rook gives check, and the knight hits the queen.', 'Black must block the check with the queen.', 'The knight takes the queen.'],
  },
  {
    ep: 'Season 3 · Episode 9', ambience: 'drums', title: 'The Rains of Castamere', clip: 'the-north-remembers', phrase: 'The North remembers.', idea: 'The smothered mate', focus: 'g7',
    story: 'At his uncle’s wedding feast, Robb Stark, the King in the North, is surrounded by the very lords who swore to stand with him. The doors close and the music changes.',
    lesson: 'The king is walled in by his own rook and pawns. The queen gives herself up so the rook must take her, and the knight finishes the king among his own men.',
    fen: 'r6k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1', moves: ['b3g8', 'a8g8', 'h6f7'], line: ['g8', 'g7', 'h7'],
    notes: ['The queen offers herself, with check.', 'The rook must take her. The king has no square of his own.', 'Checkmate. The king falls surrounded by his own side.'],
  },
  {
    ep: 'Season 6 · Episode 9', ambience: 'charge', title: 'Battle of the Bastards', clip: 'the-king-in-the-north', phrase: 'The King in the North!', idea: 'The knight fork', focus: 'c7',
    story: 'Jon Snow’s army is encircled by a wall of Bolton shields and slowly crushed. Then a horn sounds on the hill, and the knights of the Vale ride down to break the ring.',
    lesson: 'Cavalry from nowhere: one knight lands on a square where it attacks two targets at once. The king must step aside and the queen is lost.',
    fen: 'q3k3/pp1ppppp/8/1N6/8/8/5PPP/6K1 w - - 0 1', moves: ['b5c7', 'e8d8', 'c7a8'], line: ['a8', 'e8'],
    notes: ['The knight lands on c7: check, and the queen is attacked too.', 'The king has to move.', 'The knight takes the queen.'],
  },
  {
    ep: 'Season 8 · Episode 3', ambience: 'winter', title: 'The Long Night', clip: 'not-today', phrase: 'Not today.', idea: 'The underpromotion', focus: 'e7',
    story: 'The dead pour over the walls of Winterfell and the Night King walks into the godswood unopposed. Then Arya Stark drops out of the dark with a Valyrian steel dagger.',
    lesson: 'Everyone expects a pawn to become a queen. Here it becomes a knight, the only piece that checks the king from f8 and attacks the queen at the same time.',
    fen: '8/3q1P1k/8/8/8/8/8/2K5 w - - 0 1', moves: ['f7f8n', 'h7g7', 'f8d7'], line: ['f8', 'h7', 'd7'],
    notes: ['The pawn crowns as a knight, with check.', 'The king steps away.', 'The knight takes the queen. Nobody saw it coming.'],
  },
];
const sqIndex = (u) => (u.charCodeAt(0) - 97) + (Number(u[1]) - 1) * 8;
for (const sc of SAGA) {
  sc.states = [parseFen(sc.fen)]; sc.played = []; sc.san = [];
  for (const u of sc.moves) {
    const s = sc.states.at(-1), a = sqIndex(u), b = sqIndex(u.slice(2)), pr = u[4]?.toUpperCase();
    const m = legal(s).find((x) => x[0] === a && x[1] === b && (!pr || x[2] === pr));
    sc.played.push(m); sc.san.push(toSan(s, m)); sc.states.push(apply(s, m));
  }
  sc.hint = sc.line.map(sqIndex);
}
// Season tiles: nothing plays until you pick one, and scrolling simply moves on to the next chapter.
const tiles = $('saga-tiles');
SAGA.forEach((sc, k) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'saga-tile';
  b.innerHTML = `<b>${sc.ep.replace('Season ', 'S').replace(' · Episode ', ' · E')}</b><span>${sc.title.replace('The Rains of Castamere', 'Rains of Castamere')}</span><small>${sc.idea}</small>`; b.title = sc.idea;
  b.setAttribute('aria-label', `Play ${sc.ep}: ${sc.title}, ${sc.idea}`);
  b.onclick = () => playScene(k);
  tiles.append(b);
});
let sagaScene = -1, sagaPly = -1, sagaFlat = null, playing = false, timer = 0, token = 0;

// Voice: the browser's own speech voice, slowed and lowered, says each scene's line.
// (Recordings from the show are HBO's and are not included.)
let voiceOn = (() => { try { return localStorage.getItem('got.sagaVoice') !== 'off'; } catch { return true; } })();
const voiceBtn = $('saga-voice'), synth = window.speechSynthesis;
function showVoice() { voiceBtn.setAttribute('aria-pressed', String(voiceOn)); voiceBtn.querySelector('span').textContent = `Voice & sound: ${voiceOn ? 'on' : 'off'}`; }
showVoice();
function pickVoice() {
  const vs = synth?.getVoices() || [];
  return vs.find((v) => /en-GB/i.test(v.lang) && /male|daniel|arthur|george|ryan|oliver/i.test(v.name)) || vs.find((v) => /en-GB/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
}
function say(text, { epic = false, queue = false } = {}) {
  if (!voiceOn || !synth) return;
  if (!queue) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = pickVoice(); u.rate = epic ? 0.74 : 0.95; u.pitch = epic ? 0.5 : 0.85; u.volume = 1;
  synth.speak(u);
}
// Each scene's line plays from your own recording in dist/audio/saga/<clip>.m4a (falls back to the browser voice).
let clipEl = null;
function playLine(sc) {
  if (!voiceOn) return;
  clipEl?.pause();
  clipEl = new Audio(`/static/audio/saga/${sc.clip}.m4a`);
  clipEl.volume = 1;
  clipEl.play().catch(() => say(sc.phrase, { epic: true }));
}
voiceBtn.onclick = () => {
  voiceOn = !voiceOn; showVoice();
  try { localStorage.setItem('got.sagaVoice', voiceOn ? 'on' : 'off'); } catch { /* ignore */ }
  if (!voiceOn) { synth?.cancel(); clipEl?.pause(); } else if (sagaScene >= 0) playLine(SAGA[sagaScene]);
};

const sagaCam = { x: 0, y: 0, z: 0 }, sagaAim = { x: 0, y: 0, z: 0 };
function aimAt(sq) {
  const wide = innerWidth > 900, k = wide ? 0.82 : 0.9, i = sqIndex(sq);
  sagaAim.x = (wide ? 3.4 : 0) + k * (i % 8 - 3.5); sagaAim.z = k * (3.5 - (i >> 3));
}
function moveText(sc, ply) {
  let n = 1;
  return sc.san.map((san, k) => {
    const white = sc.states[k].t === 'W';
    let label = san;
    if (white) label = `${n}. ${san}`; else { if (k === 0) label = `${n}… ${san}`; n++; }
    return `<span class="${k < ply ? 'done' : ''}${k === ply - 1 ? ' now' : ''}">${label}</span>`;
  }).join(' ');
}
function showSaga(scene, ply, animate = false) {
  const sc = SAGA[scene], newScene = scene !== sagaScene;
  const forward = !newScene && ply === sagaPly + 1;
  sagaScene = scene; sagaPly = ply;
  if (newScene) {
    const card = $('saga-card');
    card.classList.add('chosen');
    card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
    $('saga-ep').textContent = sc.ep; $('saga-title').textContent = sc.title; $('saga-story').textContent = sc.story;
    $('saga-idea').textContent = sc.idea; $('saga-lesson').textContent = sc.lesson; $('saga-phrase').textContent = `“${sc.phrase}”`;
    [...tiles.children].forEach((b, k) => b.setAttribute('aria-pressed', String(k === scene)));
    aimAt(sc.focus);
    if (!st) Object.assign(sagaCam, sagaAim);
  }
  const s = sc.states[ply], m = sc.played[ply - 1];
  const inCheck = check(s), mate = inCheck && legal(s).length === 0;
  const opts = { last: m ? m.slice(0, 2) : null, check: inCheck ? s.b.indexOf(s.t === 'W' ? 'K' : 'k') : null, mate, hint: ply === 0 ? sc.hint : null };
  rig?.update(s.b, { ...opts, animate: animate && forward });
  if (newScene && animate && rig) rig.rain({ quick: true });
  sagaFlat?.set(s.b, opts);
  $('saga-moves').innerHTML = moveText(sc, ply);
  $('saga-note').textContent = ply ? sc.notes[ply - 1] : `${s.t === 'W' ? 'White' : 'Black'} to move.`;
  $('saga-back').disabled = ply === 0;
  $('saga-next').disabled = ply === sc.moves.length;
  if (animate && forward) {
    const san = sc.san[ply - 1];
    sfx(san.includes('#') ? 'end' : san.includes('=') ? 'promote' : san.includes('x') ? 'steel' : san.includes('+') ? 'check' : 'move');
  }
}
// playback
function setPlaying(on) {
  playing = on; clearTimeout(timer); token++;
  $('saga-play').textContent = on ? 'Pause' : sagaScene >= 0 && sagaPly === SAGA[sagaScene].moves.length ? 'Replay' : 'Play';
  $('saga-play').setAttribute('aria-pressed', String(on));
  if (on) step(token, sagaPly === 0 ? 2600 : 1500);
}
function step(tk, wait) {
  timer = setTimeout(() => {
    if (tk !== token || sagaScene < 0) return;
    const sc = SAGA[sagaScene];
    if (sagaPly >= sc.moves.length) { setPlaying(false); return; }
    showSaga(sagaScene, sagaPly + 1, true);
    if (sagaPly >= sc.moves.length) setTimeout(() => { if (tk === token) setPlaying(false); }, 400);
    else step(tk, 1900);
  }, wait);
}
function playScene(k) {
  if (voiceOn) sound.on = true; // this runs inside a click, so the browser lets audio start
  showSaga(k, 0, true);
  if (voiceOn) { ambience(SAGA[k].ambience); setTimeout(() => playLine(SAGA[k]), 600); }
  setPlaying(true);
}
$('saga-play').onclick = () => {
  if (sagaScene < 0) return playScene(0);
  if (playing) return setPlaying(false);
  if (sagaPly === SAGA[sagaScene].moves.length) { showSaga(sagaScene, 0); }
  setPlaying(true);
};
$('saga-next').onclick = () => { if (sagaScene < 0) return playScene(0); setPlaying(false); if (sagaPly < SAGA[sagaScene].moves.length) showSaga(sagaScene, sagaPly + 1, true); setPlaying(false); };
$('saga-back').onclick = () => { if (sagaScene < 0) return; setPlaying(false); if (sagaPly > 0) showSaga(sagaScene, sagaPly - 1); setPlaying(false); };

// ---------------------------------------------------------------------------
// Scroll → story progress
let target = 0, progress = 0, inFinale = false;
function readScroll() {
  const y = scrollY + innerHeight * 0.4;
  // the first chapter starts 'at' 40% of the viewport so the page opens exactly on the duel
  const tops = chapters.map((c, k) => (k === 0 ? innerHeight * 0.4 : c.offsetTop));
  let i = 0;
  while (i < tops.length - 1 && y >= tops[i + 1]) i++;
  const end = i < tops.length - 1 ? tops[i + 1] : tops[i] + chapters[i].offsetHeight;
  target = Math.min(chapters.length - 1, i + Math.max(0, Math.min(1, (y - tops[i]) / Math.max(1, end - tops[i]))));
  rail.forEach((a, k) => a.classList.toggle('on', k === i));
  const shade = ramp(target, 0.55, 1.0) * (1 - ramp(target, 3.85, 4.1));
  document.documentElement.style.setProperty('--shade', shade.toFixed(3));
  if (!st) fallbackPoster(i);
}
addEventListener('scroll', readScroll, { passive: true });
addEventListener('resize', readScroll);

// ---------------------------------------------------------------------------
// 3D scene
let st = null, rig = null, exhibit = null, exhibitPiece = null, THREE = null;
const poster = document.querySelector('#stage .fallback');
function fallbackPoster(i) {
  const src = i === 1 || i === 2 ? '/static/board-render.png' : '/static/kings-render.png';
  if (poster && !poster.src.endsWith(src)) poster.src = src;
}

async function init3d() {
  ({ THREE } = await import('./realm3d.js'));
  const { buildStage } = await import('./versus.js');
  const { buildBoard } = await import('./board3d.js');
  const stage = await buildStage($('stage'));
  const grain = await new THREE.TextureLoader().loadAsync('/static/grain.jpg').catch(() => null);
  if (grain) { grain.colorSpace = THREE.SRGBColorSpace; grain.wrapS = grain.wrapT = THREE.RepeatWrapping; }
  rig = buildBoard({ geos: stage.geos, mats: stage.mats, grain, shadowFloor: false });
  rig.group.visible = false;
  stage.scene.add(rig.group);
  rig.setPixelRatio(stage.renderer.getPixelRatio());
  { const keep = sagaScene, ply = sagaPly; sagaScene = -1; showSaga(Math.max(0, keep), Math.max(0, ply)); if (keep < 0) { sagaScene = -1; $('saga-card').classList.remove('chosen'); [...tiles.children].forEach((b) => b.setAttribute('aria-pressed', 'false')); } }
  exhibit = new THREE.Group();
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.18, 64), new THREE.MeshStandardMaterial({ color: '#3a2a1e', roughness: 0.45, map: grain }));
  ped.position.y = -0.09; ped.receiveShadow = true; ped.castShadow = true;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.014, 8, 96), stage.mats.gold); ring.rotation.x = Math.PI / 2;
  exhibitPiece = new THREE.Mesh(stage.geos.K, stage.mats.w); exhibitPiece.castShadow = true;
  exhibit.add(ped, ring, exhibitPiece); exhibit.visible = false;
  stage.scene.add(exhibit);
  st = stage;
  st.onTick(tick);
}

const v = (x, y, z) => ({ x, y, z });
const mix = (a, b, k) => v(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);
function shotAt(p, wide) {
  const bx = wide ? 3.4 : 0, ex = wide ? 2.5 : 0, lx = wide ? -2.4 : 0;
  const duel = fitDuel(bands.hero);
  // the finale keeps the big, close framing: the kings tower behind the closing words
  let duelEnd = { pos: v(0, 1.6, 9.8), look: v(0, 0.62, 0) };
  if (innerWidth / innerHeight < 1.15) {
    const D = Math.max(9.6, 2.7 / (Math.tan(THREE_FOV_HALF) * (innerWidth / innerHeight)));
    duelEnd = { pos: v(0, 3.4, D), look: v(0, 1.3 - 0.09 * D, 0) };
  }
  const board = { pos: v(bx + 2.5, 10.2, 12.4), look: v(bx + lx, -0.9, 0.4) };
  // the camera leans in over the squares where each scene happens, drifting slowly around the board
  const sagaShot = (f) => {
    const a = 0.32 - f * 0.64, elev = 0.95, d = wide ? 13 : 14.5, aspect = innerWidth / innerHeight;
    const dir = v(Math.sin(a) * Math.cos(elev), Math.sin(elev), Math.cos(a) * Math.cos(elev));
    const F = sagaCam, tanV = Math.tan(THREE_FOV_HALF);
    let L;
    if (wide) { const off = 0.3 * d * tanV * aspect; L = v(F.x - Math.cos(a) * off, 0, F.z + Math.sin(a) * off); } // focus sits right of the card
    else { const off = 0.5 * d * tanV; L = v(F.x + Math.sin(a) * off * 0.9, -off * 0.45, F.z + Math.cos(a) * off * 0.9); } // focus sits above the card
    return { pos: v(L.x + dir.x * d, L.y + dir.y * d, L.z + dir.z * d), look: L };
  };
  const court = wide ? { pos: v(ex + 1.5, 1.9, 4.9), look: v(ex - 1.0, 0.95, 0) } : { pos: v(1.6, 2.4, 13.8), look: v(0, -1.6, 0) }; // phones: the piece stands above the text
  // narrow screens: pull every shot back so the kings and the board still fit
  const aspect = innerWidth / innerHeight;
  const far = Math.max(1, 1.05 / aspect);
  const back = (S) => ({ pos: v(S.look.x + (S.pos.x - S.look.x) * far, S.look.y + (S.pos.y - S.look.y) * far, S.look.z + (S.pos.z - S.look.z) * far), look: S.look });
  const blend = (A, B, k) => ({ pos: mix(A.pos, B.pos, smooth(k)), look: mix(A.look, B.look, smooth(k)) });
  const B = back(board), O = (f) => back(sagaShot(f)), C = wide ? back(court) : court;
  if (p < 1) return blend(duel, B, p);
  if (p < 2) return blend(B, O(0), p - 1);
  if (p < 3) return O(Math.max(0, sagaScene) / 4);
  if (p < 3.3) return blend(O(1), C, (p - 3) / 0.3);
  if (p < 4) return C;
  if (p < 4.6) return blend(C, duelEnd, (p - 4) / 0.6);
  return duelEnd;
}

// The kings are framed into the free space between the top bar and the text under them,
// so the title never sits on top of them on any screen size.
const KINGS_H = 2.85, KINGS_HALF_W = 2.15;
const bands = { hero: { top: 80, bottom: 500 }, finale: { top: 80, bottom: 500 } };
function measureBands() {
  const nav = document.querySelector('.realm-nav')?.getBoundingClientRect().bottom || 70;
  const heroText = document.querySelector('#versus .title');
  const docEnd = document.documentElement.scrollHeight - innerHeight;
  const finaleText = document.querySelector('#enter .chapter-no');
  const top = nav + 10;
  if (heroText) bands.hero = { top, bottom: Math.max(top + 160, heroText.getBoundingClientRect().top + scrollY - 18) };
  if (finaleText) bands.finale = { top, bottom: Math.max(top + 140, finaleText.getBoundingClientRect().top + scrollY - docEnd - 18) };
}
function fitDuel(band) {
  const tan = Math.tan(THREE_FOV_HALF), H = innerHeight, aspect = innerWidth / H, bandH = band.bottom - band.top;
  const D = Math.max(6.5, (KINGS_H * H) / (2 * tan * bandH * 0.97), KINGS_HALF_W / (tan * aspect * 0.92));
  const centre = (band.top + band.bottom) / 2;
  const lookY = KINGS_H / 2 + ((centre - H / 2) * 2 * D * tan) / H;
  return { pos: v(0, lookY + (aspect < 1 ? 0.17 : 0.07) * D, D), look: v(0, lookY, 0) }; // a little from above, so the floor glow never flattens into a line
}
addEventListener('resize', measureBands);
document.fonts?.ready.then(measureBands);
measureBands();

function tick(dt, t, pointer) {
  progress = reducedMotion() ? target : progress + (target - progress) * (1 - Math.exp(-dt * 6));
  aimAt(SAGA[Math.max(0, sagaScene)].focus); // (re-aimed every frame so a resize is picked up)
  const glide = reducedMotion() ? 1 : 1 - Math.exp(-dt * 2.6);
  sagaCam.x += (sagaAim.x - sagaCam.x) * glide; sagaCam.z += (sagaAim.z - sagaCam.z) * glide;
  const p = progress, wide = innerWidth > 900;
  // kings part like curtains, then return for the finale
  // the kings part on the way down; at the last chapter they charge back in and clash again
  const finale = target >= 6.5 && p >= 6.35;
  if (finale && !inFinale) st.replay();
  inFinale = finale;
  const split = finale ? 0 : smooth(ramp(p, 0.08, 0.85));
  st.spread = split * 7.5;
  placeTags();
  // the board rises from below
  const boardIn = smooth(ramp(p, 0.35, 1.0)) * (1 - smooth(ramp(p, 2.92, 3.22)));
  rig.group.visible = boardIn > 0.002;
  rig.group.position.set(wide ? 3.4 : 0, -5 * (1 - boardIn), 0);
  rig.group.scale.setScalar(wide ? 0.82 : 0.9);
  rig.group.rotation.y = (1 - boardIn) * 0.8;
  rig.tick(performance.now());
  // a single piece on a pedestal
  const exIn = smooth(ramp(p, 3.0, 3.3)) * (1 - smooth(ramp(p, 3.8, 4.2)));
  exhibit.visible = exIn > 0.002;
  exhibit.position.set(wide ? 2.5 : 0, -3.5 * (1 - exIn), 0);
  exhibitPiece.rotation.y += reducedMotion() ? 0 : dt * 0.45;
  exhibit.scale.setScalar(1.35);
  // camera
  const shot = shotAt(p, wide);
  const k = rig.shake * rig.shake * 0.12;
  st.camera.position.set(shot.pos.x + pointer.x * 0.5 + (Math.random() - 0.5) * k, shot.pos.y - pointer.y * 0.25 + (Math.random() - 0.5) * k, shot.pos.z);
  st.camera.lookAt(shot.look.x, shot.look.y, shot.look.z);
}

// The Ivory / Obsidian name plates follow the kings on screen.
const tags = [...document.querySelectorAll('.side-tag')], versusSec = chapters[0];
function placeTags() {
  if (!tags.length) return;
  const fade = 1 - ramp(progress, 0.05, 0.35);
  tags.forEach((t) => { t.style.opacity = fade.toFixed(3); t.style.visibility = fade > 0.01 ? 'visible' : 'hidden'; });
  if (fade <= 0.01 || innerWidth < 761) return;
  st.duel.updateMatrixWorld(); st.camera.updateMatrixWorld();
  const top = versusSec.getBoundingClientRect().top;
  // beside each king, on its outer flank, at chest height
  [[st.white, -1.05], [st.black, 1.05]].forEach(([king, out], k) => {
    const p = st.project(king.position.x + out, 1.25, 0);
    tags[k].style.left = `${p.x}px`; tags[k].style.top = `${p.y - top}px`;
  });
  document.body.classList.add('tags-placed');
}

// ---------------------------------------------------------------------------
// The court: piece descriptions and move diagrams
const COURT = {
  K: ['The King', 'The heart of the kingdom. One square in any direction. Lose him and the war is over.'],
  Q: ['The Queen', 'The most powerful piece on the board. Any distance along ranks, files and diagonals.'],
  R: ['The Rook', 'The tower. Any distance along a rank or a file, and the king’s partner in castling.'],
  B: ['The Bishop', 'The long view. Any distance along the diagonals, bound to one colour for life.'],
  N: ['The Knight', 'The only piece that leaps: two squares one way and one to the side, over anything in its path.'],
  P: ['The Pawn', 'Small beginnings. One square forward, two on its first move, captures diagonally, and is crowned on the far rank.'],
};
function drawDiagram(k) {
  const d = $('diagram'); d.replaceChildren();
  const c = 3;
  for (let r = 0; r < 7; r++) for (let f = 0; f < 7; f++) {
    const cell = document.createElement('i');
    const dr = c - r, df = f - c;
    let go = false, jump = false;
    if (k === 'K') go = Math.max(Math.abs(dr), Math.abs(df)) === 1;
    if (k === 'R' || k === 'Q') go ||= (dr === 0) !== (df === 0);
    if (k === 'B' || k === 'Q') go ||= Math.abs(dr) === Math.abs(df) && dr !== 0;
    if (k === 'N') jump = (Math.abs(dr) === 2 && Math.abs(df) === 1) || (Math.abs(dr) === 1 && Math.abs(df) === 2);
    if (k === 'P') { go = df === 0 && dr === 1; jump = dr === 1 && Math.abs(df) === 1; }
    if (go) cell.className = 'go';
    if (jump) cell.className = 'go jump';
    if (r === c && f === c) { cell.className = 'me'; cell.style.backgroundImage = `url(/static/img/flat/w${k}.svg)`; }
    d.append(cell);
  }
  d.setAttribute('aria-label', `${COURT[k][0]}: the dots show where it can move from the centre${k === 'P' ? '; gold dots are its captures' : k === 'N' ? '; it jumps' : ''}.`);
}
document.querySelectorAll('.picker [data-piece]').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.piece;
  document.querySelectorAll('.picker [data-piece]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  $('court-title').textContent = COURT[k][0];
  $('court-text').textContent = COURT[k][1];
  drawDiagram(k);
  if (exhibitPiece) exhibitPiece.geometry = st.geos[k];
}));
drawDiagram('K');

// ---------------------------------------------------------------------------
// Daily puzzle: mate in one (any mating move counts)
const PUZZLES = [
  ['6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'The back rank'],
  ['r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'The oldest trap'],
  ['6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', 'Smothered'],
  ['7k/7p/5N2/8/8/8/8/6RK w - - 0 1', 'Knight and rook'],
  ['7k/5Q2/6K1/8/8/8/8/8 w - - 0 1', 'Queen and king'],
];
let pIndex = Math.floor(Date.now() / 86400000) % PUZZLES.length, pState, pSel = null, pSolved = false;
const pBoard = new FlatBoard($('puzzle-board'), {
  mini: true,
  onSquare: (i, o) => puzzleSquare(i, o),
  onDrop: (a, b) => puzzleMove(a, b),
  canDrag: (i) => !pSolved && pState.b[i] && pState.b[i] === pState.b[i].toUpperCase(),
});
function puzzleTargets() {
  if (pSel === null) return [];
  return legal(pState).filter((m) => m[0] === pSel).map((m) => ({ i: m[1], capture: !!pState.b[m[1]] }));
}
function drawPuzzle(extra = {}) { pBoard.set(pState.b, { selected: pSel, targets: puzzleTargets(), ...extra }); }
function loadPuzzle() {
  const [fen, title] = PUZZLES[pIndex];
  pState = parseFen(fen); pSel = null; pSolved = false;
  $('puzzle-title').textContent = `Mate in one: ${title}`;
  $('puzzle-status').textContent = ''; $('puzzle-status').className = 'puzzle-status';
  drawPuzzle();
}
function puzzleSquare(i, o = {}) {
  if (pSolved) return;
  const p = pState.b[i];
  if (o.dragStart) { if (p && p === p.toUpperCase()) { pSel = i; drawPuzzle(); } return; }
  if (pSel !== null && legal(pState).some((m) => m[0] === pSel && m[1] === i)) return puzzleMove(pSel, i);
  pSel = p && p === p.toUpperCase() && pSel !== i ? i : null;
  drawPuzzle();
}
function puzzleMove(a, b) {
  const options = legal(pState).filter((m) => m[0] === a && m[1] === b);
  if (!options.length) { sfx('illegal'); pSel = null; drawPuzzle(); return; }
  const m = options.find((x) => x[2] === 'Q') || options[0];
  const next = apply(pState, m), san = toSan(pState, m), status = $('puzzle-status');
  if (check(next) && legal(next).length === 0) {
    pSolved = true; pSel = null; pState = next; sfx('win');
    status.textContent = `${san}. Checkmate: the war is won in one move.`; status.className = 'puzzle-status good';
    drawPuzzle({ last: [a, b], check: next.b.indexOf('k') });
  } else {
    sfx('illegal');
    status.textContent = `${san} is legal, but the black king escapes. Try again.`; status.className = 'puzzle-status bad';
    const before = pState; pState = next; pSel = null; drawPuzzle({ last: [a, b] });
    setTimeout(() => { if (!pSolved) { pState = before; drawPuzzle(); } }, 1100);
  }
}
$('puzzle-reset').onclick = loadPuzzle;
$('puzzle-next').onclick = () => { pIndex = (pIndex + 1) % PUZZLES.length; loadPuzzle(); };
loadPuzzle();

// ---------------------------------------------------------------------------
// Banner quiz: four questions → one of six great houses of Westeros
const QUIZ = [
  ['The horns sound. Where do you stand?', [
    ['On the walls, holding the line.', { rook: 2, king: 1 }],
    ['Already riding around the flank.', { knight: 2, queen: 1 }],
    ['Far behind, watching the whole field.', { bishop: 2, king: 1 }],
    ['In the front rank, beside everyone else.', { pawn: 2, rook: 1 }]]],
  ['What do you value most?', [
    ['Patience.', { pawn: 2, bishop: 1 }], ['Surprise.', { knight: 2 }],
    ['Power.', { queen: 2, rook: 1 }], ['Loyalty.', { king: 2, pawn: 1 }]]],
  ['Your rival makes a mistake. You…', [
    ['Strike at once, from anywhere on the board.', { queen: 2 }],
    ['Leap on it from an angle nobody expected.', { knight: 2 }],
    ['Close every escape route first.', { rook: 2, bishop: 1 }],
    ['Stay calm and keep your own king safe.', { king: 2 }]]],
  ['What does victory look like?', [
    ['A slow squeeze until they cannot move.', { bishop: 2, rook: 1 }],
    ['A humble start that ends with a crown.', { pawn: 3 }],
    ['One brilliant sacrifice.', { queen: 2, knight: 1 }],
    ['Still standing at the very end.', { king: 2, pawn: 1 }]]],
];
const signedIn = !!document.querySelector('.realm-nav .me');
let qStep = 0, tally = {};
function drawQuiz() {
  const body = $('quiz-body');
  if (qStep < QUIZ.length) {
    const [q, answers] = QUIZ[qStep];
    body.innerHTML = `<p class="quiz-step">Question ${qStep + 1} of ${QUIZ.length}</p><p class="quiz-q">${q}</p><div class="quiz-a"></div>`;
    for (const [text, score] of answers) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
      b.onclick = () => { for (const [h, n] of Object.entries(score)) tally[h] = (tally[h] || 0) + n; qStep++; sfx('move'); drawQuiz(); };
      body.querySelector('.quiz-a').append(b);
    }
    if (qStep > 0) body.querySelector('button').focus({ preventScroll: true });
    return;
  }
  const order = Object.keys(houses);
  const key = order.reduce((best, h) => ((tally[h] || 0) > (tally[best] || 0) ? h : best), order[0]);
  const h = houses[key];
  sfx('promote');
  body.innerHTML = `<div class="quiz-result"><span class="crest">${crestSVG({ field: h.field, metal: h.metal, piece: h.piece, photo: h.sigil })}</span>
    <div><h3 style="font-size:1.6rem">${h.name}</h3><p class="help" style="margin:2px 0 0">Seat: ${h.seat}</p><p class="saying">“${h.words}”</p>
    <div class="cta" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px"><a class="btn btn-gold" href="${signedIn ? '/profile/?house=' : '/signup/?house='}${key}">${signedIn ? 'Raise this banner' : 'Join under this banner'}</a>
    <button class="btn" type="button" id="quiz-again">Take it again</button></div></div></div>`;
  $('quiz-again').onclick = () => { qStep = 0; tally = {}; drawQuiz(); };
}
drawQuiz();

// ---------------------------------------------------------------------------
if (webglAvailable()) init3d().then(readScroll).catch((e) => { console.warn('3D scene unavailable:', e); st = null; startFallback(); });
else startFallback();
function startFallback() {
  $('saga-flat').hidden = false;
  sagaFlat = new FlatBoard($('saga-flat'), { mini: true });
  sagaFlat.set(SAGA[0].states[0].b, { hint: SAGA[0].hint }); readScroll();
}
readScroll();
// read-only hooks for the automated browser checks
window.__home = { get progress() { return progress; }, get target() { return target; }, get scene() { return sagaScene; }, get ply() { return sagaPly; }, get intro() { return !!st?.introDone; } };
