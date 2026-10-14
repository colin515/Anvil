'use strict';
/* Generates a self-contained Windows ICO for Electron Builder without native dependencies. */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const size = 256;
const rgba = Buffer.alloc(size * size * 4);
const inside = (x,y,poly) => {
  let c=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const a=poly[i],b=poly[j];
    if(((a[1]>y)!==(b[1]>y)) && x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]) c=!c;
  }
  return c;
};
const outer=[[.50,.88],[.32,.85],[.20,.77],[.17,.62],[.20,.50],[.28,.38],[.33,.13],[.44,.23],[.49,.42],[.56,.35],[.62,.16],[.76,.34],[.83,.49],[.84,.65],[.79,.77],[.68,.86]];
const inner=[[.50,.78],[.40,.75],[.37,.67],[.42,.56],[.43,.44],[.50,.54],[.55,.62],[.59,.45],[.64,.58],[.65,.67],[.61,.75]];
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=(x+.5)/size,v=(y+.5)/size,i=(y*size+x)*4;
  const border=(u>.04&&u<.96&&v>.04&&v<.96);
  const radius=Math.hypot(Math.max(.105-u,0,u-.895),Math.max(.105-v,0,v-.895));
  const bg=border && radius < .07;
  let rgb=bg?[20,26,34]:[0,0,0],alpha=bg?255:0;
  if(bg&&inside(u,v,outer)){rgb=[255,156,97];alpha=255;}
  if(bg&&inside(u,v,inner)){rgb=[20,26,34];alpha=255;}
  rgba[i]=rgb[0];rgba[i+1]=rgb[1];rgba[i+2]=rgb[2];rgba[i+3]=alpha;
}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
const crc=buf=>{let n=0xFFFFFFFF;for(const b of buf)n=crcTable[(n^b)&255]^(n>>>8);return(n^0xFFFFFFFF)>>>0;};
const chunk=(name,data)=>{const kind=Buffer.from(name);const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const sum=Buffer.alloc(4);sum.writeUInt32BE(crc(Buffer.concat([kind,data])));return Buffer.concat([len,kind,data,sum]);};
const scan=Buffer.alloc(size*(size*4+1));for(let y=0;y<size;y++)rgba.copy(scan,y*(size*4+1)+1,y*size*4,(y+1)*size*4);
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
const ico=Buffer.alloc(22);ico.writeUInt16LE(1,2);ico.writeUInt16LE(1,4);ico[6]=0;ico[7]=0;ico[8]=0;ico[9]=0;ico.writeUInt16LE(1,10);ico.writeUInt16LE(32,12);ico.writeUInt32LE(png.length,14);ico.writeUInt32LE(22,18);
const out=path.resolve(__dirname,'../build/icon.ico');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.concat([ico,png]));console.log(`Generated Anvil icon (${png.length} bytes)`);
