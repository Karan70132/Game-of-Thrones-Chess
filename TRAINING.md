# Training Robo and the Night King

Robo has four rivals. Levels 1–3 use the small search in `dist/robot.mjs`. Level 4, **The Night King**,
uses `dist/deep.mjs`: an opening book, then about five seconds of deep search (typically 10–15 moves
ahead), with your trained network as its judgement of positions.

A trained model is one file: `models/rook-eval.json`. The site reads either format:

| Format | Trainer | Data | Hardware |
|---|---|---|---|
| `rook-eval-v1` | `training/Rookroom_Colab.ipynb` | games labelled by Stockfish in Colab | CPU, small |
| `rook-eval-v2` | `training/Rookroom_A100.ipynb` or `training/train_gpu.py` | Lichess database of Stockfish evaluations (CC0) | GPU (A100) |

Every model carries its own score: `validation_mae_cp` (the network's average error) and
`material_mae_cp` (the error of just counting material). **The network only helps if its error is
lower.** The Night King ignores a network that is worse than counting material.

## 1. Install Node.js (once, Ubuntu)

```bash
sudo apt update
sudo apt install -y nodejs
node --version
```

You need version 18 or newer. If it prints something older (v12, v16):

```bash
sudo apt remove -y nodejs
sudo snap install node --classic
node --version
```

## 2. Check the engines

From the project folder (the one with `manage.py`):

```bash
node scripts/check-engine.mjs models/rook-eval.json
node scripts/check-deep.mjs models/rook-eval.json
```

Leave out `models/rook-eval.json` if you have no model yet. Both must end with “passed”.

## 3a. Train on the A100 in Colab

1. Open https://colab.research.google.com → File → Upload notebook → `training/Rookroom_A100.ipynb`.
2. Runtime → Change runtime type → **A100 GPU** → Save.
3. Run the cells in order. Allow Google Drive access when asked.
4. Run as it is first (2 million positions, 4 epochs). The training cell prints the error *before*
   training: that is plain material counting, the number every epoch must beat. The network starts
   from material values, so it can only improve on them.
5. If it beats material, set `POSITIONS = 20_000_000` and `EPOCHS = 12` and run again from the settings
   cell down. Prepared data is kept in Drive, so only the new positions are read. Each run trains a new
   model unless you set `RESUME = True`.
6. The last cell downloads `rook-eval.json` and also keeps a named copy of each run in Drive.

## 3b. Or train on your own NVIDIA machine

```bash
python3 -m venv .venv-gpu
source .venv-gpu/bin/activate
pip install torch numpy zstandard
python training/train_gpu.py --positions 20000000 --epochs 12 --cache training/data --out models/rook-eval.json
```

`training/data/` holds the prepared positions (about 1.3 GB for 20 million) and is not committed.

## 4. Install the model

1. Copy `rook-eval.json` into `models/` (replace the old one).
2. Run step 2 again. For a v2 model it also prints “Browser and trainer agree on 5 sample positions”.
3. Start the site (`bash run.sh`), open Play → Rival & board. It should say **GPU model active**.
4. Choose **The Night King** and play.

## 5. Results to record in the README

From the trainer's final printout: `positions`, `validation_mae_cp`, `material_mae_cp`, `epochs`.
A good v2 run is clearly below the material figure (often well under half of it).

## What this is, and is not

- The neural network is a position evaluator, not a language model and not Stockfish.
- The Night King is far stronger than the other rivals: in testing it won 4 out of 4 games against
  The Old Lord while thinking only 0.3 seconds a move. Strong club players may still beat it;
  a better-trained network makes it stronger, but no promise of a rating is made here.
