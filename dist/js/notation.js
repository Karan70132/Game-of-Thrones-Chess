// Standard algebraic notation (SAN) and FEN for the project's engine (engine.mjs).
// Board index 0 = a1 … 63 = h8; pieces are 'K','q', … and 0 for empty.
import { legal, apply, check, square } from '../engine.mjs';

export function toSan(s, m) {
  const [i, j, promo] = m;
  const p = s.b[i], type = p.toUpperCase();
  let text;
  if (type === 'K' && Math.abs(i - j) === 2) text = j > i ? 'O-O' : 'O-O-O';
  else {
    const capture = !!s.b[j] || (type === 'P' && i % 8 !== j % 8);
    if (type === 'P') text = (capture ? 'abcdefgh'[i % 8] + 'x' : '') + square(j) + (promo ? '=' + promo.toUpperCase() : '');
    else {
      const twins = legal(s).filter((o) => o[1] === j && o[0] !== i && s.b[o[0]] === p);
      let dis = '';
      if (twins.length) {
        const sameFile = twins.some((o) => o[0] % 8 === i % 8), sameRank = twins.some((o) => o[0] >> 3 === i >> 3);
        dis = !sameFile ? 'abcdefgh'[i % 8] : !sameRank ? String((i >> 3) + 1) : square(i);
      }
      text = type + dis + (capture ? 'x' : '') + square(j);
    }
  }
  const next = apply(s, m);
  if (check(next)) text += legal(next).length ? '+' : '#';
  return text;
}

export function fromSan(s, san) {
  const clean = (x) => x.replace(/[+#!?]/g, '');
  return legal(s).find((m) => clean(toSan(s, m)) === clean(san)) || null;
}

export function parseFen(fen) {
  const [rows, turn = 'w', castle = '-', ep = '-'] = fen.trim().split(/\s+/);
  const b = Array(64).fill(0);
  rows.split('/').forEach((row, r) => {
    let f = 0;
    for (const ch of row) { if (/\d/.test(ch)) f += +ch; else { b[(7 - r) * 8 + f] = ch; f++; } }
  });
  let rights = 0;
  if (castle.includes('K')) rights |= 1; if (castle.includes('Q')) rights |= 2;
  if (castle.includes('k')) rights |= 4; if (castle.includes('q')) rights |= 8;
  const epi = ep === '-' ? -1 : 'abcdefgh'.indexOf(ep[0]) + (Number(ep[1]) - 1) * 8;
  return { b, t: turn === 'w' ? 'W' : 'B', rights, ep: epi, half: 0 };
}

export const VALUE = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
