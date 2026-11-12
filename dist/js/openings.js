// Opening names for the play page: the longest matching line wins.
// Lines are written in coordinate notation (from-square + to-square), the same format engine.mjs's code() uses.
const BOOK = [
  ['e2e4', "King's Pawn Opening"],
  ['e2e4 e7e5', 'Open Game'],
  ['e2e4 e7e5 g1f3', "King's Knight Opening"],
  ['e2e4 e7e5 g1f3 b8c6', "King's Knight Opening"],
  ['e2e4 e7e5 g1f3 b8c6 f1b5', 'Ruy Lopez'],
  ['e2e4 e7e5 g1f3 b8c6 f1b5 a7a6', 'Ruy Lopez: Morphy Defence'],
  ['e2e4 e7e5 g1f3 b8c6 f1b5 g8f6', 'Ruy Lopez: Berlin Defence'],
  ['e2e4 e7e5 g1f3 b8c6 f1c4', 'Italian Game'],
  ['e2e4 e7e5 g1f3 b8c6 f1c4 f8c5', 'Italian Game: Giuoco Piano'],
  ['e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4', 'Evans Gambit'],
  ['e2e4 e7e5 g1f3 b8c6 f1c4 g8f6', 'Two Knights Defence'],
  ['e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5', 'Two Knights Defence: Fried Liver territory'],
  ['e2e4 e7e5 g1f3 b8c6 d2d4', 'Scotch Game'],
  ['e2e4 e7e5 g1f3 b8c6 b1c3', 'Three Knights Game'],
  ['e2e4 e7e5 g1f3 b8c6 b1c3 g8f6', 'Four Knights Game'],
  ['e2e4 e7e5 g1f3 g8f6', 'Petrov Defence'],
  ['e2e4 e7e5 g1f3 d7d6', 'Philidor Defence'],
  ['e2e4 e7e5 f2f4', "King's Gambit"],
  ['e2e4 e7e5 f2f4 e5f4', "King's Gambit Accepted"],
  ['e2e4 e7e5 b1c3', 'Vienna Game'],
  ['e2e4 e7e5 f1c4', "Bishop's Opening"],
  ['e2e4 e7e5 d1h5', 'Wayward Queen Attack'],
  ['e2e4 c7c5', 'Sicilian Defence'],
  ['e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6', 'Sicilian: Najdorf Variation'],
  ['e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6', 'Sicilian: Dragon Variation'],
  ['e2e4 c7c5 b1c3', 'Sicilian: Closed'],
  ['e2e4 c7c5 c2c3', 'Sicilian: Alapin Variation'],
  ['e2e4 c7c5 d2d4', 'Sicilian: Smith-Morra Gambit'],
  ['e2e4 e7e6', 'French Defence'],
  ['e2e4 e7e6 d2d4 d7d5', 'French Defence'],
  ['e2e4 e7e6 d2d4 d7d5 e4e5', 'French Defence: Advance Variation'],
  ['e2e4 c7c6', 'Caro-Kann Defence'],
  ['e2e4 d7d5', 'Scandinavian Defence'],
  ['e2e4 g8f6', 'Alekhine Defence'],
  ['e2e4 d7d6', 'Pirc Defence'],
  ['e2e4 g7g6', 'Modern Defence'],
  ['e2e4 b8c6', 'Nimzowitsch Defence'],
  ['d2d4', "Queen's Pawn Opening"],
  ['d2d4 d7d5', 'Closed Game'],
  ['d2d4 d7d5 c2c4', "Queen's Gambit"],
  ['d2d4 d7d5 c2c4 d5c4', "Queen's Gambit Accepted"],
  ['d2d4 d7d5 c2c4 e7e6', "Queen's Gambit Declined"],
  ['d2d4 d7d5 c2c4 c7c6', 'Slav Defence'],
  ['d2d4 d7d5 c1f4', 'London System'],
  ['d2d4 g8f6 c1f4', 'London System'],
  ['d2d4 d7d5 g1f3 g8f6 c1f4', 'London System'],
  ['d2d4 g8f6', 'Indian Defence'],
  ['d2d4 g8f6 c2c4 g7g6', "King's Indian Defence"],
  ['d2d4 g8f6 c2c4 g7g6 b1c3 d7d5', 'Grünfeld Defence'],
  ['d2d4 g8f6 c2c4 e7e6 b1c3 f8b4', 'Nimzo-Indian Defence'],
  ['d2d4 g8f6 c2c4 e7e6 g1f3 b7b6', "Queen's Indian Defence"],
  ['d2d4 f7f5', 'Dutch Defence'],
  ['c2c4', 'English Opening'],
  ['g1f3', 'Réti Opening'],
  ['f2f4', "Bird's Opening"],
  ['b2b3', 'Nimzo-Larsen Attack'],
  ['g2g3', "King's Fianchetto Opening"],
];
const LINES = BOOK.map(([line, name]) => [line.split(' '), name]);

export function openingName(codes) {
  let best = null, len = 0;
  for (const [line, name] of LINES) {
    if (line.length > codes.length || line.length < len) continue;
    if (line.every((c, i) => codes[i] === c)) { best = name; len = line.length; }
  }
  return best;
}

// The Night King's opening book: a random continuation from the main lines above (never the Wayward Queen).
export function bookMove(codes) {
  if (codes.length >= 10) return null;
  const next = LINES.filter(([line, name]) => line.length > codes.length && !/Wayward|out of/i.test(name) && codes.every((c, i) => line[i] === c)).map(([line]) => line[codes.length]);
  return next.length ? next[Math.floor(Math.random() * next.length)] : null;
}
