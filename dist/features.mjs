export function features(s,[i,j]){
 const p=s.b[i].toUpperCase(),rank=s.t==='W'?(j>>3):7-(j>>3),file=j%8;
 const types='PNBRQK';
 return [...types].map(x=>+(p===x)).concat([
  3.5-Math.abs(file-3.5),3.5-Math.abs(rank-3.5),
  +('NB'.includes(p)&&(i>>3)===(s.t==='W'?0:7)),
  +(p==='P'&&[3,4].includes(file)&&rank===3),
  +(p==='K'&&Math.abs(i-j)===2),+!!s.b[j],
  +(p==='N'&&[0,7].includes(file)),+(p==='P'&&[0,7].includes(file)),
 ]);
}
