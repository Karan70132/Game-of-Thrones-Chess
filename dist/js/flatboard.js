// Flat board: a perfectly square 8×8 grid that shows rendered sculptures of each piece.
// Click-to-move and drag-to-move, keyboard accessible (each square is a button).
import { pieceImage } from './ui.js';

const NAMES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };
const sqName = (i) => 'abcdefgh'[i % 8] + (1 + (i >> 3));

export class FlatBoard {
  constructor(host, { onSquare, onDrop, canDrag = () => false, mini = false } = {}) {
    this.host = host;
    this.onSquare = onSquare; this.onDrop = onDrop; this.canDrag = canDrag;
    this.el = document.createElement('div');
    this.el.className = 'flat' + (mini ? ' mini' : '');
    this.el.setAttribute('role', 'grid');
    this.el.setAttribute('aria-label', 'Chessboard');
    this.squares = [];
    for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) {
      const i = r * 8 + f;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sq' + ((r + f) % 2 === 0 ? ' dk' : '');
      b.dataset.i = i;
      if (f === 0) b.insertAdjacentHTML('beforeend', `<span class="co rk">${r + 1}</span>`);
      if (r === 0) b.insertAdjacentHTML('beforeend', `<span class="co fl">${'abcdefgh'[f]}</span>`);
      // keyboard activation (pointer input is handled below)
      b.addEventListener('click', (e) => { if (e.detail === 0) this.onSquare?.(i); });
      this.squares[i] = b;
      this.el.append(b);
    }
    host.append(this.el);
    this._bindPointer();
  }

  set(board, { selected = null, targets = [], last = null, hint = null, check = null } = {}) {
    this.board = board;
    const tgt = new Map(targets.map((t) => [t.i, t]));
    for (let i = 0; i < 64; i++) {
      const sq = this.squares[i], p = board[i];
      let img = sq.querySelector('img.pc');
      if (p) {
        const src = pieceImage(p);
        if (!img) { img = document.createElement('img'); img.className = 'pc'; img.alt = ''; img.draggable = false; sq.append(img); }
        if (img.dataset.p !== p) { img.src = src; img.dataset.p = p; }
      } else if (img) img.remove();
      const t = tgt.get(i);
      sq.classList.toggle('sel', selected === i);
      sq.classList.toggle('to', !!t);
      sq.classList.toggle('cap', !!t && !!t.capture);
      sq.classList.toggle('last', !!last && last.includes(i));
      sq.classList.toggle('hint', !!hint && hint.includes(i));
      sq.classList.toggle('check', check === i);
      const who = p ? `${p === p.toUpperCase() ? 'white' : 'black'} ${NAMES[p.toUpperCase()]}` : 'empty';
      sq.setAttribute('aria-label', `${sqName(i)}, ${who}${t ? ', legal move' : ''}`);
    }
  }

  _bindPointer() {
    let down = null, ghost = null;
    const squareAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('.sq');
    this.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const sq = e.target.closest('.sq'); if (!sq) return;
      down = { i: +sq.dataset.i, x: e.clientX, y: e.clientY, drag: false };
      this.el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    this.el.addEventListener('pointermove', (e) => {
      if (!down) return;
      if (!down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 && this.board?.[down.i] && this.canDrag(down.i)) {
        down.drag = true;
        this.onSquare?.(down.i, { dragStart: true });
        const size = this.squares[down.i].getBoundingClientRect().width;
        ghost = document.createElement('img');
        ghost.className = 'drag-ghost'; ghost.src = pieceImage(this.board[down.i]);
        ghost.style.width = ghost.style.height = `${size}px`;
        document.body.append(ghost);
        this.squares[down.i].classList.add('dragging');
      }
      if (ghost) { ghost.style.left = `${e.clientX}px`; ghost.style.top = `${e.clientY}px`; }
    });
    const finish = (e) => {
      if (!down) return;
      const start = down; down = null;
      if (ghost) { ghost.remove(); ghost = null; }
      this.squares[start.i].classList.remove('dragging');
      const over = squareAt(e.clientX, e.clientY);
      const j = over && this.el.contains(over) ? +over.dataset.i : null;
      if (start.drag) { if (j !== null && j !== start.i) this.onDrop?.(start.i, j); }
      else if (j !== null) this.onSquare?.(j);
    };
    this.el.addEventListener('pointerup', finish);
    this.el.addEventListener('pointercancel', () => { down = null; ghost?.remove(); ghost = null; });
  }
}
