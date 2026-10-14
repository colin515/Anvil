import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowUp,Check,Copy,Menu,MessageSquare,Plus,Square,Trash2,Pencil,WifiOff,LockKeyhole,PanelLeftClose,PanelLeftOpen,Flame,AlertCircle,BrainCircuit,Sparkles,SlidersHorizontal} from 'lucide-react';

type CompletionOutcome={confidence:number|null;threshold:number;iterations:number;maxIterations:number;reached:boolean;reason:'threshold_met'|'max_iterations'|'review_unavailable';feedback:string};
type CompletionProgress={stage:'drafting'|'reviewing'|'assessed';attempt:number;maxIterations:number;confidence:number|null;threshold:number;feedback?:string};
type CompletionSettings={enabled:boolean;targetConfidence:number;maxIterations:number;timeoutSeconds:number};
const defaultCompletion:CompletionSettings={enabled:false,targetConfidence:95,maxIterations:4,timeoutSeconds:120};
function readCompletion():CompletionSettings{
  try{
    const saved=JSON.parse(localStorage.getItem('anvil:auto-completion:v1')||'{}');
    const clamp=(v:unknown,def:number,min:number,max:number)=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max?v:def;
    return {enabled:saved.enabled===true,targetConfidence:clamp(saved.targetConfidence,95,50,99),
      maxIterations:clamp(saved.maxIterations,4,1,6),timeoutSeconds:clamp(saved.timeoutSeconds,120,30,240)};
  }catch{return {...defaultCompletion};}
}
type Message={role:'user'|'assistant';content:string;completion?:CompletionOutcome};
type Conversation={id:string;title:string;messages:Message[];updated:number};
type HostInfo={online:boolean;model:string|null;activeRequests:number;maxConcurrent:number;accessEnabled:boolean};
type ThinkingMode='off'|'low'|'medium'|'high';
type Session={authenticated:boolean;accessEnabled:boolean};
const STORE='anvil:conversations:v2';
const createChat=():Conversation=>({id:crypto.randomUUID(),title:'New conversation',messages:[],updated:Date.now()});
function readSaved():Conversation[]{
  try{
    const value=JSON.parse(localStorage.getItem(STORE)||'[]');
    return Array.isArray(value)?value.filter(c=>typeof c?.id==='string'&&Array.isArray(c.messages)&&typeof c.title==='string'):[];
  }catch{return [];}
}
function escapeTitle(text:string){return text.replace(/\s+/g,' ').trim().slice(0,46)||'New conversation';}

function ChatText({value}:{value:string}){
  return <div className="anvil-answer">{value.split(/(```[\s\S]*?```)/g).map((part,i)=>
    part.startsWith('```')?<pre key={i}><code>{part.slice(3,-3).replace(/^\w+\n/,'')}</code></pre>:<span key={i}>{part}</span>)}</div>;
}
export function PublicChat(){
  const [host,setHost]=useState<HostInfo|null>(null);
  const [session,setSession]=useState<Session>({authenticated:false,accessEnabled:true});
  const [code,setCode]=useState('');
  const [error,setError]=useState('');
  const [loginBusy,setLoginBusy]=useState(false);
  const [conversations,setConversations]=useState<Conversation[]>(readSaved);
  const [selected,setSelected]=useState<string|null>(null);
  const [input,setInput]=useState('');
  const [thinking,setThinking]=useState<ThinkingMode>(()=>{
    try{const mode=localStorage.getItem('anvil:thinking');return mode==='low'||mode==='medium'||mode==='high'?mode:'off'}catch{return 'off'}
  });
  const [completionSettings,setCompletionSettings]=useState<CompletionSettings>(readCompletion);
  const [completionSettingsOpen,setCompletionSettingsOpen]=useState(false);
  const [completionProgress,setCompletionProgress]=useState<CompletionProgress|null>(null);
  const [busy,setBusy]=useState(false);
  const [sidebar,setSidebar]=useState(true);
  const [copied,setCopied]=useState<number|null>(null);
  const scroller=useRef<HTMLDivElement>(null);
  const pinned=useRef(true);
  const textarea=useRef<HTMLTextAreaElement>(null);
  const controller=useRef<AbortController|null>(null);
  const frame=useRef(0);
  const pending=useRef<{id:string;messages:Message[]}|null>(null);
  const current=conversations.find(c=>c.id===selected)||null;
  const messages=current?.messages||[];

  const refresh=useCallback(async()=>{
    try{
      const [h,s]=await Promise.all([fetch('/api/status',{cache:'no-store'}),fetch('/api/session',{cache:'no-store'})]);
      if(!h.ok||!s.ok)throw Error('Server unavailable');
      setHost(await h.json());setSession(await s.json());
    }catch{setHost({online:false,model:null,activeRequests:0,maxConcurrent:2,accessEnabled:true});}
  },[]);
  useEffect(()=>{void refresh();const i=window.setInterval(()=>void refresh(),7000);return()=>window.clearInterval(i)},[refresh]);
  useEffect(()=>{const t=window.setTimeout(()=>{
    try{localStorage.setItem(STORE,JSON.stringify(conversations));}
    catch{setError('Browser storage is full. Export important messages or delete old conversations.');}
  },350);return()=>clearTimeout(t);},[conversations]);
  useEffect(()=>{if(!selected&&conversations.length)setSelected(conversations[0].id)},[]);
  useEffect(()=>{try{localStorage.setItem('anvil:thinking',thinking)}catch{/* Private browsing */}},[thinking]);
  useEffect(()=>{try{localStorage.setItem('anvil:auto-completion:v1',JSON.stringify(completionSettings))}catch{/* Private browsing */}},[completionSettings]);
  useEffect(()=>{if(pinned.current)scroller.current?.scrollTo({top:scroller.current.scrollHeight,behavior:'instant'})},[messages]);
  useEffect(()=>{if(textarea.current){textarea.current.style.height='auto';textarea.current.style.height=Math.min(240,textarea.current.scrollHeight)+'px'}},[input]);
  useEffect(()=>()=>{controller.current?.abort();cancelAnimationFrame(frame.current)},[]);

  function updateChat(id:string,items:Message[]){
    setConversations(old=>old.map(c=>c.id===id?{...c,messages:items,title:c.messages.length===0&&items[0]?.role==='user'?escapeTitle(items[0].content):c.title,updated:Date.now()}:c));
  }
  function newChat(){
    if(busy)stop();
    setSelected(null);setInput('');setError('');pinned.current=true;
    textarea.current?.focus();
    if(window.innerWidth<750)setSidebar(false);
  }
  function chooseChat(id:string){
    if(busy)stop();
    setSelected(id);setError('');pinned.current=true;
    if(window.innerWidth<750)setSidebar(false);
  }
  function renameChat(id:string){
    const chat=conversations.find(c=>c.id===id);if(!chat)return;
    const title=window.prompt('Conversation name',chat.title);
    if(title?.trim())setConversations(old=>old.map(c=>c.id===id?{...c,title:escapeTitle(title)}:c));
  }
  function deleteChat(id:string){
    if(!window.confirm('Delete this saved conversation from this browser?'))return;
    if(id===selected&&busy)stop();
    setConversations(old=>old.filter(c=>c.id!==id));
    if(id===selected)setSelected(null);
  }
  function stop(){controller.current?.abort();controller.current=null;setBusy(false);setCompletionProgress(null);}
  function flush(){
    cancelAnimationFrame(frame.current);
    frame.current=requestAnimationFrame(()=>{
      const record=pending.current;
      if(record)updateChat(record.id,record.messages);
      frame.current=0;
    });
  }
  async function login(e:FormEvent){
    e.preventDefault();setLoginBusy(true);setError('');
    try{
      const r=await fetch('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});
      const data=await r.json();if(!r.ok)throw Error(data.error||'Invalid code');
      setSession({authenticated:true,accessEnabled:true});setCode('');
    }catch(e){setError(e instanceof Error?e.message:'Login failed');}
    finally{setLoginBusy(false);}
  }
  async function send(event?:FormEvent){
    event?.preventDefault();
    const content=input.trim();if(!content||busy)return;
    if(content.length>120000){setError('A single message can use up to 120,000 characters for safety.');return;}
    let id=selected;
    const newConversation=!id?createChat():null;
    if(newConversation){id=newConversation.id;setSelected(id);setConversations(old=>[newConversation,...old]);}
    if(!id)return;
    const outgoing=[...messages,{role:'user' as const,content}];
    const initial=[...outgoing,{role:'assistant' as const,content:''}];
    setInput('');setBusy(true);setError('');setCompletionProgress(null);pinned.current=true;
    updateChat(id,initial);
    const abort=new AbortController();controller.current=abort;
    let answer='',buffer='',streamError:string|null=null;
    let outcome:CompletionOutcome|undefined;
    try{
      const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({messages:outgoing.slice(-72),thinking,completion:completionSettings}),signal:abort.signal});
      if(r.status===401){setSession({authenticated:false,accessEnabled:true});throw Error('Access code required');}
      if(!r.ok||!r.body){const d=await r.json().catch(()=>({error:'Could not contact model'}));throw Error(d.error||'Could not contact model');}
      const reader=r.body.getReader(),decoder=new TextDecoder();
      while(true){
        const {done,value}=await reader.read();if(done)break;
        buffer+=decoder.decode(value,{stream:true});
        const chunks=buffer.split('\n\n');buffer=chunks.pop()||'';
        for(const chunk of chunks){
          for(const line of chunk.split('\n')){
            if(!line.startsWith('data: '))continue;
            let payload:{token?:string;error?:string;done?:boolean;progress?:CompletionProgress;completion?:CompletionOutcome};
            try{payload=JSON.parse(line.slice(6));}catch{continue}
            if(payload.error){streamError=payload.error;break;}
            if(payload.progress)setCompletionProgress(payload.progress);
            if(payload.completion)outcome=payload.completion;
            if(payload.token){
              answer+=payload.token;
              pending.current={id,messages:[...outgoing,{role:'assistant',content:answer}]};
              flush();
            }
          }
          if(streamError)break;
        }
        if(streamError)break;
      }
      if(streamError)throw Error(streamError);
      if(!abort.signal.aborted)updateChat(id,[...outgoing,{role:'assistant',content:answer,...(outcome?{completion:outcome}:{})}]);
    }catch(e){
      const aborting=abort.signal.aborted;
      if(!aborting)setError(e instanceof Error?e.message:'The response could not be completed');
      updateChat(id,[...outgoing,...(answer?[{role:'assistant' as const,content:answer,...(outcome?{completion:outcome}:{})}]:[])]);
    }finally{
      cancelAnimationFrame(frame.current);frame.current=0;pending.current=null;
      controller.current=null;setBusy(false);setCompletionProgress(null);textarea.current?.focus();
    }
  }
  async function copyMessage(value:string,index:number){
    try{await navigator.clipboard.writeText(value);setCopied(index);setTimeout(()=>setCopied(null),1400)}catch{setError('Copy is not available in this browser.');}
  }
  const offline=host&&!host.online;
  const authenticated=!session.accessEnabled||session.authenticated;
  const ordered=[...conversations].sort((a,b)=>b.updated-a.updated);
  return <div className="anvil-chat-app">
    <aside className={`anvil-chat-sidebar ${sidebar?'expanded':'collapsed'}`}>
      <div className="anvil-chat-side-top">
        <button className="anvil-chat-rail-button" aria-label={sidebar?'Collapse sidebar':'Expand sidebar'} title={sidebar?'Collapse sidebar':'Expand sidebar'} onClick={()=>setSidebar(v=>!v)}>{sidebar?<PanelLeftClose size={20}/>:<PanelLeftOpen size={20}/>}</button>
        {sidebar&&<span className="anvil-chat-wordmark"><Flame size={18}/> Anvil</span>}
      </div>
      <button className="anvil-chat-new" onClick={newChat} title="New chat"><Plus size={19}/>{sidebar&&<span>New chat</span>}</button>
      {sidebar&&<>
        <div className="anvil-chat-history-label">RECENT CHATS</div>
        <div className="anvil-chat-history">
          {ordered.length===0?<p className="anvil-chat-nohistory">Your conversations will appear here and stay saved in this browser.</p>:
          ordered.map(c=><div key={c.id} className={`anvil-chat-history-row ${selected===c.id?'selected':''}`}>
            <button className="anvil-chat-history-select" onClick={()=>chooseChat(c.id)} title={c.title}><MessageSquare size={16}/><span>{c.title}</span></button>
            <button onClick={()=>renameChat(c.id)} title="Rename" aria-label="Rename chat"><Pencil size={13}/></button>
            <button onClick={()=>deleteChat(c.id)} title="Delete" aria-label="Delete chat"><Trash2 size={13}/></button>
          </div>)}
        </div>
      </>}
      <div className="anvil-chat-side-bottom"><span className="anvil-chat-status-dot"/>{sidebar&&<span>LAN AI · Your PC</span>}</div>
    </aside>
    <main className="anvil-chat-content">
      <header className="anvil-chat-topbar">
        <button className="anvil-chat-mobile-menu" title="Menu" aria-label="Menu" onClick={()=>setSidebar(v=>!v)}><Menu size={20}/></button>
        <span className="anvil-chat-top-title">Anvil <span className="anvil-chat-model">{host?.model||'Local AI'}</span></span>
        <span className="anvil-chat-private"><span/> LOCAL NETWORK</span>
      </header>
      {offline||!host?<div className="anvil-chat-offline"><WifiOff size={28}/><h2>{offline?'Server offline':'Connecting…'}</h2><p>Start the Anvil LAN server on your Windows PC and refresh this page.</p><button onClick={()=>void refresh()}>Retry</button></div>:
      !authenticated?<div className="anvil-chat-login">
        <div className="anvil-chat-login-icon"><LockKeyhole size={26}/></div>
        <h1>Connect to Anvil</h1><p>Enter the access code shown in the Anvil desktop app. Your PC owner can disable this requirement in Settings.</p>
        <form onSubmit={login}><label htmlFor="anvil-code">Access code</label><input id="anvil-code" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} placeholder="Enter access code" required/><button type="submit" disabled={loginBusy}>{loginBusy?'Checking…':'Connect'}</button></form>
        {error&&<p className="anvil-chat-error" role="alert">{error}</p>}
      </div>:
      <>
        <div className="anvil-chat-scroll" ref={scroller} onScroll={e=>{const node=e.currentTarget;pinned.current=node.scrollHeight-node.scrollTop-node.clientHeight<135}} aria-label="Messages">
          {messages.length===0?<div className="anvil-chat-welcome"><span className="anvil-chat-welcome-mark"><Flame size={27}/></span><h1>Where should we start?</h1><p>Ask anything. Powered by {host.model||'your local AI'}.</p></div>:
          <div className="anvil-chat-thread">
            {messages.map((m,i)=><article className={`anvil-chat-message ${m.role}`} key={i}>
              {m.role==='assistant'&&<div className="anvil-chat-assistant-icon"><Flame size={16}/></div>}
              <div className="anvil-chat-message-content">
                {m.role==='assistant'&&<span className="anvil-chat-label">Anvil</span>}
                {m.content?<ChatText value={m.content}/>:busy&&i===messages.length-1?<span className="anvil-chat-thinking">Thinking…</span>:null}
                {m.role==='assistant'&&m.completion&&<div className={`anvil-completion-outcome ${m.completion.reached?'reached':'partial'}`} role="status">
                  <Sparkles size={14}/><span>{m.completion.confidence===null?'Self-review unavailable':`Self-rated confidence ${m.completion.confidence}%`} · {m.completion.iterations} {m.completion.iterations===1?'pass':'passes'} · {m.completion.reached?'Target met':m.completion.reason==='max_iterations'?'Attempt limit reached':'Review unavailable'}</span>
                  <span className="anvil-completion-outcome-note" title={m.completion.feedback}>{m.completion.feedback}</span>
                </div>}
                {m.role==='assistant'&&!!m.content&&<button className="anvil-chat-copy" onClick={()=>void copyMessage(m.content,i)} title="Copy response">{copied===i?<Check size={14}/>:<Copy size={14}/>} {copied===i?'Copied':'Copy'}</button>}
              </div>
            </article>)}
          </div>}
        </div>
        <div className="anvil-chat-composer-area">
          {busy&&completionProgress&&<div className="anvil-completion-progress" role="status" aria-live="polite">
            <Sparkles size={16}/><span><strong>Auto refine · pass {completionProgress.attempt}/{completionProgress.maxIterations}</strong>
              {completionProgress.stage==='drafting'?'Drafting an improved answer…':
                completionProgress.stage==='reviewing'?'Checking completeness and consistency…':
                completionProgress.confidence===null?'Unable to score this draft':`Self-rated ${completionProgress.confidence}% · target ${completionProgress.threshold}%`}</span>
          </div>}
          <form className="anvil-chat-composer" onSubmit={send}>
            <textarea ref={textarea} rows={1} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send()}}} placeholder="Ask Anvil anything…" aria-label="Chat message"/>
            <div className="anvil-chat-compose-controls"><div className="anvil-chat-controls-left">
              <span className="anvil-chat-model-name">{host.model||'No model'} · <span className="anvil-chat-online">Local Wi-Fi</span></span>
              <label className="anvil-autorefine-toggle" title="Automatically improve the answer in several drafting and review rounds">
                <input type="checkbox" checked={completionSettings.enabled} disabled={busy}
                  onChange={e=>setCompletionSettings(v=>({...v,enabled:e.target.checked}))}/>
                <Sparkles size={15}/> Auto refine
              </label>
              <button className="anvil-autorefine-config" type="button" aria-label="Automatic completion settings"
                title="Set confidence threshold, attempts and timeout"
                aria-expanded={completionSettingsOpen}
                onClick={()=>setCompletionSettingsOpen(v=>!v)}><SlidersHorizontal size={16}/></button>
              <label className="anvil-chat-thinking-select"><BrainCircuit size={16}/><span>Thinking</span>
                <select value={thinking} onChange={e=>setThinking(e.target.value as ThinkingMode)} aria-label="Thinking effort">
                  <option value="off">Off</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                </select>
              </label>
              </div>
              <button type={busy?'button':'submit'} disabled={!busy&&!input.trim()} title={busy?'Stop generation':'Send message'} aria-label={busy?'Stop generating':'Send'} onClick={busy?stop:undefined}>{busy?<Square size={16} fill="currentColor"/>:<ArrowUp size={18}/>}</button>
            </div>
          </form>
          {completionSettingsOpen&&<div className="anvil-autorefine-settings">
            <div className="anvil-autorefine-settings-header"><strong>Automatic prompt completion</strong><button type="button" onClick={()=>setCompletionSettingsOpen(false)}>Close</button></div>
            <p>Generates a draft, asks your local model to assess completeness and consistency, and revises it until the target score or attempt limit. Scores are subjective self-assessments, not verified probabilities.</p>
            <div className="anvil-autorefine-settings-grid">
              <label>Target self-rated confidence <strong>{completionSettings.targetConfidence}%</strong>
                <input aria-label="Target confidence" type="range" min="50" max="99" step="1" value={completionSettings.targetConfidence}
                onChange={e=>setCompletionSettings(v=>({...v,targetConfidence:Number(e.target.value)}))}/></label>
              <label>Maximum attempts <strong>{completionSettings.maxIterations}</strong>
                <input aria-label="Maximum attempts" type="range" min="1" max="6" value={completionSettings.maxIterations}
                onChange={e=>setCompletionSettings(v=>({...v,maxIterations:Number(e.target.value)}))}/></label>
              <label>Timeout per model call
                <select aria-label="Timeout per model call" value={completionSettings.timeoutSeconds}
                onChange={e=>setCompletionSettings(v=>({...v,timeoutSeconds:Number(e.target.value)}))}>
                  <option value={30}>30 seconds</option><option value={60}>60 seconds</option><option value={120}>2 minutes</option><option value={240}>4 minutes</option>
                </select></label>
            </div>
            <small>Each attempt uses one generation plus one separate self-review. On slow hardware, several attempts can take minutes. Stop Generation cancels the loop.</small>
          </div>}
          {error&&<div className="anvil-chat-error" role="alert"><AlertCircle size={15}/>{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
          <p className="anvil-chat-disclaimer">Chats stay in this browser. Thinking levels depend on the selected AI model. Shift + Enter adds a line.</p>
        </div>
      </>}
    </main>
    {sidebar&&<button className="anvil-chat-mobile-shade" aria-label="Close menu" onClick={()=>setSidebar(false)}/>}
  </div>;
}
