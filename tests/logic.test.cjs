'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {gb,recommendations}=require('../electron/logic.cjs');
const {secureMatch}=require('../electron/host-server.cjs');
test('bytes to GiB',()=>assert.equal(gb(2*1024**3),2));
test('low-memory device gets limited large models',()=>{
  const r=recommendations({ramTotalGb:8,vramGb:2});
  assert.equal(r.find(m=>m.id==='qwen2.5:14b').tier,'limited');
});
test('GPU-fit recommendation prioritized',()=>{
  const r=recommendations({ramTotalGb:32,vramGb:12});
  assert.equal(r[0].tier,'excellent');
});
test('secure invite comparison',()=>{
  assert.equal(secureMatch('ABC','ABC'),true);
  assert.equal(secureMatch('ABC','abc'),false);
});
