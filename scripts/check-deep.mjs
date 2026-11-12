// Checks the Night King's search (dist/deep.mjs): move generation against known perft counts and the
// project's own engine, then a few tactics. Usage: node scripts/check-deep.mjs [models/rook-eval.json]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pos, perft, think, loadNet, netEval } from '../dist/deep.mjs';
import { legal, apply, code, start } from '../dist/engine.mjs';
import { parseFen } from '../dist/js/notation.js';

const slow = (s, d) => (d ? legal(s).reduce((n, m) => n + slow(apply(s, m), d - 1), 0) : 1);
const CASES = [
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 4, 197281],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', 3, 97862],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', 4, 43238],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P1Nq/pP3PPP/R2Q1RK1 w kq - 0 1', 3, null], // promotions and castling: compared with the project engine
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', 3, 62379],
];
for (const [fen, d, n] of CASES) {
  const s = parseFen(fen);
  const fast = perft(new Pos(s), d);
  if (n !== null) assert.equal(fast, n, `perft ${fen}`);
  if (d <= 3) assert.equal(fast, slow(s, d), `project engine ${fen}`);
}
console.log('Move generation matches perft and the project engine');

const file = process.argv[2];
const model = file ? JSON.parse(readFileSync(file, 'utf8')) : null;
if (model) {
  const net = loadNet(model);
  assert(net, 'model format not recognised');
  console.log('Model loaded:', model.format, JSON.stringify(model.metrics || {}));
  // the trainer stores a few positions with the score Python computed: the browser must agree
  for (const { fen, cp } of model.samples || []) {
    const s = parseFen(fen), b = new Pos(s).b, js = netEval(net, b, s.t === 'W' ? 1 : -1);
    assert(Math.abs(js - cp) < 1, `browser ${js.toFixed(2)} vs trainer ${cp} for ${fen}`);
  }
  if (model.samples) console.log(`Browser and trainer agree on ${model.samples.length} sample positions`);
}
const TACTICS = [
  ['6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'd1d8', 'back-rank mate'],
  ['r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', 'h5f7', "scholar's mate"],
  ['q3k3/pp1ppppp/8/1N6/8/8/5PPP/6K1 w - - 0 1', 'b5c7', 'knight fork'],
  ['r6k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1', 'b3g8', 'smothered mate in 2'],
];
for (const [fen, want, name] of TACTICS) {
  const r = think(parseFen(fen), { timeMs: 1500, model });
  console.log(`${name}: ${code(r.move)} (depth ${r.depth}, ${r.nodes} nodes, ${r.ms} ms)`);
  assert.equal(code(r.move), want, name);
}
const r = think(start(), { timeMs: 1500, model });
assert(legal(start()).some((m) => code(m) === code(r.move)));
console.log(`Opening move ${code(r.move)} at depth ${r.depth}; ${Math.round(r.nodes / r.ms)}k nodes/s`);
console.log('Night King checks passed');
