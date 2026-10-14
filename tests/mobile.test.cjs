'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

// The real ID function is evaluated without secure-context crypto APIs.
// Mobile Safari/Chrome often expose the local LAN site through plain HTTP.
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/PublicChat.tsx'),'utf8');
const start=source.indexOf('export function localChatId():string {');
const end=source.indexOf('const createChat=',start);
assert.ok(start>=0&&end>start,'chat ID generator must be present');
const body=source.slice(start,end).replace('export function localChatId():string','function localChatId()');

test('new chats work on plain-HTTP mobile pages without crypto.randomUUID',()=>{
  const id=vm.runInNewContext(body+'\nlocalChatId()', {crypto:{},Date,Math});
  assert.match(id,/^chat-[a-z0-9]+-[a-z0-9]+$/);
});
test('modern secure browser still uses its built-in random UUID',()=>{
  const id=vm.runInNewContext(body+'\nlocalChatId()', {
    crypto:{randomUUID:()=> 'd62fa90b-2ed0-4af4-b530-3ce12e779842'},Date,Math
  });
  assert.equal(id,'d62fa90b-2ed0-4af4-b530-3ce12e779842');
});
test('mobile chat does not expose unsupported thinking controls',()=>{
  assert.equal(source.includes('Thinking effort'),false);
  assert.equal(source.includes('value={thinking}'),false);
  assert.equal(source.includes('thinking,completion'),false);
});
