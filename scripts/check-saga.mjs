// Checks the five Game of Thrones scenes on the home page with the project's own engine.
// node scripts/check-saga.mjs
import { legal, apply, check } from '../dist/engine.mjs';
import { parseFen, toSan } from '../dist/js/notation.js';
const SCENES = [
  ['Baelor (pin)', '4k3/p4ppp/8/3p4/1b6/2N5/PP3PPP/4K3 b - - 0 1', ['d5d4', 'h2h3', 'd4c3']],
  ['Blackwater (discovered attack)', '3qk3/pp3ppp/8/4N3/8/8/5PPP/4R1K1 w - - 0 1', ['e5c6', 'd8e7', 'c6e7']],
  ['The Rains of Castamere (smothered mate)', 'r6k/6pp/7N/8/8/1Q6/8/6K1 w - - 0 1', ['b3g8', 'a8g8', 'h6f7']],
  ['Battle of the Bastards (fork)', 'q3k3/pp1ppppp/8/1N6/8/8/5PPP/6K1 w - - 0 1', ['b5c7', 'e8d8', 'c7a8']],
  ['The Long Night (underpromotion)', '8/3q1P1k/8/8/8/8/8/2K5 w - - 0 1', ['f7f8n', 'h7g7', 'f8d7']],
];
const sq = (u) => (u.charCodeAt(0) - 97) + (Number(u[1]) - 1) * 8;
let ok = true;
for (const [name, fen, moves] of SCENES) {
  let s = parseFen(fen); const out = [];
  for (const u of moves) {
    const m = legal(s).find((x) => x[0] === sq(u) && x[1] === sq(u.slice(2)) && (!u[4] || x[2] === u[4].toUpperCase()));
    if (!m) { ok = false; out.push(`ILLEGAL ${u}`); break; }
    out.push(toSan(s, m)); s = apply(s, m);
  }
  console.log(`${name}: ${out.join(' ')}${check(s) && !legal(s).length ? ' (mate)' : ''}`);
}
if (!ok) process.exit(1);
console.log('All five scenes are legal.');
