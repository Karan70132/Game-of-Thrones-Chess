# Game of Thrones Chess

**A 3D chess game in the browser, built on top of my C++ object-oriented chess engine, with a neural-network opponent trained on 20 million Stockfish-analysed positions.**

It started as a console chess program written in C++ (classes for every piece, a board, move validation). This project turns it into a full website: a 3D and 2D board, user accounts, four computer opponents up to a deep-searching "Night King", a scroll-driven home page themed on the world of Westeros, and a GPU training pipeline for the opponent's position evaluator.

> Fan-made, non-commercial project. Not affiliated with HBO or the *Game of Thrones* series.

---

## Features

**Play**
- Rotatable **3D board** (three.js) with high-detail marble pieces, move arcs, capture shatter effects, check and checkmate animations
- **2D board** in a familiar online-chess style, with move dots, last-move highlights and drag-and-drop
- Full chess rules: castling, en passant, promotion, check, checkmate, stalemate, repetition, fifty-move rule, insufficient material
- Hints, take-back, resign, opening names (50+ openings), evaluation bar, captured pieces, light and dark themes, four board colours

**Four opponents**

| Rival | How it plays |
|---|---|
| 1. The Squire | Looks one move ahead |
| 2. The Knight Errant | Looks two moves ahead |
| 3. The Old Lord | Looks three moves ahead |
| 4. **The Night King** | Opening book, then a 5-second iterative-deepening search with a transposition table, quiescence search, null-move pruning and late-move reductions, scored by the trained neural network |

In testing, the Night King won 4 out of 4 games against The Old Lord while thinking only 0.3 seconds a move.

**The world around the board**
- Animated home page: two kings face off in front of a wall of fire, then the board rises as you scroll
- *Chapter II: The war on the board*: five turning points from the series, each replayed on the 3D board as the chess tactic it resembles (pin, discovered attack, smothered mate, knight fork, underpromotion)
- Daily puzzle, a house quiz, accounts with a house (Stark, Lannister, Targaryen, Baratheon, Greyjoy, Tyrell), a title, an avatar and a win/loss record
- **Origins** page: the original nine C++ source files, each shown with its own 3D sculpture made in Blender

**AI**
- Neural position evaluator trained on an NVIDIA A100 and run directly in the browser (no server needed during play)
- Optional LLM coach that explains suggested moves (local Ollama model, or a built-in browser model where available)

---

## The neural network

| | |
|---|---|
| Data | 20,000,000 positions from the Lichess evaluation database (Stockfish analyses, depth 18+, CC0) |
| Network | 768 inputs (12 piece types × 64 squares, from the side to move's view) → 256 → 32 → 1, clipped ReLU, plus a piece-square skip connection initialised to material values |
| Training | PyTorch on an A100 GPU, 12 epochs, loss on win-probability scale (sigmoid of centipawns / 400) |
| Result | **150.6 cp** average error on 200,000 held-out positions, against **239.7 cp** for counting material alone (37% lower) |
| In the browser | Plain JavaScript, about 200,000 weights loaded from `models/rook-eval.json` |

The trainer, notebook and step-by-step guide are in `training/` and [`TRAINING.md`](TRAINING.md). A model that predicts worse than counting material is automatically ignored by the game.

---

## Run it locally (Ubuntu)

Requirements: Python 3.10+, and Node.js 18+ for the engine checks.

```bash
sudo apt install -y python3-venv nodejs
bash run.sh
```

Open **http://127.0.0.1:8000**, click **Join**, create an account, and play. `run.sh` creates the virtual environment, installs the requirements, applies migrations and starts the server.

### Checks

```bash
python manage.py test                              # Django: pages, accounts, profiles, results
node scripts/check-engine.mjs models/rook-eval.json  # move generation (perft) and Robo's replies
node scripts/check-deep.mjs models/rook-eval.json    # Night King: perft, tactics, browser/trainer agreement
node scripts/check-saga.mjs                        # the five Chapter II scenes are legal
```

### The original console game

```bash
g++ -std=c++17 original/*.cpp -o chess-console
./chess-console
```

---

## How the C++ engine reaches the browser

`scripts/build_rules.py` reads the piece classes in `original/chess_arsenal.cpp` and generates `dist/rules.mjs`, so the website's move validation comes straight from the original C++ logic. `dist/engine.mjs` adds check, checkmate and draw detection on top. The Night King uses a separate fast move generator (`dist/deep.mjs`) that is verified move-for-move against it.

---

## Project structure

| Path | What it is |
|---|---|
| `original/` | The original C++ OOP console chess program |
| `dist/engine.mjs`, `dist/rules.mjs` | Chess rules in JavaScript, generated from the C++ validators |
| `dist/robot.mjs` | Rivals 1–3: alpha-beta search |
| `dist/deep.mjs` | Rival 4, the Night King: fast search and neural evaluation |
| `dist/worker.mjs` | Runs the search in a background thread |
| `dist/js/` | Front end: home page, play page, 3D board, 2D board, effects, sounds |
| `dist/css/realm.css` | All styles, light and dark themes |
| `kingdom/` | Player profiles: house, title, avatar, record |
| `rookroom/`, `templates/` | Django project, pages and APIs |
| `training/` | CPU trainer (Colab) and GPU trainer (A100) |
| `models/rook-eval.json` | The trained evaluator |
| `web/` | Blender and asset-generation scripts |
| `render.yaml` | Deployment configuration for Render |

---

## Deploy

The repository includes `render.yaml`. On [Render](https://render.com): **New → Blueprint**, connect this repository, and deploy. It creates a Python web service and a PostgreSQL database, and sets `ROOKROOM_ENV`, a generated `SECRET_KEY` and `DATABASE_URL` for you.

---

## Built with

Python · Django · JavaScript (ES modules, Web Workers) · three.js · PyTorch · NumPy · Blender · C++

Fonts: Cinzel, Cinzel Decorative, Cormorant Garamond, Manrope (SIL Open Font License). Training data: Lichess evaluation database (CC0). 3D library: three.js (MIT).

---

## Author

**Karan Reddy**: the original C++ OOP chess engine, and this web version built on it.
