// C++ origins page: syntax-highlight the original source and show a turnable sculpture.
import { webglAvailable } from './realm3d.js';

const KEYWORDS = new Set(('alignas auto bool break case catch char class const constexpr continue default delete do double else enum explicit extern '
  + 'false float for friend if inline int long namespace new nullptr operator override private protected public return short signed sizeof '
  + 'static struct switch template this throw true try typedef typename unsigned using virtual void while std string vector cout cin endl').split(' '));
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(^[ \t]*#[^\n]*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)/gm;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function highlight(code) {
  let out = '', last = 0;
  code.replace(TOKEN, (m, com, str, pre, num, fn, word, idx) => {
    out += esc(code.slice(last, idx));
    if (com) out += `<span class="t-com">${esc(m)}</span>`;
    else if (str) out += `<span class="t-str">${esc(m)}</span>`;
    else if (pre) out += `<span class="t-pre">${esc(m)}</span>`;
    else if (num) out += `<span class="t-num">${m}</span>`;
    else if (fn) out += KEYWORDS.has(fn) ? `<span class="t-kw">${fn}</span>` : `<span class="t-fn">${fn}</span>`;
    else if (KEYWORDS.has(word)) out += `<span class="t-kw">${word}</span>`;
    else if (/^[A-Z]/.test(word)) out += `<span class="t-ty">${word}</span>`;
    else out += word;
    last = idx + m.length;
    return m;
  });
  out += esc(code.slice(last));
  return out.split('\n').map((l) => `<span class="ln">${l || ' '}</span>`).join('');
}
const code = document.querySelector('#code code');
code.innerHTML = highlight(code.textContent);

// Each of the nine source files has its own sculpture (web/render_origins.py, Blender).
const EXHIBITS = {
  'main.cpp': ['The gateway', 'The way into the program. A stepped gateway stands for the menu, the game loop and the choice to play again.'],
  'game_board.cpp': ['The living board', 'An inlaid board with a knight’s path: making moves, switching turns, spotting check and drawing the console board.'],
  'game_board.h': ['Layers of a position', 'An exploded board: the Chess_Board interface with its pieces, captured pieces, king squares and move history.'],
  'chess_arsenal.cpp': ['The six disciplines', 'Six pieces on their own plinths: the movement rules of pawn, knight, bishop, rook, queen and king.'],
  'chess_arsenal.h': ['One family, six roles', 'A branching line of pieces: six classes that inherit one shared contract from Piece.'],
  'piece.h': ['The shared contract', 'A piece inside an open frame: the abstract Piece class and its virtual move and position functions.'],
  'piece.cpp': ['Identity in motion', 'Three brass orbits: each piece’s identity, its colour and the flag that remembers whether it has moved.'],
  'helpers.cpp': ['The attack compass', 'A compass of straight, diagonal and L-shaped paths: the helpers that work out which squares are attacked.'],
  'helpers.h': ['The common language', 'Brass brackets around shared declarations: attack checks, console symbols, colours and help text.'],
};
const host = document.getElementById('gallery-scene');
const file = host.dataset.file;
const [title, text] = EXHIBITS[file] || [file, 'Part of the original C++ chess program.'];
document.getElementById('sculpture-title').textContent = title;
document.getElementById('sculpture-description').textContent = text;
if (webglAvailable()) {
  import('./origins3d.js').then(({ mountSculpture }) => mountSculpture(host, file))
    .catch((e) => console.warn('3D sculpture unavailable, showing the rendered image:', e));
}
