import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {apply,code,legal,start} from '../dist/engine.mjs';
import {choose} from '../dist/robot.mjs';
function nodes(s,d){return d?legal(s).reduce((n,m)=>n+nodes(apply(s,m),d-1),0):1}
assert.equal(nodes(start(),4),197281);
const file=process.argv[2];
const model=file?JSON.parse(readFileSync(file,'utf8')):null;
for(const m of ['e2e4','d2d4']){
 const after=apply(start(),legal(start()).find(x=>code(x)===m));
 const reply=choose(after,1,2,model);
 assert(legal(after).some(x=>code(x)===code(reply)));
 console.log(m,code(reply));
}
console.log('Move generation and Robo replies passed');
