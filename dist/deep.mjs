// "The Night King": the hardest rival. A separate, fast search used only for level 4.
// Same rules as engine.mjs (checked by scripts/check-deep.mjs with perft), but on a typed board with
// make/unmake, Zobrist hashing, a transposition table, iterative deepening on a time budget,
// quiescence search, null-move pruning, late-move reductions, killer and history move ordering.
// Evaluation: a rook-eval-v2 network trained on the GPU (training/train_gpu.py) when installed,
// otherwise hand-written piece-square tables (with a rook-eval-v1 model blended in at 25%).

const PIECE = { P: 1, N: 2, B: 3, R: 4, Q: 5, K: 6, p: -1, n: -2, b: -3, r: -4, q: -5, k: -6 };
const LETTER = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
const EP = 1, CASTLE = 2, DOUBLE = 4;
const RIGHTS_AT = new Uint8Array(64); RIGHTS_AT[0] = 2; RIGHTS_AT[7] = 1; RIGHTS_AT[56] = 8; RIGHTS_AT[63] = 4; RIGHTS_AT[4] = 3; RIGHTS_AT[60] = 12;
const VALUE = [0, 100, 320, 330, 500, 900, 0];
const MATE = 30000, INF = 32000, MAXPLY = 64;

// ---- precomputed attack tables -----------------------------------------------------------------
const KNIGHT = [], KING = [], RAYS = [];
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]; // [rank, file]; 0-3 straight, 4-7 diagonal
for (let sq = 0; sq < 64; sq++) {
  const r = sq >> 3, f = sq & 7, on = (y, x) => y >= 0 && y < 8 && x >= 0 && x < 8;
  KNIGHT[sq] = [[2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2], [1, -2], [2, -1]].filter(([a, b]) => on(r + a, f + b)).map(([a, b]) => (r + a) * 8 + f + b);
  KING[sq] = DIRS.filter(([a, b]) => on(r + a, f + b)).map(([a, b]) => (r + a) * 8 + f + b);
  RAYS[sq] = DIRS.map(([a, b]) => { const out = []; for (let k = 1; on(r + a * k, f + b * k); k++) out.push((r + a * k) * 8 + f + b * k); return out; });
}

// ---- Zobrist keys (two 32-bit halves) ---------------------------------------------------------
let seed = 0x9e3779b9;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
const ZL = new Uint32Array(13 * 64), ZH = new Uint32Array(13 * 64), CL = new Uint32Array(16), CH = new Uint32Array(16), EL = new Uint32Array(8), EH = new Uint32Array(8);
for (let i = 0; i < ZL.length; i++) { ZL[i] = rnd(); ZH[i] = rnd(); }
for (let i = 0; i < 16; i++) { CL[i] = rnd(); CH[i] = rnd(); }
for (let i = 0; i < 8; i++) { EL[i] = rnd(); EH[i] = rnd(); }
const SL = rnd(), SH = rnd();

// ---- position with make/unmake ---------------------------------------------------------------
export class Pos {
  constructor(s) {
    this.b = new Int8Array(64);
    for (let i = 0; i < 64; i++) this.b[i] = s.b[i] ? PIECE[s.b[i]] : 0;
    this.side = s.t === 'W' ? 1 : -1; this.rights = s.rights; this.ep = s.ep; this.half = s.half;
    this.king = [0, 0]; // [white, black]
    for (let i = 0; i < 64; i++) { if (this.b[i] === 6) this.king[0] = i; if (this.b[i] === -6) this.king[1] = i; }
    this.lo = 0; this.hi = 0;
    for (let i = 0; i < 64; i++) if (this.b[i]) { this.lo ^= ZL[(this.b[i] + 6) * 64 + i]; this.hi ^= ZH[(this.b[i] + 6) * 64 + i]; }
    if (this.side < 0) { this.lo ^= SL; this.hi ^= SH; }
    this.lo ^= CL[this.rights]; this.hi ^= CH[this.rights];
    if (this.ep >= 0) { this.lo ^= EL[this.ep & 7]; this.hi ^= EH[this.ep & 7]; }
    this.lo >>>= 0; this.hi >>>= 0;
    this.stack = [];
  }
  get key() { return (this.hi & 0x1fffff) * 4294967296 + (this.lo >>> 0); }
  put(sq, p) { this.b[sq] = p; this.lo ^= ZL[(p + 6) * 64 + sq]; this.hi ^= ZH[(p + 6) * 64 + sq]; }
  take(sq) { const p = this.b[sq]; this.b[sq] = 0; this.lo ^= ZL[(p + 6) * 64 + sq]; this.hi ^= ZH[(p + 6) * 64 + sq]; return p; }

  attacked(sq, by) {
    const b = this.b, f = sq & 7;
    if (by > 0) { if (f > 0 && sq >= 9 && b[sq - 9] === 1) return true; if (f < 7 && sq >= 7 && b[sq - 7] === 1) return true; }
    else { if (f < 7 && sq <= 54 && b[sq + 9] === -1) return true; if (f > 0 && sq <= 56 && b[sq + 7] === -1) return true; }
    for (const t of KNIGHT[sq]) if (b[t] === 2 * by) return true;
    for (const t of KING[sq]) if (b[t] === 6 * by) return true;
    const rays = RAYS[sq];
    for (let d = 0; d < 8; d++) {
      const ray = rays[d], slider = d < 4 ? 4 : 3;
      for (let k = 0; k < ray.length; k++) {
        const p = b[ray[k]];
        if (!p) continue;
        if (p === slider * by || p === 5 * by) return true;
        break;
      }
    }
    return false;
  }
  inCheck() { return this.attacked(this.king[this.side > 0 ? 0 : 1], -this.side); }

  // pseudo-legal moves: from | to << 6 | promo << 12 | flags << 16
  gen(capsOnly, out) {
    const b = this.b, us = this.side;
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq] * us;
      if (p <= 0) continue;
      if (p === 1) {
        const fwd = sq + 8 * us, last = us > 0 ? fwd >= 56 : fwd < 8, f = sq & 7;
        if (!b[fwd]) {
          if (last) { out.push(sq | fwd << 6 | 5 << 12); if (!capsOnly) for (const pr of [2, 3, 4]) out.push(sq | fwd << 6 | pr << 12); }
          else if (!capsOnly) {
            out.push(sq | fwd << 6);
            const startRank = us > 0 ? (sq >> 3) === 1 : (sq >> 3) === 6;
            if (startRank && !b[fwd + 8 * us]) out.push(sq | (fwd + 8 * us) << 6 | DOUBLE << 16);
          }
        }
        for (const df of [-1, 1]) {
          if (f + df < 0 || f + df > 7) continue;
          const to = fwd + df;
          if (b[to] * us < 0) {
            if (last) { out.push(sq | to << 6 | 5 << 12); if (!capsOnly) for (const pr of [2, 3, 4]) out.push(sq | to << 6 | pr << 12); }
            else out.push(sq | to << 6);
          } else if (to === this.ep && !b[to]) out.push(sq | to << 6 | EP << 16);
        }
      } else if (p === 2 || p === 6) {
        for (const to of (p === 2 ? KNIGHT : KING)[sq]) {
          const q = b[to] * us;
          if (q > 0 || (capsOnly && !q)) continue;
          out.push(sq | to << 6);
        }
        if (p === 6 && !capsOnly && sq === (us > 0 ? 4 : 60)) {
          const k = us > 0 ? 1 : 4, qs = us > 0 ? 2 : 8, rook = 4 * us;
          if ((this.rights & k) && !b[sq + 1] && !b[sq + 2] && b[sq + 3] === rook && !this.attacked(sq, -us) && !this.attacked(sq + 1, -us)) out.push(sq | (sq + 2) << 6 | CASTLE << 16);
          if ((this.rights & qs) && !b[sq - 1] && !b[sq - 2] && !b[sq - 3] && b[sq - 4] === rook && !this.attacked(sq, -us) && !this.attacked(sq - 1, -us)) out.push(sq | (sq - 2) << 6 | CASTLE << 16);
        }
      } else {
        const rays = RAYS[sq], d0 = p === 4 ? 0 : p === 3 ? 4 : 0, d1 = p === 3 ? 8 : p === 4 ? 4 : 8;
        for (let d = d0; d < d1; d++) {
          const ray = rays[d];
          for (let k = 0; k < ray.length; k++) {
            const to = ray[k], q = b[to] * us;
            if (q > 0) break;
            if (q < 0) { out.push(sq | to << 6); break; }
            if (!capsOnly) out.push(sq | to << 6);
          }
        }
      }
    }
    return out;
  }

  // returns false (and leaves the position unchanged) if the move would leave our king in check
  make(m) {
    const from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, flags = m >> 16, us = this.side, b = this.b;
    const piece = b[from];
    let captured = b[to], capSq = to;
    if (flags & EP) { capSq = to - 8 * us; captured = b[capSq]; }
    this.stack.push(captured, capSq, this.rights, this.ep, this.half, this.lo, this.hi);
    if (captured) this.take(capSq);
    this.take(from);
    this.put(to, promo ? promo * us : piece);
    if (flags & CASTLE) { const rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1; this.put(rt, this.take(rf)); }
    if (piece * us === 6) this.king[us > 0 ? 0 : 1] = to;
    this.lo ^= CL[this.rights]; this.hi ^= CH[this.rights];
    this.rights &= ~(RIGHTS_AT[from] | RIGHTS_AT[to]);
    this.lo ^= CL[this.rights]; this.hi ^= CH[this.rights];
    if (this.ep >= 0) { this.lo ^= EL[this.ep & 7]; this.hi ^= EH[this.ep & 7]; }
    this.ep = flags & DOUBLE ? (from + to) >> 1 : -1;
    if (this.ep >= 0) { this.lo ^= EL[this.ep & 7]; this.hi ^= EH[this.ep & 7]; }
    this.half = piece * us === 1 || captured ? 0 : this.half + 1;
    this.side = -us; this.lo ^= SL; this.hi ^= SH;
    this.lo >>>= 0; this.hi >>>= 0;
    this.stack.push(m);
    if (this.attacked(this.king[us > 0 ? 0 : 1], -us)) { this.unmake(); return false; }
    return true;
  }
  unmake() {
    const s = this.stack, m = s.pop(), hi = s.pop(), lo = s.pop(), half = s.pop(), ep = s.pop(), rights = s.pop(), capSq = s.pop(), captured = s.pop();
    const from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, flags = m >> 16, b = this.b;
    this.side = -this.side;
    const us = this.side;
    const piece = promo ? us : b[to];
    b[to] = 0; b[from] = piece;
    if (flags & CASTLE) { const rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1; b[rf] = b[rt]; b[rt] = 0; }
    if (captured) b[capSq] = captured;
    if (piece * us === 6) this.king[us > 0 ? 0 : 1] = from;
    this.rights = rights; this.ep = ep; this.half = half; this.lo = lo; this.hi = hi;
  }
  makeNull() { this.stack.push(this.ep, this.lo, this.hi); if (this.ep >= 0) { this.lo ^= EL[this.ep & 7]; this.hi ^= EH[this.ep & 7]; } this.ep = -1; this.side = -this.side; this.lo = (this.lo ^ SL) >>> 0; this.hi = (this.hi ^ SH) >>> 0; }
  unmakeNull() { this.hi = this.stack.pop(); this.lo = this.stack.pop(); this.ep = this.stack.pop(); this.side = -this.side; }
  legalMoves() { return this.gen(false, []).filter((m) => this.make(m) && (this.unmake(), true)); }
}

export function perft(pos, depth) {
  if (!depth) return 1;
  let n = 0;
  for (const m of pos.gen(false, [])) if (pos.make(m)) { n += perft(pos, depth - 1); pos.unmake(); }
  return n;
}

// ---- evaluation ------------------------------------------------------------------------------
// Piece-square tables (Tomasz Michniewski's "simplified evaluation function"), rank 8 first.
const T = {
  1: [0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
  2: [-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
  3: [-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
  4: [0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
  5: [-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
  6: [-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20],
  7: [-50,-40,-30,-20,-20,-30,-40,-50,-30,-20,-10,0,0,-10,-20,-30,-30,-10,20,30,30,20,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,30,40,40,30,-10,-30,-30,-10,20,30,30,20,-10,-30,-30,-30,0,0,0,0,-30,-30,-50,-30,-30,-30,-30,-30,-30,-50],
};
function handEval(b) { // white's point of view
  let mg = 0, phase = 0, wb = 0, bb = 0, wk = 0, bk = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p) continue;
    const t = p > 0 ? p : -p, idx = p > 0 ? (7 - (sq >> 3)) * 8 + (sq & 7) : sq;
    if (t === 6) { if (p > 0) wk = idx; else bk = idx; continue; }
    const v = VALUE[t] + T[t][idx];
    mg += p > 0 ? v : -v;
    phase += t === 2 || t === 3 ? 1 : t === 4 ? 2 : t === 5 ? 4 : 0;
    if (t === 3) { if (p > 0) wb++; else bb++; }
  }
  const g = Math.min(phase, 24) / 24;
  mg += Math.round(g * (T[6][wk] - T[6][bk]) + (1 - g) * (T[7][wk] - T[7][bk]));
  if (wb >= 2) mg += 30;
  if (bb >= 2) mg -= 30;
  return mg;
}

// rook-eval-v2: 768 → H1 → H2 → 1, clipped ReLU, plus an optional piece-square skip (psqt, 768 values);
// output × scale = centipawns for the side to move.
// rook-eval-v1: 768 → H → 1 (ReLU), output clamped to ±1, × 1000.
export function loadNet(model) {
  if (!model) return null;
  if (model.format === 'rook-eval-v2') {
    const H1 = model.l1.b.length, H2 = model.l2.b.length;
    const w1 = new Float32Array(768 * H1), w2 = new Float32Array(H1 * H2);
    model.l1.w.forEach((row, i) => w1.set(row, i * H1));
    model.l2.w.forEach((row, i) => w2.set(row, i * H2));
    return { v: 2, H1, H2, w1, b1: Float32Array.from(model.l1.b), w2, b2: Float32Array.from(model.l2.b), w3: Float32Array.from(model.out.w), b3: model.out.b, scale: model.scale || 400, psqt: model.psqt ? Float32Array.from(model.psqt) : null, acc: new Float32Array(H1), h2: new Float32Array(H2) };
  }
  if (model.format === 'rook-eval-v1') {
    const H = model.b.length, w1 = new Float32Array(768 * H);
    model.w.forEach((row, i) => w1.set(row, i * H));
    return { v: 1, H, w1, b1: Float32Array.from(model.b), w2: Float32Array.from(model.v), c: model.c, acc: new Float32Array(H) };
  }
  return null;
}
export function netEval(net, b, side) { // side to move's point of view, centipawns
  const white = side > 0, acc = net.acc, H = net.v === 2 ? net.H1 : net.H, w1 = net.w1, psqt = net.psqt;
  acc.set(net.b1);
  let skip = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p) continue;
    const plane = (p > 0 ? p : -p) - 1 + ((p > 0) === white ? 0 : 6), feature = plane * 64 + (white ? sq : sq ^ 56), off = feature * H;
    if (psqt) skip += psqt[feature];
    for (let j = 0; j < H; j++) acc[j] += w1[off + j];
  }
  if (net.v === 1) {
    let s = net.c;
    for (let j = 0; j < H; j++) if (acc[j] > 0) s += acc[j] * net.w2[j];
    return Math.max(-1, Math.min(1, s)) * 1000;
  }
  const H2 = net.H2, h2 = net.h2, w2 = net.w2;
  h2.set(net.b2);
  for (let j = 0; j < H; j++) {
    let a = acc[j];
    if (a <= 0) continue;
    if (a > 1) a = 1;
    const off = j * H2;
    for (let k = 0; k < H2; k++) h2[k] += a * w2[off + k];
  }
  let out = net.b3 + skip;
  for (let k = 0; k < H2; k++) { const a = h2[k]; if (a > 0) out += (a > 1 ? 1 : a) * net.w3[k]; }
  return Math.max(-2000, Math.min(2000, out * net.scale));
}

// ---- search ----------------------------------------------------------------------------------
export function think(s, { timeMs = 4000, model = null, prior = [], maxDepth = 64 } = {}) {
  const pos = new Pos(s), net = loadNet(model), started = Date.now(), deadline = started + timeMs;
  // a network that predicts worse than simply counting material is ignored here
  const m = model?.metrics, useful = !m || m.validation_mae_cp === undefined || m.validation_mae_cp < m.material_mae_cp;
  const netWeight = !net || !useful ? 0 : net.v === 2 ? 0.85 : 0.25;
  const TT = 1 << 19, mask = TT - 1;
  const ttLo = new Uint32Array(TT), ttHi = new Uint32Array(TT), ttMove = new Int32Array(TT), ttScore = new Int16Array(TT), ttDepth = new Int8Array(TT), ttFlag = new Uint8Array(TT);
  const killers = new Int32Array(MAXPLY * 2), history = new Int32Array(2 * 64 * 64);
  const hist = prior.map((p) => new Pos(p).key);
  hist.push(pos.key);
  let nodes = 0, stop = false, rootBest = 0;

  function evaluate() {
    const hand = handEval(pos.b) * pos.side;
    const v = netWeight ? (1 - netWeight) * hand + netWeight * netEval(net, pos.b, pos.side) : hand;
    return Math.round(v) + 10;
  }
  function repeated() {
    const n = hist.length, cur = hist[n - 1];
    for (let i = n - 3; i >= 0 && i >= n - 1 - pos.half; i -= 2) if (hist[i] === cur) return true;
    return false;
  }
  function order(moves, ttm, ply) {
    const scores = new Int32Array(moves.length), b = pos.b, side = pos.side > 0 ? 0 : 1;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i], from = m & 63, to = (m >> 6) & 63, victim = b[to] || (((m >> 16) & EP) ? 1 : 0);
      if (m === ttm) scores[i] = 1 << 30;
      else if (victim) scores[i] = 1e6 + VALUE[Math.abs(victim)] * 10 - VALUE[Math.abs(b[from])] / 10;
      else if ((m >> 12) & 7) scores[i] = 9e5 + ((m >> 12) & 7);
      else if (m === killers[ply * 2]) scores[i] = 8e5;
      else if (m === killers[ply * 2 + 1]) scores[i] = 7e5;
      else scores[i] = history[side * 4096 + from * 64 + to];
    }
    return scores;
  }
  function pick(moves, scores, i) {
    let best = i;
    for (let j = i + 1; j < moves.length; j++) if (scores[j] > scores[best]) best = j;
    if (best !== i) { const m = moves[i]; moves[i] = moves[best]; moves[best] = m; const s2 = scores[i]; scores[i] = scores[best]; scores[best] = s2; }
    return moves[i];
  }
  function tick() { if ((++nodes & 1023) === 0 && Date.now() > deadline) stop = true; return stop; }

  function quiesce(alpha, beta, ply) {
    if (tick()) return 0;
    const stand = evaluate();
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply >= MAXPLY - 1) return stand;
    const moves = pos.gen(true, []), scores = order(moves, 0, ply);
    for (let i = 0; i < moves.length; i++) {
      const m = pick(moves, scores, i), victim = pos.b[(m >> 6) & 63];
      if (!((m >> 12) & 7) && stand + VALUE[Math.abs(victim) || 1] + 200 < alpha) continue; // delta pruning
      if (!pos.make(m)) continue;
      const score = -quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (stop) return 0;
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function search(depth, alpha, beta, ply, canNull) {
    if (tick()) return 0;
    const inCheck = pos.inCheck();
    if (ply > 0) {
      if (pos.half >= 100 || repeated()) return 0;
      alpha = Math.max(alpha, -MATE + ply); beta = Math.min(beta, MATE - ply - 1);
      if (alpha >= beta) return alpha;
    }
    if (inCheck) depth++;
    if (depth <= 0 || ply >= MAXPLY - 1) return quiesce(alpha, beta, ply);
    const slot = pos.lo & mask, hit = ttLo[slot] === pos.lo && ttHi[slot] === pos.hi;
    const ttm = hit ? ttMove[slot] : 0;
    if (hit && ply > 0 && ttDepth[slot] >= depth) {
      let sc = ttScore[slot];
      if (sc > MATE - 200) sc -= ply; else if (sc < -MATE + 200) sc += ply;
      const fl = ttFlag[slot];
      if (fl === 0 || (fl === 1 && sc >= beta) || (fl === 2 && sc <= alpha)) return sc;
    }
    const pv = beta - alpha > 1;
    if (!pv && !inCheck) {
      const stat = evaluate();
      if (depth <= 3 && stat - 110 * depth >= beta) return stat; // reverse futility
      if (canNull && depth >= 3 && stat >= beta) {
        let pieces = 0;
        for (let i = 0; i < 64; i++) { const p = pos.b[i] * pos.side; if (p > 1 && p < 6) { pieces++; break; } }
        if (pieces) {
          pos.makeNull(); hist.push(pos.key);
          const sc = -search(depth - 3 - (depth > 6 ? 1 : 0), -beta, -beta + 1, ply + 1, false);
          hist.pop(); pos.unmakeNull();
          if (stop) return 0;
          if (sc >= beta) return beta;
        }
      }
    }
    const moves = pos.gen(false, []), scores = order(moves, ttm, ply);
    let legal = 0, best = -INF, bestMove = 0;
    const alpha0 = alpha, side = pos.side > 0 ? 0 : 1;
    for (let i = 0; i < moves.length; i++) {
      const m = pick(moves, scores, i), quiet = !pos.b[(m >> 6) & 63] && !((m >> 12) & 7) && !((m >> 16) & EP);
      if (!pos.make(m)) continue;
      hist.push(pos.key);
      legal++;
      let sc;
      if (legal === 1) sc = -search(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        const r = depth >= 3 && legal > 3 && quiet && !inCheck ? 1 + (legal > 9 ? 1 : 0) + (depth > 7 ? 1 : 0) : 0;
        sc = -search(depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
        if (sc > alpha && r) sc = -search(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (sc > alpha && sc < beta) sc = -search(depth - 1, -beta, -alpha, ply + 1, true);
      }
      hist.pop(); pos.unmake();
      if (stop) return 0;
      if (sc > best) {
        best = sc; bestMove = m;
        if (ply === 0) rootBest = m;
        if (sc > alpha) {
          alpha = sc;
          if (sc >= beta) {
            if (quiet) {
              if (killers[ply * 2] !== m) { killers[ply * 2 + 1] = killers[ply * 2]; killers[ply * 2] = m; }
              history[side * 4096 + (m & 63) * 64 + ((m >> 6) & 63)] += depth * depth;
            }
            break;
          }
        }
      }
    }
    if (!legal) return inCheck ? -MATE + ply : 0;
    let store = best;
    if (store > MATE - 200) store += ply; else if (store < -MATE + 200) store -= ply;
    ttLo[slot] = pos.lo; ttHi[slot] = pos.hi; ttMove[slot] = bestMove; ttScore[slot] = store; ttDepth[slot] = depth;
    ttFlag[slot] = best >= beta ? 1 : best > alpha0 ? 0 : 2;
    return best;
  }

  const rootMoves = pos.legalMoves();
  if (!rootMoves.length) return null;
  let move = rootMoves[0], score = 0, depth = 0;
  if (rootMoves.length === 1) { move = rootMoves[0]; score = evaluate(); }
  else {
    for (let d = 1; d <= maxDepth; d++) {
      rootBest = 0;
      const sc = search(d, -INF, INF, 0, false);
      if (stop) { break; }
      if (rootBest) { move = rootBest; score = sc; depth = d; }
      if (Math.abs(sc) > MATE - 200) break;
      if (Date.now() - started > timeMs * 0.5) break; // the next depth would not finish in time
    }
  }
  const from = move & 63, to = (move >> 6) & 63, promo = (move >> 12) & 7;
  return { move: promo ? [from, to, LETTER[promo]] : [from, to], score: score * pos.side, depth, nodes, ms: Date.now() - started };
}
