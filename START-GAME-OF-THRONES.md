# Game of Thrones — chess experience

A complete Django project. Your Colab trainer, LLM coach, C++ archive and engine are unchanged; this version rebuilds the look and feel around them.

## Ubuntu: start from any directory

Open the extracted `Game-of-Thrones-Chess` folder in Files, right-click the empty space and choose **Open in Terminal**. Run:

```bash
bash run.sh
```

Open **http://127.0.0.1:8000/**. Leave the terminal running; Ctrl+C stops it. The script creates a virtual environment, installs the Python requirements and applies migrations (including the new player profiles). You do not need Node or Blender to run the website.

To keep accounts from an earlier copy, copy its `local.sqlite3` into this folder before running `bash run.sh` (it adds the new avatar column automatically).

## What changed in this version

- **Kings face-off.** The two kings now lean in toward each other like fighters squaring up. On arrival they charge in from the sides, clash with sparks and a metallic ring, recoil into their stance, and a gold VS medallion spins in between them. The Ivory/Obsidian name plates follow the kings on screen.
- **Chapter II is now Game of Thrones.** The Opera Game is gone. In its place: five turning points from the series, each replayed as the chess tactic it resembles, with the camera leaning over the squares where it happens:
  - Season 1 · Episode 9, *Baelor* — the pin
  - Season 2 · Episode 9, *Blackwater* — the discovered attack
  - Season 3 · Episode 9, *The Rains of Castamere* — the smothered mate (the king topples)
  - Season 6 · Episode 9, *Battle of the Bastards* — the knight fork
  - Season 8 · Episode 3, *The Long Night* — the underpromotion to a knight
  Season buttons jump between scenes; a label warns about spoilers. Every line is checked by `node scripts/check-saga.mjs`. The daily puzzle stays.
- **Sharper pieces.** A new high-detail piece set (`dist/pieces-hd.glb`, about 3–4× the detail of the old one) with marble and obsidian surfaces. The 3D views render above screen resolution for crisp edges and lower it automatically on slow devices. The flat-board pieces were re-rendered from the new set at 512 px with outlines, so they stay clear on light and dark squares.
- **Move animations.** Pieces arc and lean into their moves (knights leap higher), squash on landing and kick up dust. Captures shatter the taken piece into shards with sparks, a shockwave ring, a flash and a small camera shake. Checks pulse red; promotions call down a beam of light; a checkmated king topples over. A new game drops both armies onto the board rank by rank.
- **Opening names** appear above the move list (Italian Game, Sicilian: Najdorf, Queen's Gambit Declined and about 50 more).
- **C++ origins page:** each of the nine source files now has its own 3D sculpture (a gateway for main.cpp, six plinths for chess_arsenal.cpp, an attack compass for helpers.cpp…) that turns slowly and can be orbited, with a short explanation and a thumbnail strip of all nine. The sculptures come from the Blender script `web/render_origins.py`.
- **Update 3.1 (your feedback):** the kings are framed automatically into the space above the title (and above the finale text), so nothing overlaps on any screen; the VS mark is now a fine gold ring with engraved lettering instead of a heavy coin; the Chapter II footnote sits inside the card; the Join button and grey text are easier to read in dark mode; the play page gives the board the whole window (moves on the right, rival and colours folded into "Rival & board", plus a Full screen button).
- **Version 4.0:** a fourth rival, **The Night King** (hardest): opening book, then a deep timed search about 10–15 moves ahead, using your trained network. A new A100 trainer (`training/Rookroom_A100.ipynb`, `training/train_gpu.py`) learns from the Lichess database of Stockfish evaluations. Step-by-step guide: `TRAINING.md`.
- **Update 3.8:** the avatar list now holds only the 14 character portraits; the silhouette avatars are gone (accounts that used one show their house sigil instead). The "House sigil" tile was removed from the avatar list too; with no avatar chosen, your crest shows your house sigil.
- **Update 3.6:** your images are in. Houses show their sigils (wolf, lion, dragon, stag, kraken, rose) on every crest, and House Arryn became House Greyjoy (Pyke, "We do not sow.") to match the kraken. Avatars now include Jon Snow, Daenerys Targaryen, Tyrion Lannister, Arya Stark, Sansa Stark, Eddard Stark, Cersei Lannister, Jaime Lannister, Tywin Lannister, Bran Stark, Oberyn Martell, Jorah Mormont, Samwell Tarly and the Night King. Files: `dist/img/houses/` and `dist/img/avatars/*.webp`.
  - Note: the sigils are HBO's designs and the portraits show the actors' likenesses. If the repo or site is public, consider adding `dist/img/houses/` and `dist/img/avatars/*.webp` to `.gitignore` along with `dist/audio/saga/` (the crests would then show only the house colours).
- **Update 3.5:** the houses are now the great houses of Westeros, with their seats, words and colours: Stark (Winterfell, "Winter is coming."), Lannister (Casterly Rock, "Hear me roar!"), Targaryen (Dragonstone, "Fire and blood."), Baratheon (Storm's End, "Ours is the fury."), Arryn (The Eyrie, "As high as honour."), Tyrell (Highgarden, "Growing strong."). Titles use Westeros offices (Hand of the King, Lord Commander, Master of Whisperers…), and avatars are named for its roles (Kingsguard Knight, Ranger of the Night's Watch, Maester of the Citadel…). Existing accounts keep their house; only the names changed.
- **Update 3.4:**
  - Chapter II now plays your own audio clips (`dist/audio/saga/`): Baelor → "Winter is coming", Blackwater → "Hear me roar", The Rains of Castamere → "The North remembers", Battle of the Bastards → "The King in the North", The Long Night → "Not today". The browser voice is only a fallback if a clip is missing.
  - Flat board restyled like the big chess sites: chunkier flat pieces, chess.com greens (#ebecd0 / #739552), solid yellow-green last-move and selected squares.
  - Note: the clips are recordings from HBO's series. They are fine on your own machine, but publishing them on a public GitHub repo or website can break HBO's copyright. To leave them out of GitHub, add `dist/audio/saga/` to `.gitignore`.
- **Update 3.3:** the flat board now uses a clean 2D piece set in the style of online chess sites (drawn for this project by `web/make_flat_pieces.py`). Pieces sit fully inside their squares, move dots are soft grey circles, and the coordinates are larger. The same pieces are used for puzzles, captured pieces and promotion.
- **Update 3.2:**
  - The VS mark is gone; a wall of fire now rises behind the kings, with embers drifting up the whole screen. The fire flares when the kings clash.
  - Chapter II no longer takes over scrolling: it is one screen, and nothing plays until you pick a season tile (S1·E9 … S8·E3). Then the scene plays by itself (Play/Pause, Back, Next). Scroll past it any time.
  - Each scene opens with its soundscape and one famous line from the series (for example “Winter is coming.”), spoken by your browser's built-in voice, slowed and deepened. Recordings of the actors are not included.
  - The last chapter is back to the big kings behind the closing words, and they charge in and clash (with sound) when you reach it.
  - Avatars: pick one of eight original portraits (The Sentinel, The Crowned Queen, The Old King, The Ranger, The Shield-Maiden, The Sage, The Sellsword, The Tower Warden) when you sign up or on your profile. It shows on your crest everywhere. An uploaded picture still takes priority. Choosing a house or avatar rings a blade.
- **Chapter II sound & narration (3.1):** a button on the card turns on an original soundscape for each scene (bell tolls, wildfire, war drums, horn and hooves, winter wind and steel) and has the browser's built-in voice read the scene and each move aloud. Captures there ring like blades.
- **Sounds:** a clash for the kings and a shard crackle on captures.

The show's characters, actor photos and house sigils are still not included: they are HBO's artwork and people's likenesses. The series appears through its episodes, retold in our own words, and the original houses stay.

## Optional tools (not needed to run the site)

- `web/hd/export.html` rebuilds `dist/pieces-hd.glb` in a browser; `web/hd/render_sprites.py` re-renders the flat-board images (needs Playwright and Chrome, with `python3 -m http.server 8767` running in this folder).
- `web/hd/render_duel_blender.py` renders the kings' duel in Blender Cycles for the no-WebGL fallback image: `blender -b -P web/hd/render_duel_blender.py`.

## Checks

```bash
.venv/bin/python manage.py test
node scripts/check-engine.mjs
node scripts/check-saga.mjs
```

For GitHub, commit the source, not `.venv/`, `.local-key`, database files, passwords or API keys.
