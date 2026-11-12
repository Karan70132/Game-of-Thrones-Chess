// Conditional logistic regression on legal alternatives in a small opening repertoire.
import {writeFileSync} from 'node:fs';
import {start,legal,apply,code,key} from '../dist/engine.mjs';
import {features} from '../dist/features.mjs';
const lines=[
'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1',
'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4',
'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3',
'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4',
'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6',
'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5',
'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6',
'd2d4 d7d5 g1f3 g8f6 c1f4 e7e6 e2e3',
'c2c4 e7e5 b1c3 g8f6 g2g3 d7d5',
'g1f3 d7d5 d2d4 g8f6 c2c4 e7e6'];
const samples=[],seen=new Set();
for(const line of lines){
 let s=start();
 for(const label of line.split(' ')){
  const moves=legal(s),idx=moves.findIndex(m=>code(m)===label);
  if(idx<0)throw Error(label);
  const id=key(s)+label;
  if(!seen.has(id)){samples.push([moves.map(m=>features(s,m)),idx]);seen.add(id)}
  s=apply(s,moves[idx]);
 }
}
const w=Array(14).fill(0),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
for(let epoch=0;epoch<450;epoch++){
 const grad=w.map(v=>-0.015*v);
 for(const [xs,label] of samples){
  const exp=xs.map(x=>Math.exp(dot(x,w))),sum=exp.reduce((a,b)=>a+b);
  for(let j=0;j<w.length;j++)grad[j]+=(xs[label][j]-xs.reduce((a,x,k)=>a+x[j]*exp[k]/sum,0))/samples.length;
 }
 for(let j=0;j<w.length;j++)w[j]+=0.2*grad[j];
}
writeFileSync(new URL('../dist/model.mjs',import.meta.url),'export const weights='+JSON.stringify(w)+';\n');
console.log(samples.length,'distinct labeled position/move pairs');
