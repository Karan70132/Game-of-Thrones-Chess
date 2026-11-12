"""Train Robo's stronger evaluator (rook-eval-v2) on a GPU.

Data: the Lichess evaluation database (about 395 million positions analysed by Stockfish, CC0 licence),
streamed straight from https://database.lichess.org/lichess_db_eval.jsonl.zst. Only the first
--positions usable positions are read, so you never download the whole file.

Network: 768 inputs (same planes as rook-eval-v1) -> H1 -> H2 -> 1 with clipped ReLU, plus a piece-square
skip connection that starts at plain material values. Trained so that
sigmoid(output) matches sigmoid(centipawns / 400). The browser computes output * 400 = centipawns.

Usage (Colab A100 or your own NVIDIA machine):
    python train_gpu.py --positions 20000000 --cache data --out rook-eval.json
Steps can be run separately: --step prepare | train | export | all (default).
"""
import argparse
import io
import json
import math
import multiprocessing as mp
import time
import urllib.request
from pathlib import Path

import numpy as np

SOURCE = "https://database.lichess.org/lichess_db_eval.jsonl.zst"
PLANES = "pnbrqk"
PAD = 768           # index used for "no piece" padding
SLOTS = 32          # at most 32 pieces on a board
MATE_CP = 2000      # forced mates are learned as +-2000 centipawns
SCALE = 400.0
CHUNK = 1_000_000   # positions per cache file


# ---------------------------------------------------------------- features (must match dist/deep.mjs)
def fen_indices(fen):
    """768-plane indices from the side to move's view: own pieces planes 0-5, enemy 6-11; board mirrored for Black."""
    rows, turn = fen.split()[:2]
    white = turn == "w"
    out = []
    for r, row in enumerate(rows.split("/")):
        f = 0
        for ch in row:
            if ch.isdigit():
                f += int(ch)
                continue
            sq = (7 - r) * 8 + f
            own = ch.isupper() == white
            plane = PLANES.index(ch.lower()) + (0 if own else 6)
            out.append(plane * 64 + (sq if white else sq ^ 56))
            f += 1
    return out, white


def parse(line, min_depth):
    """One Lichess line -> (indices, centipawns for the side to move) or None."""
    try:
        d = json.loads(line)
        best = max(d["evals"], key=lambda e: e.get("depth", 0))
        if best.get("depth", 0) < min_depth:
            return None
        pv = best["pvs"][0]
        if pv.get("cp") is not None:
            cp = max(-MATE_CP, min(MATE_CP, int(pv["cp"])))
        elif pv.get("mate") is not None:
            cp = MATE_CP if pv["mate"] > 0 else -MATE_CP
        else:
            return None
        idx, white = fen_indices(d["fen"])
        if len(idx) > SLOTS:
            return None
        return idx, cp if white else -cp  # Lichess scores are from White's view
    except (KeyError, ValueError, IndexError, TypeError):
        return None


def _parse_batch(args):
    lines, min_depth = args
    return [r for r in (parse(l, min_depth) for l in lines) if r]


def open_source(source):
    if source.endswith(".jsonl"):
        return open(source, encoding="utf-8")
    import zstandard  # pip install zstandard
    raw = urllib.request.urlopen(source) if source.startswith("http") else open(source, "rb")
    return io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(raw), encoding="utf-8")


def prepare(args):
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    have = sum(np.load(p)["cp"].shape[0] for p in sorted(cache.glob("chunk-*.npz")))
    if have >= args.positions:
        print(f"Cache already has {have:,} positions", flush=True)
        return
    skip_lines = json.loads((cache / "progress.json").read_text())["lines"] if (cache / "progress.json").exists() else 0
    n_chunk = len(list(cache.glob("chunk-*.npz")))
    idx_buf, cp_buf, lines_read, t0 = [], [], 0, time.time()
    stream = open_source(args.source)
    pool = mp.Pool(max(1, mp.cpu_count() - 1))

    def batches():
        nonlocal lines_read
        batch = []
        for line in stream:
            lines_read += 1
            if lines_read <= skip_lines:
                continue
            batch.append(line)
            if len(batch) == 20_000:
                yield batch, args.min_depth
                batch = []
        if batch:
            yield batch, args.min_depth

    def flush():
        nonlocal n_chunk, idx_buf, cp_buf
        if not cp_buf:
            return
        arr = np.full((len(cp_buf), SLOTS), PAD, np.uint16)
        for i, ix in enumerate(idx_buf):
            arr[i, :len(ix)] = ix
        np.savez(cache / f"chunk-{n_chunk:04d}.npz", idx=arr, cp=np.array(cp_buf, np.int16))
        (cache / "progress.json").write_text(json.dumps({"lines": lines_read}))
        n_chunk += 1
        idx_buf, cp_buf = [], []

    total = have
    for rows in pool.imap(_parse_batch, batches()):
        for ix, cp in rows:
            idx_buf.append(ix)
            cp_buf.append(cp)
        if len(cp_buf) >= CHUNK:
            total += len(cp_buf)
            flush()
            print(f"{total:,} positions ({lines_read:,} lines, {time.time() - t0:.0f}s)", flush=True)
        if total + len(cp_buf) >= args.positions:
            break
    total += len(cp_buf)
    flush()
    pool.terminate()
    print(f"Prepared {total:,} positions in {time.time() - t0:.0f}s", flush=True)


# ---------------------------------------------------------------- data
def load_cache(cache, limit):
    idx, cp = [], []
    for p in sorted(Path(cache).glob("chunk-*.npz")):
        z = np.load(p)
        idx.append(z["idx"])
        cp.append(z["cp"])
        if sum(len(c) for c in cp) >= limit:
            break
    idx, cp = np.concatenate(idx)[:limit], np.concatenate(cp)[:limit]
    return idx, cp


def material_table():
    """Centipawn value of each of the 769 inputs (own pieces +, enemy pieces -, padding 0)."""
    values = np.zeros(PAD + 1, np.float32)
    for plane, v in enumerate([100, 320, 330, 500, 900, 0] * 2):
        values[plane * 64:(plane + 1) * 64] = v if plane < 6 else -v
    return values


def material_cp(idx):
    """Baseline: count material only (side to move's view)."""
    return material_table()[idx.astype(np.int64)].sum(1)


# ---------------------------------------------------------------- model
def build(torch, h1, h2):
    nn = torch.nn

    class Net(nn.Module):
        def __init__(self):
            super().__init__()
            self.emb = nn.EmbeddingBag(PAD + 1, h1, mode="sum", padding_idx=PAD)
            nn.init.normal_(self.emb.weight, 0, 0.02)
            self.b1 = nn.Parameter(torch.zeros(h1))
            self.l2 = nn.Linear(h1, h2)
            self.out = nn.Linear(h2, 1)
            # Piece-square skip connection, started at plain material values: before any training the
            # network already scores exactly like "count the material", and training only adds to that.
            self.psqt = nn.EmbeddingBag(PAD + 1, 1, mode="sum", padding_idx=PAD)
            with torch.no_grad():
                self.emb.weight[PAD].zero_()
                self.psqt.weight.copy_(torch.from_numpy(material_table()[:, None] / SCALE))
                self.out.weight.zero_()
                self.out.bias.zero_()

        def forward(self, idx):
            x = torch.clamp(self.emb(idx) + self.b1, 0, 1)
            x = torch.clamp(self.l2(x), 0, 1)
            return (self.out(x) + self.psqt(idx)).squeeze(-1)

    return Net()


def train(args):
    import torch
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print("Device:", torch.cuda.get_device_name(0) if device == "cuda" else "CPU (slow - use a GPU runtime)", flush=True)
    torch.backends.cuda.matmul.allow_tf32 = True
    idx, cp = load_cache(args.cache, args.positions)
    rng = np.random.default_rng(7)
    order = rng.permutation(len(cp))
    n_val = max(10_000, len(cp) // 100)
    val, tr = order[:n_val], order[n_val:]
    print(f"Training on {len(tr):,} positions, validating on {len(val):,}", flush=True)
    X = torch.from_numpy(idx.astype(np.int32)).to(device)
    Y = torch.from_numpy(cp.astype(np.float32)).to(device)
    tr_t, val_t = torch.from_numpy(tr).to(device), torch.from_numpy(val).to(device)
    net = build(torch, args.hidden, args.hidden2).to(device)
    ckpt = Path(args.cache) / "best.pt"
    if args.resume and ckpt.exists():
        try:
            net.load_state_dict(torch.load(ckpt, map_location=device))
            print("Continuing from the previous best model", flush=True)
        except RuntimeError:
            print("Previous model has a different shape: starting fresh", flush=True)
    # small datasets get smaller batches, so there are always enough training steps (at least ~400 per epoch)
    batch = int(min(args.batch, max(512, len(tr) // 400)))
    print(f"Batch size {batch}, {math.ceil(len(tr) / batch)} steps per epoch", flush=True)
    opt = torch.optim.Adam(net.parameters(), lr=args.lr)
    steps = args.epochs * math.ceil(len(tr) / batch)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=steps, pct_start=0.05)


    def validate():
        net.eval()
        errs = []
        with torch.no_grad():
            for i in range(0, len(val_t), 65536):
                b = val_t[i:i + 65536]
                pred = (net(X[b].long()) * SCALE).clamp(-1000, 1000)
                errs.append((pred - Y[b].clamp(-1000, 1000)).abs())
        net.train()
        return float(torch.cat(errs).mean())

    best = validate()
    print(f"before training: validation error {best:.1f} cp" + ("" if args.resume else " (the material-only starting point: training must beat this)"), flush=True)
    torch.save(net.state_dict(), ckpt)
    for epoch in range(args.epochs):
        t0, total, n = time.time(), 0.0, 0
        perm = tr_t[torch.randperm(len(tr_t), device=device)]
        for i in range(0, len(perm), batch):
            b = perm[i:i + batch]
            out = net(X[b].long())
            loss = torch.mean((torch.sigmoid(out) - torch.sigmoid(Y[b] / SCALE)) ** 2)
            opt.zero_grad(set_to_none=True)
            loss.backward()
            opt.step()
            sched.step()
            total += float(loss) * len(b)
            n += len(b)
        mae = validate()
        print(f"epoch {epoch + 1}/{args.epochs}  loss {total / n:.5f}  validation error {mae:.1f} cp  ({time.time() - t0:.0f}s)", flush=True)
        if mae < best:
            best = mae
            torch.save(net.state_dict(), ckpt)
    net.load_state_dict(torch.load(ckpt, map_location=device))
    vb = idx[val]
    material = np.clip(material_cp(vb), -1000, 1000)
    metrics = {
        "positions": int(len(cp)), "training_positions": int(len(tr)), "validation_positions": int(len(val)),
        "validation_mae_cp": round(best, 2),
        "material_mae_cp": round(float(np.abs(material - np.clip(cp[val], -1000, 1000)).mean()), 2),
        "epochs": args.epochs, "hidden": [args.hidden, args.hidden2], "min_depth": args.min_depth,
        "source": "Lichess evaluation database (Stockfish, CC0)",
    }
    weights = {
        "w1": net.emb.weight[:PAD].detach().cpu().numpy(), "b1": net.b1.detach().cpu().numpy(),
        "w2": net.l2.weight.detach().cpu().numpy().T, "b2": net.l2.bias.detach().cpu().numpy(),
        "w3": net.out.weight.detach().cpu().numpy()[0], "b3": float(net.out.bias.detach().cpu()),
        "psqt": net.psqt.weight.detach().cpu().numpy()[:PAD, 0],
    }
    np.savez(Path(args.cache) / "weights.npz", **weights)
    (Path(args.cache) / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print(json.dumps(metrics, indent=2), flush=True)


# ---------------------------------------------------------------- export (numpy only, so it can be tested anywhere)
def forward(w, ix):
    """Reference forward pass in numpy, identical to netEval in dist/deep.mjs."""
    acc = w["b1"] + w["w1"][ix].sum(0)
    h = np.clip(acc, 0, 1)
    h2 = np.clip(h @ w["w2"] + w["b2"], 0, 1)
    skip = float(w["psqt"][ix].sum()) if "psqt" in w else 0.0
    return float(np.clip((h2 @ w["w3"] + w["b3"] + skip) * SCALE, -2000, 2000))


SAMPLE_FENS = [
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
    "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
    "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R b KQkq - 0 1",
    "6k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 1",
]


def export(args, weights=None, metrics=None):
    cache = Path(args.cache)
    if weights is None:
        weights = dict(np.load(cache / "weights.npz"))
        weights["b3"] = float(weights["b3"])
        metrics = json.loads((cache / "metrics.json").read_text())
    r = lambda a: [round(float(x), 6) for x in a]
    samples = [{"fen": f, "cp": round(forward(weights, fen_indices(f)[0]), 3)} for f in SAMPLE_FENS]
    model = {
        "format": "rook-eval-v2", "scale": SCALE, "activation": "clipped-relu",
        "inputs": "768 planes: own P N B R Q K then enemy, side to move's view, board mirrored for Black",
        "l1": {"w": [r(row) for row in weights["w1"]], "b": r(weights["b1"])},
        "l2": {"w": [r(row) for row in weights["w2"]], "b": r(weights["b2"])},
        "out": {"w": r(weights["w3"]), "b": round(float(weights["b3"]), 6)},
        **({"psqt": r(weights["psqt"])} if "psqt" in weights else {}),
        "metrics": metrics, "samples": samples,
    }
    Path(args.out).write_text(json.dumps(model, separators=(",", ":")))
    print(f"Saved {args.out} ({Path(args.out).stat().st_size / 1e6:.1f} MB)", flush=True)
    m = metrics or {}
    if m.get("validation_mae_cp") is not None:
        verdict = "better than" if m["validation_mae_cp"] < m["material_mae_cp"] else "NOT better than"
        print(f"Network error {m['validation_mae_cp']} cp vs material-only {m['material_mae_cp']} cp: {verdict} counting material.")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--step", choices=["prepare", "train", "export", "all"], default="all")
    p.add_argument("--source", default=SOURCE)
    p.add_argument("--positions", type=int, default=20_000_000)
    p.add_argument("--min-depth", type=int, default=18)
    p.add_argument("--cache", default="data")
    p.add_argument("--out", default="rook-eval.json")
    p.add_argument("--hidden", type=int, default=256)
    p.add_argument("--hidden2", type=int, default=32)
    p.add_argument("--epochs", type=int, default=12)
    p.add_argument("--batch", type=int, default=16384)
    p.add_argument("--lr", type=float, default=2e-3)
    p.add_argument("--resume", action="store_true", help="start from the previous best model in --cache")
    args = p.parse_args()
    if args.step in ("prepare", "all"):
        prepare(args)
    if args.step in ("train", "all"):
        train(args)
    if args.step in ("export", "all"):
        export(args)


if __name__ == "__main__":
    main()
