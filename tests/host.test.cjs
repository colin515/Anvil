'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {HostServer,privateIP,thinkingParameter}=require('../electron/host-server.cjs');

function listen(server){return new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));}
function close(server){return new Promise(resolve=>server.close(resolve));}

test('Ollama thinking effort is model-aware',()=>{
  assert.equal(thinkingParameter('qwen2.5:3b','off'),undefined);
  assert.equal(thinkingParameter('qwen3:8b','off'),false);
  assert.equal(thinkingParameter('qwen3:8b','high'),true);
  assert.equal(thinkingParameter('gpt-oss:20b','low'),'low');
  assert.equal(thinkingParameter('gpt-oss:20b','medium'),'medium');
  assert.equal(thinkingParameter('gpt-oss:20b','high'),'high');
  assert.equal(thinkingParameter('llama3.2:3b','medium'),true);
});
test('private LAN address classification',()=>{
  assert.equal(privateIP('192.168.1.42'),true);
  assert.equal(privateIP('10.0.0.23'),true);
  assert.equal(privateIP('172.16.2.2'),true);
  assert.equal(privateIP('172.31.255.3'),true);
  assert.equal(privateIP('127.0.0.1'),true);
  assert.equal(privateIP('172.32.0.1'),false);
  assert.equal(privateIP('8.8.8.8'),false);
});
test('Wi-Fi host supports optional access code, long chat messages, and shutdown',async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'anvil-lan-'));
  fs.writeFileSync(path.join(tmp,'index.html'),'<html>ANVIL LAN</html>');
  const requests=[];
  const fakeOllama=http.createServer(async(req,res)=>{
    if(req.url!=='/api/chat'){res.writeHead(404);res.end();return;}
    const chunks=[];for await(const c of req)chunks.push(c);
    requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
    res.writeHead(200,{'content-type':'application/x-ndjson'});
    res.write(JSON.stringify({message:{content:'Hello'}})+'\n');
    res.end(JSON.stringify({message:{content:' there'},done:true})+'\n');
  });
  await listen(fakeOllama);
  const host=new HostServer({distDir:tmp,ollamaUrl:`http://127.0.0.1:${fakeOllama.address().port}`,getModel:()=> 'qwen2.5:3b',port:0,accessCode:'test-secret-code',accessEnabled:true});
  try{
    const st=await host.start();
    assert.equal(st.online,true);
    assert.equal(st.accessEnabled,true);
    assert.equal(st.publicUrl,null);
    const base=st.localUrl;
    const publicStatus=await (await fetch(base+'/api/status')).json();
    assert.equal(publicStatus.accessEnabled,true);
    assert.equal((await (await fetch(base+'/api/session')).json()).authenticated,false);
    const bad=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'hi'}]})});
    assert.equal(bad.status,401);
    const invalid=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'wrong-code'})});
    assert.equal(invalid.status,401);
    const login=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:'test-secret-code'})});
    assert.equal(login.status,200);
    assert.match(login.headers.get('set-cookie'),/HttpOnly/i);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await (await fetch(base+'/api/session',{headers:{cookie}})).json()).authenticated,true);
    const blocked=await fetch(base+'/api/chat',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json',cookie},body:JSON.stringify({messages:[{role:'user',content:'hi'}]})});
    assert.equal(blocked.status,403);
    const badHostCode=await new Promise((resolve,reject)=>{
      const req=http.request(base+'/api/status',{headers:{host:'attacker.invalid'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});
      req.on('error',reject);req.end();
    });
    assert.equal(badHostCode,403);
    const longText='a'.repeat(8000);
    const messages=[{role:'user',content:longText}];
    const response=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify({messages})});
    assert.equal(response.status,200);
    const stream=await response.text();
    assert.match(stream,/Hello/);assert.match(stream,/there/);
    assert.equal(requests.length,1);
    assert.equal(requests[0].messages[0].content.length,8000);
    assert.equal(requests[0].options,undefined);
    assert.equal(host.status().totalRequests,1);
    const access=host.setAccess(false);
    assert.equal(access.enabled,false);
    const noCode=await (await fetch(base+'/api/session')).json();
    assert.equal(noCode.authenticated,true);
    const open=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'hi again'}]})});
    assert.equal(open.status,200);
    await open.text();
    assert.equal(host.status().totalRequests,2);
    const next=host.regenerateCode();
    assert.notEqual(next.code,'test-secret-code');
    await host.stop();
    assert.equal(host.status().online,false);
  }finally{
    if(host.status().online)await host.stop();
    await close(fakeOllama);
    fs.rmSync(tmp,{force:true,recursive:true});
  }
});
