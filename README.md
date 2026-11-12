# Rookroom 3D
Your C++ OOP chess project, a rotatable 3D board, a signed-in playroom, an optional LLM coach, and a chess evaluator you train on Google Colab.

## 1. Run the website on Ubuntu
Extract this ZIP. Open a terminal **inside Rookroom3D**, where you see manage.py. Use Python 3.10 or newer (3.12 recommended).

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Open **http://127.0.0.1:8000**. If Ubuntu reports the venv module is missing, install the venv package matching your Python version (for system Python, `sudo apt install python3-venv`), then repeat the commands. On later starts, activate the environment and run the last command.

## 2. Check the first game
Click **Join**, pick a username, a password and a house banner, and you land on the board. Click the e2 pawn (or drag it) to e4. Robo plays Black. In **3D** drag to orbit, scroll or pinch to zoom, and use **Angle view** or **Top view** (a perfectly square, straight-down board). **Flat** shows the same game on a square 2D board with rendered sculptures of every piece. Legal moves are dark dots with a white ring; captures are rings. **Get a hint**, **Explain with LLM**, **Take back**, **New game** and **Resign** sit beside the board, with your rival (look-ahead 1–3) and four board colours. The moon/sun button switches dark and light mode on every page. Your unfinished game, view, colours and theme are remembered in the browser; your house, title, picture and win/loss record are stored on the server (open your crest in the top bar).

Click **Origins** to browse the original nine files, including piece.h, chess_arsenal.cpp and game_board.cpp. This page is public. You can compile the console edition separately on Ubuntu.

```bash
g++ -std=c++17 original/*.cpp -o /tmp/rookroom-console
/tmp/rookroom-console
```

## 3. Train your own evaluator in Colab
1. Open https://colab.research.google.com/ and use **File → Upload notebook**. Select **training/Rookroom_Colab.ipynb** from this folder.
2. Select a **CPU** runtime. Run the cells from top to bottom. Approve the Google Drive mount in your own account.
3. Start with **GAMES = 10** for a wiring check. Each game has up to 60 half-moves. Stockfish labels positions using a 1,400-node search per position. A small neural network learns to approximate those scores. Completed games are cached under **MyDrive/Rookroom/training-v1/labels**.
4. The last cell downloads **rook-eval.json**. A copy stays under **MyDrive/Rookroom/training-v1**. If the browser blocks the download, download it directly from Drive.
5. For a larger experiment, change **GAMES** to **160** in the settings cell, rerun that cell, then rerun the training and download cells. After a runtime disconnect, run all cells again. The cache reuses completed games.
6. Record the printed **training_positions**, **validation_positions**, **validation_mae_cp** and **material_mae_cp**. Both errors are on held-out games with repeated board encodings removed. Lower is better. This measures score prediction in centipawns. Playing strength would require separate match results.

## 4. Connect the model to the website
Copy your downloaded file into **models/rook-eval.json** inside the project, using that exact filename. Refresh the playroom. Under **Game settings**, look for **Colab model active**. Make another move. Before that file exists, Robo plays using the bundled baseline. If the page reports a model load failure, sign in again, confirm the filename, and check that you copied the JSON output from the last cell.

The worker combines the neural position score (25%) with the existing handcrafted evaluation (75%) at the search leaves. The original opening preference is still applied at the root. The new model contains approximately 25,000 parameters. The scoring path uses plain JavaScript with the exported weights. No Colab connection is needed during play.

## 5. Try the optional LLM coach
With Ollama installed and running on your Ubuntu machine, run `ollama pull qwen2.5:3b`. Start the Django app on the same machine. In the playroom select **Get a hint → Explain with LLM**. The coach receives piece locations and the legal move selected by the engine. On a compatible browser a built-in model may handle the explanation first. Gaming and ordinary hints work independently. A remote deployment needs a reachable private Ollama service configured in server environment variables **OLLAMA_URL** and optionally **OLLAMA_MODEL**, or a compatible browser model. The public web server cannot use the Ollama instance on your laptop by default.

## 6. Put the project on GitHub
**New repository.** Create an empty GitHub repository named Rookroom-3D on your account, then run these commands from this folder. Replace YOUR_USERNAME with your actual GitHub username. Authenticate through your own Git credential manager or GitHub CLI.

```bash
git init -b main
git add .
git status --short
git commit -m "Add 3D chess playroom, accounts, C++ archive and Colab trainer"
git remote add origin https://github.com/YOUR_USERNAME/Rookroom-3D.git
git push -u origin main
```

**Existing Chess-Game-OOP repository.** Open your existing checkout and create a branch with `git switch -c feature/rookroom-3d`. Copy the extracted **Rookroom3D** folder into the checkout as a subdirectory. From the repository root run `git add Rookroom3D`, review `git status --short`, commit, then run `git push -u origin feature/rookroom-3d`. Open a pull request on GitHub. This preserves the old project layout and history. If using this layout on Render, use its manual Web Service setup below with **Root Directory = Rookroom3D**.

The ignore file excludes local credentials, virtual environments, session databases and node_modules. Include models/rook-eval.json once you have trained it. When updating an existing checkout, copy the project’s hidden .gitignore as well.

## 7. Deploy after GitHub
For a new repository with render.yaml at its root, open Render → **New → Blueprint**, connect the repository, review the web service and database plan, and deploy. Open the resulting HTTPS address, create your hosted account, and confirm the model status. Local test accounts stay in SQLite. The deployment creates new accounts in its PostgreSQL database. Confirm the offered plan and database retention before choosing it.

For the existing-repository layout, create a Render PostgreSQL database and a Python **Web Service** manually. Choose the same region and set **Root Directory** to **Rookroom3D**. Copy the build and start commands from render.yaml. Set **ROOKROOM_ENV=production**, set **DATABASE_URL** to the database’s internal connection URL, and generate a private **SECRET_KEY** in the hosting dashboard. Render supplies RENDER_EXTERNAL_HOSTNAME. A backend web service is required for account sessions and the model route.

## Project map

| Path | Purpose |
|---|---|
| original/ | Uploaded C++ console project |
| scripts/build_rules.py | Builds the six browser validators from the original piece classes |
| dist/engine.mjs, dist/rules.mjs | Legal moves (generated from the C++ validators), check, mate, draws |
| dist/robot.mjs, dist/worker.mjs | Robo's alpha-beta search, the learned evaluator blend, position assessment |
| dist/js/ | Browser modules, loaded directly (no build step): home.js, play.js, board3d.js, flatboard.js, versus.js, sounds.js, notation.js, ui.js |
| dist/css/realm.css | All styles, dark and light themes, board colours |
| dist/pieces-hd.glb | High-detail 3D piece set used by every 3D view (staunton.glb is the fallback) |
| dist/img/pieces/ | 512 px renders of the 12 HD pieces used by the flat board, crests and puzzles |
| dist/img/flat/ | 2D piece set (SVG) for the flat board, made by web/make_flat_pieces.py |
| dist/img/avatars/ | Character avatar portraits (WebP) |
| dist/origins/ | One Blender sculpture per C++ file (.glb for 3D, .webp picture as fallback and thumbnail), made by web/render_origins.py |
| dist/deep.mjs | The Night King (level 4): fast move generator, iterative deepening search, transposition table, network evaluation |
| training/Rookroom_A100.ipynb, training/train_gpu.py | GPU trainer for rook-eval-v2 (see TRAINING.md) |
| dist/js/fx.js | Move effects: sparks, dust, shards, shockwave rings, promotion beam |
| dist/js/openings.js | Opening names shown on the play page |
| dist/fonts/ | Cinzel, Cinzel Decorative, Cormorant Garamond, Manrope (SIL Open Font License) |
| dist/vendor/three/ | three.js r170 (MIT) |
| kingdom/ | Player profiles: house crest, title, picture, win/loss record, result API |
| training/ | Colab notebook and standalone trainer |
| models/ | Destination for the exported evaluator |
| rookroom/, templates/ | Django accounts, home, protected playroom, profile, archive and coaching |
| web/ | Blender scripts: sculpt.py (pieces), render_kings.py and render_gallery.py (no-WebGL pictures), grain.py |
| web/hd/ | HD piece builder (export.html), flat-piece renderer (render_sprites.py), effects test page (fxtest.html), Blender duel render (render_duel_blender.py) |
| render.yaml | Web service and PostgreSQL deployment configuration |

## Developer checks
```bash
python manage.py test
node scripts/check-engine.mjs
# After installing your own trained weights
node scripts/check-engine.mjs models/rook-eval.json
```

There is no JavaScript build step: edit files in dist/js and refresh. Run `python scripts/build_rules.py` after a supported change to the original validators and rerun the engine check. Run `blender -b -P web/sculpt.py` to rebuild dist/staunton.glb (the fallback set). The HD set is rebuilt from web/hd/export.html. Run `node scripts/check-saga.mjs` after changing the Game of Thrones chapter.

Documentation: https://docs.djangoproject.com/en/5.2/topics/auth/default/ · https://render.com/docs/deploy-django · https://python-chess.readthedocs.io/en/latest/engine.html
