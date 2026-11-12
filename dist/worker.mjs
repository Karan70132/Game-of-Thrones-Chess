import {choose,assess} from './robot.mjs?v=8';
import {think} from './deep.mjs?v=8';
import {apply,legal,code} from './engine.mjs?v=8';
import {bookMove} from './js/openings.js?v=8';
self.onmessage=({data})=>{try{
 // Level 4, the Night King: opening book, then a timed deep search (dist/deep.mjs).
 if(data.level===4){
  const book=bookMove(data.codes||[]);
  const fromBook=book&&legal(data.s).find(m=>code(m)===book);
  if(fromBook){self.postMessage({move:fromBook,score:assess(apply(data.s,fromBook),1,null),book:true});return;}
  const r=think(data.s,{timeMs:data.timeMs||5000,model:data.model,prior:data.prior||[]});
  const move=r&&legal(data.s).find(m=>code(m)===code(r.move));
  if(move){self.postMessage({move,score:r.score,depth:r.depth});return;}
 }
 const move=choose(data.s,data.ply,Math.min(3,data.level),data.model);
 let score=0;
 try{if(move)score=assess(apply(data.s,move),1,data.model)}catch{}
 self.postMessage({move,score});
}catch(e){self.postMessage({error:String(e&&e.stack||e)});}
};
