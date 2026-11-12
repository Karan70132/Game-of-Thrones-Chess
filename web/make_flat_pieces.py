"""Flat 2D piece set for the flat board, puzzles and captured pieces: python web/make_flat_pieces.py

Writes dist/img/flat/{w,b}{K,Q,R,B,N,P}.svg (viewBox 45 x 45, the usual size for chess piece art).
Original drawings in a clean, bold "online chess" style.
"""
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "dist" / "img" / "flat"


def base(x0=8.5, x1=36.5):
    w = x1 - x0
    return f'<path d="M{x0 + 1.6} 39.6 h{w - 3.2} a1.6 1.6 0 0 0 1.6-1.6 v-1 a2 2 0 0 0-2-2 h{-(w - 4)} a2 2 0 0 0-2 2 v1 a1.6 1.6 0 0 0 1.6 1.6z"/>'


def collar(y, x0=15, x1=30):
    w = x1 - x0
    return f'<path d="M{x0 + 1.6} {y} h{w - 3.2} a1.6 1.6 0 0 1 0 3.2 h{-(w - 3.2)} a1.6 1.6 0 0 1 0-3.2z"/>'


# Each piece: shapes (filled and outlined, back to front) and detail lines (drawn on top).
PIECES = {
    "P": ([
        '<path d="M17.6 23.4 C17.6 28.6 15.2 31.8 11.8 35.2 H33.2 C29.8 31.8 27.4 28.6 27.4 23.4 Z"/>',
        collar(20.4, 15.2, 29.8),
        '<circle cx="22.5" cy="13.2" r="5.6"/>',
        base(10.5, 34.5),
    ], []),
    "R": ([
        base(8.5, 36.5),
        '<path d="M14.6 18.6 H30.4 L31.6 32 H13.4 Z"/>',
        '<path d="M12.6 31.6 H32.4 A1.6 1.6 0 0 1 34 33.2 V35.4 H11 V33.2 A1.6 1.6 0 0 1 12.6 31.6Z"/>',
        '<path d="M13.4 15.4 H31.6 L30.2 18.8 H14.8 Z"/>',
        '<path d="M11.8 8.6 H16.2 V11.6 H19.6 V8.6 H25.4 V11.6 H28.8 V8.6 H33.2 V15.6 H11.8 Z"/>',
    ], ['M15 18.8 H30', 'M14 31.8 H31']),
    "B": ([
        '<path d="M17.4 26.4 C17.4 30.2 15 33 12.4 35.2 H32.6 C30 33 27.6 30.2 27.6 26.4 Z"/>',
        base(9.5, 35.5),
        collar(23.2, 15, 30),
        '<path d="M22.5 8.8 C16.2 13.2 15.2 19 16.8 23.4 H28.2 C29.8 19 28.8 13.2 22.5 8.8 Z"/>',
        '<circle cx="22.5" cy="6.6" r="2.4"/>',
    ], ['M25 13.2 L20.4 18.8']),
    "Q": ([
        '<path d="M15.4 28.8 C15.8 31.8 14 33.8 12.2 35.2 H32.8 C31 33.8 29.2 31.8 29.6 28.8 Z"/>',
        base(8.5, 36.5),
        collar(25.8, 13.4, 31.6),
        '<path d="M12.4 26.2 L9.6 14.6 L15.4 21.4 L16.2 10.6 L20.4 20.2 L22.5 8.6 L24.6 20.2 L28.8 10.6 L29.6 21.4 L35.4 14.6 L32.6 26.2 Z"/>',
        '<circle cx="9.6" cy="13.4" r="1.9"/>', '<circle cx="16.2" cy="9.4" r="1.9"/>', '<circle cx="22.5" cy="7.2" r="1.9"/>',
        '<circle cx="28.8" cy="9.4" r="1.9"/>', '<circle cx="35.4" cy="13.4" r="1.9"/>',
    ], ['M13.6 23.2 Q22.5 21.4 31.4 23.2']),
    "K": ([
        '<path d="M15.4 28.8 C15.8 31.8 14 33.8 12.2 35.2 H32.8 C31 33.8 29.2 31.8 29.6 28.8 Z"/>',
        base(8.5, 36.5),
        collar(25.6, 13.6, 31.4),
        '<path d="M22.5 11.8 C30.6 11.8 34.6 15.4 32.4 20.6 C31.6 22.6 30.8 24.2 30.2 25.8 H14.8 C14.2 24.2 13.4 22.6 12.6 20.6 C10.4 15.4 14.4 11.8 22.5 11.8 Z"/>',
        '<path d="M21.2 2.6 H23.8 V5.2 H26.4 V7.8 H23.8 V11.8 H21.2 V7.8 H18.6 V5.2 H21.2 Z"/>',
    ], ['M14 21.4 Q22.5 18.6 31 21.4', 'M22.5 11.8 V20']),
    "N": ([
        base(9.5, 35.5),
        '<path d="M12.6 35.4 C13.4 30.6 16 28 19.2 25.6 C20.2 24.6 20.6 23.6 20 22.4 C17.6 23.6 15 24.2 13 25.4 C11.4 26.2 9.4 25.8 8.6 24.2 C7.8 22.6 8.2 21 9.2 19.8 C11 17.4 14 15 16.4 13 C17.4 12 18.4 10.6 19.4 9.6 L18.8 5.6 L22.4 8.2 L24.6 5.4 L25.6 8.8 C31.4 10.4 35 16 34.4 24 C34.2 29 33.4 32.4 33 35.4 Z"/>',
    ], ['M27 11.4 C31 14 32.6 19 32.6 24.6', 'M29.4 15.4 C30.6 18 31 21 30.8 24']),
}
EYES = {"N": ['<ellipse cx="16.4" cy="15.6" rx="1.1" ry="1.3"/>', '<circle cx="10.4" cy="22" r=".75"/>']}

# Flat, chunky, online-chess look: solid fill with a soft side shade, one strong outline.
STYLE = {
    "w": dict(top="#ffffff", bottom="#dcdcdc", stroke="#312e2b", detail="#312e2b", eye="#312e2b"),
    "b": dict(top="#625f5c", bottom="#3d3a37", stroke="#22201e", detail="#9b9895", eye="#d9d6d2"),
}
WIDEN = {"K": 1.16, "Q": 1.12, "R": 1.12, "B": 1.1, "N": 1.06, "P": 1.14}


def svg(side, kind):
    st, (shapes, details) = STYLE[side], PIECES[kind]
    detail = "".join(f'<path d="{d}"/>' for d in details)
    eyes = "".join(EYES.get(kind, []))
    w = WIDEN[kind]
    # widen around the centre line and grow slightly from the base, so pieces fill the square like 2D sets do
    t = f"translate(22.5 41) scale({w} 1) translate(-22.5 -41)"
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset=".45" stop-color="{st['top']}"/><stop offset="1" stop-color="{st['bottom']}"/></linearGradient>
  </defs>
  <g transform="{t}">
    <g fill="url(#f)" stroke="{st['stroke']}" stroke-width="1.8" stroke-linejoin="round">{"".join(shapes)}</g>
    <g fill="none" stroke="{st['detail']}" stroke-width="1.3" stroke-linecap="round">{detail}</g>
    <g fill="{st['eye']}" stroke="none">{eyes}</g>
  </g>
</svg>
'''


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for side in "wb":
        for kind in PIECES:
            (OUT / f"{side}{kind}.svg").write_text(svg(side, kind))
    print("wrote 12 pieces to", OUT)
