// Same planes, orientation and clamping as training/train.py (v1) and training/train_gpu.py (v2).
import {loadNet,netEval} from './deep.mjs?v=8';
const cache=new WeakMap();
const PIECE={P:1,N:2,B:3,R:4,Q:5,K:6,p:-1,n:-2,b:-3,r:-4,q:-5,k:-6};
export function predict(s,model){
 let net=cache.get(model);
 if(!net){net=loadNet(model);cache.set(model,net);}
 if(!net)return 0;
 const b=new Int8Array(64);
 for(let i=0;i<64;i++)if(s.b[i])b[i]=PIECE[s.b[i]];
 return netEval(net,b,s.t==='W'?1:-1);
}
