'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {HostServer}=require('../electron/host-server.cjs');

const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
const close=s=>new Promise(resolve=>s.close(resolve));

test('private chat streams iterative progress and final confidence, preserving previous chat API',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'anvil-autohost-'));
  fs.writeFileSync(path.join(root,'index.html'),'<html>Anvil chat</html>');
  let generated=0,reviewed=0;
  const model=http.createServer(async(req,res)=>{
    const chunks=[];for await(const c of req)chunks.push(c);
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(input.format==='json'){
      reviewed++;
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify({message:{content:JSON.stringify({confidence:reviewed===1?78:96,feedback:'Improve explanation completeness.'})}}));
      return;
    }
    if(input.stream===false){
      generated++;
      res.setHeader('content-type','application/json');
      res.end(JSON.stringify({message:{content:'Revision '+generated}}));
      return;
    }
    res.setHeader('content-type','application/x-ndjson');
    res.end(JSON.stringify({message:{content:'Normal reply'},done:true})+'\n');
  });
  await listen(model);
  const host=new HostServer({distDir:root,ollamaUrl:'http://127.0.0.1:'+model.address().port,getModel:()=> 'qwen2.5:3b',accessEnabled:false,port:0});
  try{
    const state=await host.start();
    const makeChat=payload=>fetch(state.localUrl+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const iterative=await makeChat({messages:[{role:'user',content:'Explain a short topic'}],
      completion:{enabled:true,targetConfidence:95,maxIterations:4,timeoutSeconds:120}});
    assert.equal(iterative.status,200);
    assert.match(iterative.headers.get('content-type'),/text\/event-stream/);
    const events=(await iterative.text()).split('\n\n').filter(Boolean).map(v=>JSON.parse(v.replace(/^data: /,'')));
    const updates=events.filter(e=>e.progress).map(e=>e.progress);
    const finished=events.find(e=>e.completion)?.completion;
    assert.deepEqual(updates.filter(e=>e.stage==='drafting').map(e=>e.attempt),[1,2]);
    assert.deepEqual(updates.filter(e=>e.stage==='reviewing').map(e=>e.attempt),[1,2]);
    assert.equal(finished.reached,true);
    assert.equal(finished.confidence,96);
    assert.equal(finished.threshold,95);
    assert.equal(finished.iterations,2);
    assert.equal(events.find(e=>e.token)?.token,'Revision 2');
    assert.equal(generated,2);
    assert.equal(reviewed,2);
    const standard=await makeChat({messages:[{role:'user',content:'Hi'}]});
    assert.equal(standard.status,200);
    assert.match(await standard.text(),/Normal reply/);
    assert.equal(host.status().totalRequests,2);
  }finally{
    if(host.status().online)await host.stop();
    await close(model);
    fs.rmSync(root,{force:true,recursive:true});
  }
});
