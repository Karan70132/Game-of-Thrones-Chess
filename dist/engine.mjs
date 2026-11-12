import {validators,side} from './rules.mjs?v=8';
export {side};
export const square = i => 'abcdefgh'[i%8]+(1+(i>>3));
export const start = () => ({b:[...'RNBQKBNRPPPPPPPP',...Array(32).fill(0),...'pppppppprnbqkbnr'],t:'W',rights:15,ep:-1,half:0});
const other=t=>t==='W'?'B':'W';
const offsets={N:[[2,1],[1,2],[-1,2],[-2,1],[-2,-1],[-1,-2],[1,-2],[2,-1]],K:[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]};
function valid(b,i,j){
 const id=b[i].toUpperCase(), r=i>>3,c=i%8,y=j>>3,x=j%8;
 // The original king validator accepts a vertical two-square move.
 return i!==j && (id!=='K'||Math.abs(r-y)<=1) && validators[id](b,r,c,y,x);
}
export function attacked(b,j,by){
 for(let i=0;i<64;i++) if(side(b[i])===by){
   if(b[i].toUpperCase()==='P'){
    if((j>>3)-(i>>3)===(by==='W'?1:-1)&&Math.abs(i%8-j%8)===1)return true;
   } else if(valid(b,i,j)) return true;
 }
 return false;
}
export function check(s){return attacked(s.b,s.b.indexOf(s.t==='W'?'K':'k'),other(s.t))}
const rightsAt={0:2,7:1,56:8,63:4,4:3,60:12};
export function apply(s,m){
 const [i,j,prom]=m,b=s.b.slice(),p=b[i],type=p.toUpperCase(),capture=b[j],pawn=type==='P';
 if(pawn && j===s.ep && !capture)b[(i>>3)*8+j%8]=0;
 if(type==='K' && Math.abs(i-j)===2){
   const rook=j>i?i+3:i-4; b[(i+j)/2]=b[rook];b[rook]=0;
 }
 b[i]=0;b[j]=prom?(s.t==='W'?prom:prom.toLowerCase()):p;
 return {b,t:other(s.t),rights:s.rights&~((rightsAt[i]||0)|(rightsAt[j]||0)),ep:pawn&&Math.abs(j-i)===16?(i+j)/2:-1,half:pawn||capture?0:s.half+1};
}
export function legal(s){
 const moves=[],b=s.b;
 function add(i,j,p){
   const m=p?[i,j,p]:[i,j],n=apply(s,m);
   if(!attacked(n.b,n.b.indexOf(s.t==='W'?'K':'k'),n.t))moves.push(m);
 }
 for(let i=0;i<64;i++){
  if(side(b[i])!==s.t)continue;
  const id=b[i].toUpperCase(),r=i>>3,c=i%8,d=s.t==='W'?1:-1;
  const dirs=offsets[id]|| (id==='P'?[[d,0],[2*d,0],[d,1],[d,-1]]:offsets.K);
  for(const [dy,dx] of dirs){
   if((id==='B'&&(!dx||!dy))||(id==='R'&&dx&&dy))continue;
   for(let k=1;k<=(['B','R','Q'].includes(id)?7:1);k++){
    const y=r+dy*k,x=c+dx*k,j=y*8+x;if(y<0||y>7||x<0||x>7)break;
    if(valid(b,i,j)||(id==='P'&&dx&&j===s.ep)){
      if(id==='P'&&(y===0||y===7))for(const p of 'QRBN')add(i,j,p);else add(i,j);
    }
    if(b[j])break;
   }
  }
  if(id==='K' && (s.rights&(s.t==='W'?3:12)) && !check(s)){
   for(const sign of [1,-1]){
    const bit=(sign===1?1:2)*(s.t==='W'?1:4);
    if(!(s.rights&bit)||b[i+sign]||b[i+2*sign]||(sign<0&&b[i-3]))continue;
    if(!attacked(b,i+sign,other(s.t)))add(i,i+2*sign);
   }
  }
 }
 return moves;
}
export const code=m=>square(m[0])+square(m[1])+(m[2]?.toLowerCase()||'');
export const key=s=>s.b.map(p=>p||'.').join('')+s.t+s.rights+'/'+(s.ep>=0&&legal(s).some(([i,j])=>j===s.ep&&s.b[i].toUpperCase()==='P'&&i%8!==j%8)?s.ep:'-');
export function outcome(s,positions,moves){
 if(!moves.length)return check(s)?(s.t==='W'?'Robo wins':'You win')+' by checkmate':'Draw by stalemate';
 if(positions.filter(k=>k===positions.at(-1)).length>=3)return 'Draw by repetition';
 if(s.half>=100)return 'Draw by fifty-move rule';
 const pieces=s.b.map((p,i)=>[p&&p.toUpperCase(),i]).filter(([p])=>p&&p!=='K');
 if(!pieces.length || pieces.length===1&&'BN'.includes(pieces[0][0]) || pieces.every(([p,i])=>p==='B'&&((i%8+(i>>3))%2)===(pieces[0][1]%8+(pieces[0][1]>>3))%2))return 'Draw by insufficient material';
 return '';
}
