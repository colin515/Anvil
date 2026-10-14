'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {HostServer}=require('../electron/host-server.cjs');

function listen(server){return new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));}
function close(server){return new Promise(resolve=>server.close(resolve));}

test('host serves local streamed tokens without invites and shuts down',async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'anvil-host-'));
  fs.writeFileSync(path.join(tmp,'index.html'),'<html><body>Public Anvil</body></html>');
  const model='qwen2.5:3b';
  const fakeOllama=http.createServer(async(req,res)=>{
    if(req.url==='/api/chat'){
      res.writeHead(200,{'content-type':'application/x-ndjson'});
      res.write(JSON.stringify({message:{content:'Hello'}})+'\n');
      res.end(JSON.stringify({message:{content:' there'},done:true})+'\n');
    }else{res.writeHead(404);res.end();}
  });
  await listen(fakeOllama);
  const host=new HostServer({distDir:tmp,ollamaUrl:`http://127.0.0.1:${fakeOllama.address().port}`,getModel:()=>model,port:0});
  try{
    const st=await host.start();
    assert.equal(st.online,true);
    assert.equal(st.publicUrl,null);
    const base=st.localUrl;
    const badHostCode=await new Promise((resolve,reject)=>{
      const request=http.request(base+'/api/status',{headers:{host:'attacker.invalid'}},response=>{
        response.resume(); response.on('end',()=>resolve(response.statusCode));
      });
      request.on('error',reject);
      request.end();
    });
    assert.equal(badHostCode,403);
    const crossSite=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json',origin:'https://example.com'},body:JSON.stringify({messages:[{role:'user',content:'hi'}]})});
    assert.equal(crossSite.status,403);
    const homepage=await fetch(base);
    assert.equal(homepage.status,200);
    assert.match(await homepage.text(),/Public Anvil/);
    assert.equal((await (await fetch(base+'/api/session')).json()).authenticated,true);
    const response=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'hi'}]})});
    assert.equal(response.status,200);
    const stream=await response.text();
    assert.match(stream,/Hello/);assert.match(stream,/there/);
    assert.equal(host.status().totalRequests,1);
    await host.stop();
    assert.equal(host.status().online,false);
  }finally{
    if(host.status().online)await host.stop();
    await close(fakeOllama);
    fs.rmSync(tmp,{force:true,recursive:true});
  }
});
