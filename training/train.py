"""Generate Stockfish-labelled games and fit a small browser position evaluator."""
import argparse
import json
from pathlib import Path
import random
import chess
import chess.engine
import numpy as np
from sklearn.neural_network import MLPRegressor
from threadpoolctl import threadpool_limits

PIECES = "pnbrqk"
def indices(board):
    """First six planes are friendly, next six opposing. Friendly pawns advance up."""
    return sorted(((0 if p.color == board.turn else 6)+PIECES.index(p.symbol().lower()))*64
                  +(sq if board.turn else chess.square_mirror(sq))
                  for sq,p in board.piece_map().items())

def generate(engine, game):
    rng=random.Random(42000+game)
    board=chess.Board()
    rows=[]
    for ply in range(60):
        if board.is_game_over(claim_draw=True):
            break
        legal=list(board.legal_moves)
        if ply<5:
            board.push(rng.choice(legal))
            continue
        info=engine.analyse(board,chess.engine.Limit(nodes=1400),multipv=min(3,len(legal)),game=game)
        score=info[0]["score"].pov(board.turn).score(mate_score=1200)
        if ply%2==game%2:
            rows.append([indices(board),int(np.clip(score,-1000,1000))])
        move=rng.choice(legal) if rng.random()<.14 else rng.choice(info)["pv"][0]
        board.push(move)
    return rows

def dataset(games):
    rng=random.Random(42)
    order=list(range(len(games)))
    rng.shuffle(order)
    cutoff=max(1,len(order)//5)
    splits=[[],[]]
    seen=set()
    # Reserve complete games for validation and remove repeated feature vectors globally.
    for n,g in enumerate(order):
        for features,cp in games[g]:
            k=tuple(features)
            if k not in seen:
                splits[int(n<cutoff)].append((features,cp))
                seen.add(k)
    arrays=[]
    for rows in splits:
        if len(rows)<2:
            raise ValueError("Too few distinct positions in split")
        x=np.zeros((len(rows),768),np.float32)
        for i,(features,_) in enumerate(rows):
            x[i,features]=1
        y=np.array([cp/1000 for _,cp in rows],np.float32)
        arrays.append((x,y))
    return arrays

def train(games,out):
    (x,y),(vx,vy)=dataset(games)
    model=MLPRegressor(hidden_layer_sizes=(32,),max_iter=85,batch_size=min(128,len(x)),random_state=42,alpha=.01)
    with threadpool_limits(limits=1):
        model.fit(x,y)
    pred=np.clip(model.predict(vx),-1,1)
    mae=float(np.mean(np.abs(vy-pred))*1000)
    material=np.repeat([100,320,335,500,900,0,-100,-320,-335,-500,-900,0],64)
    baseline=float(np.mean(np.abs(np.clip(vx@material,-1000,1000)-vy*1000)))
    artifact={"format":"rook-eval-v1","w":model.coefs_[0].tolist(),"b":model.intercepts_[0].tolist(),
              "v":model.coefs_[1][:,0].tolist(),"c":float(model.intercepts_[1][0]),
              "metrics":{"training_positions":len(x),"validation_positions":len(vx),"validation_mae_cp":round(mae,2),
                         "material_mae_cp":round(baseline,2),"games":len(games)}}
    Path(out).write_text(json.dumps(artifact,separators=(",",":"),allow_nan=False))
    print(json.dumps(artifact["metrics"],indent=2),flush=True)
    return model

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--games",type=int,default=160)
    parser.add_argument("--engine",default="/usr/games/stockfish")
    parser.add_argument("--cache",type=Path,default=Path("labels"))
    parser.add_argument("--out",default="rook-eval.json")
    args=parser.parse_args()
    if args.games<5:
        parser.error("Use at least five games")
    args.cache.mkdir(exist_ok=True,parents=True)
    games=[]
    with chess.engine.SimpleEngine.popen_uci(args.engine) as engine:
        engine.configure({"Threads":1,"Hash":16})
        for i in range(args.games):
            path=args.cache/f"v1-{i}.json"
            if not path.exists():
                rows=generate(engine,i)
                tmp=path.with_suffix(".tmp")
                tmp.write_text(json.dumps(rows))
                tmp.replace(path)
            games.append(json.loads(path.read_text()))
            if (i+1)%10==0:
                print(f"{i+1}/{args.games} games",flush=True)
    train(games,args.out)

if __name__=="__main__":
    main()
