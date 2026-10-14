'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {normalizeCompletion,parseAssessment,runAutoCompletion}=require('../electron/auto-complete.cjs');

function mockOllama(confidences){
  const requests=[];
  let generation=0,assessment=0;
  const fetchImpl=async(_url,opts)=>{
    const body=JSON.parse(opts.body);
    requests.push(body);
    let content;
    if(body.format==='json'){
      const confidence=confidences[assessment++];
      content=typeof confidence==='number'?
        JSON.stringify({confidence,feedback:'Improve specificity and cover missing considerations.'}):'not valid JSON';
    }else content='Answer draft '+(++generation)+'.';
    return {ok:true,json:async()=>({message:{content}})};
  };
  return {fetchImpl,requests};
}
const base={
  ollamaUrl:'http://127.0.0.1:11434',
  model:'qwen2.5:3b',
  messages:[{role:'user',content:'Explain something carefully'}],
  settings:{enabled:true,targetConfidence:95,maxIterations:4,timeoutSeconds:120}
};
test('completion settings are clamped by safe bounds',()=>{
  assert.deepEqual(normalizeCompletion({enabled:true,targetConfidence:95,maxIterations:4,timeoutSeconds:120}),
    {enabled:true,targetConfidence:95,maxIterations:4,timeoutSeconds:120});
  assert.deepEqual(normalizeCompletion({enabled:true,targetConfidence:500,maxIterations:999,timeoutSeconds:0}),
    {enabled:true,targetConfidence:95,maxIterations:4,timeoutSeconds:120});
  assert.equal(normalizeCompletion().enabled,false);
  assert.equal(parseAssessment('{"confidence":99,"feedback":"good"}').confidence,99);
  assert.equal(parseAssessment('{"confidence":120}').confidence,null);
  assert.equal(parseAssessment('garbage').confidence,null);
});
test('automatic completion stops when self-review meets configured threshold',async()=>{
  const mock=mockOllama([81,96,99]);
  const progress=[];
  const result=await runAutoCompletion({...base,fetchImpl:mock.fetchImpl,onProgress:p=>progress.push(p)});
  assert.equal(result.reached,true);
  assert.equal(result.confidence,96);
  assert.equal(result.iterations,2);
  assert.equal(result.reason,'threshold_met');
  assert.equal(result.answer,'Answer draft 2.');
  assert.equal(mock.requests.length,4);
  assert.equal(progress.filter(p=>p.stage==='assessed').length,2);
  assert.equal(mock.requests[1].format,'json');
  assert.equal(mock.requests[1].options.temperature,0);
});
test('automatic completion returns the best available last draft after attempt limit',async()=>{
  const mock=mockOllama([50,75,88,91]);
  const result=await runAutoCompletion({...base,settings:{enabled:true,targetConfidence:95,maxIterations:3,timeoutSeconds:120},fetchImpl:mock.fetchImpl});
  assert.equal(result.reached,false);
  assert.equal(result.iterations,3);
  assert.equal(result.confidence,88);
  assert.equal(result.reason,'max_iterations');
  assert.equal(mock.requests.length,6);
  assert.match(result.answer,/draft 3/);
});
test('bad evaluator response never claims an unearned confidence score',async()=>{
  const mock=mockOllama(['invalid']);
  const result=await runAutoCompletion({...base,fetchImpl:mock.fetchImpl});
  assert.equal(result.reached,false);
  assert.equal(result.confidence,null);
  assert.equal(result.reason,'review_unavailable');
  assert.equal(result.iterations,1);
  assert.equal(mock.requests.length,2);
});
test('AbortController stops further generations and reviews',async()=>{
  const controller=new AbortController();
  const mock=mockOllama([75,100]);
  await assert.rejects(runAutoCompletion({...base,signal:controller.signal,
    fetchImpl:mock.fetchImpl,
    onProgress:p=>{if(p.stage==='reviewing')controller.abort();}
  }),/cancelled/);
  assert.equal(mock.requests.length,1);
});
