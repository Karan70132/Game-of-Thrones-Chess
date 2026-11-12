import {predict} from './evaluator.mjs?v=8';
import {apply,check,legal,side} from './engine.mjs?v=8';
import {features} from './features.mjs?v=8';
import {weights} from './model.mjs?v=8';
const value={P:100,N:320,B:335,R:500,Q:900,K:0};
function evaluate(s){
 let score=0;
 for(let i=0;i<64;i++)if(s.b[i]){
  const p=s.b[i].toUpperCase(),white=side(s.b[i])==='W',y=white?(i>>3):7-(i>>3);
  const center=7-Math.abs(i%8-3.5)-Math.abs(y-3.5);
  score+=(white?1:-1)*(value[p]+(p==='P'?y*5:'NB'.includes(p)?center*6:0));
 }
 return s.t==='W'?score:-score;
}
// A network that predicts worse than simply counting material is not used.
const helps=m=>!m||!m.metrics||m.metrics.validation_mae_cp===undefined||m.metrics.validation_mae_cp<m.metrics.material_mae_cp;
function search(s,depth,a,b,model){
 const moves=legal(s);
 if(!moves.length)return check(s)?-20000-depth:0;
 if(!depth){if(!model)return evaluate(s);const w=model.format==='rook-eval-v2'?0.5:0.25;return (1-w)*evaluate(s)+w*predict(s,model);}
 moves.sort((x,y)=>(value[s.b[y[1]]?.toUpperCase?.()]||0)-(value[s.b[x[1]]?.toUpperCase?.()]||0));
 let best=-Infinity;
 for(const m of moves){
  best=Math.max(best,-search(apply(s,m),depth-1,-b,-a,model));
  a=Math.max(a,best);if(a>=b)break;
 }
 return best;
}
export function choose(s,ply,level,model=null){
 if(!helps(model))model=null;
 let best=-Infinity,pick=null;
 for(const m of legal(s)){
  const prior=ply<16?features(s,m).reduce((n,x,i)=>n+x*weights[i],0):0;
  const score=-search(apply(s,m),level-1,-Infinity,Infinity,model)+prior*4;
  if(score>best){best=score;pick=m}
 }
 return pick;
}

// Score of a position in centipawns from White's point of view (positive = White better).
// Used by the play page's evaluation bar; Robo's move choice above is unchanged.
export function assess(s,depth=1,model=null){
 if(!helps(model))model=null;
 const v=search(s,depth,-Infinity,Infinity,model);
 return s.t==='W'?v:-v;
}
