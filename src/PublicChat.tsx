import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowUp,Flame,WifiOff,LoaderCircle,MessageSquareText} from 'lucide-react';

type Message={role:'user'|'assistant';content:string};
type HostInfo={online:boolean;model:string|null;activeRequests:number;maxConcurrent:number};

export function PublicChat(){
  const [host,setHost]=useState<HostInfo|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [input,setInput]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const scrollRef=useRef<HTMLDivElement>(null);
  const anchored=useRef(true);
  const textarea=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{
    void fetch('/api/status').then(r=>r.json())
      .then(h=>setHost(h))
      .catch(()=>setHost({online:false,model:null,activeRequests:0,maxConcurrent:2}));
  },[]);
  useEffect(()=>{if(anchored.current)scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'instant'});},[messages]);

  async function send(event?:FormEvent){
    event?.preventDefault();const content=input.trim();if(!content||busy)return;
    const outgoing=[...messages,{role:'user' as const,content}];
    setMessages([...outgoing,{role:'assistant',content:''}]);setInput('');setBusy(true);setError('');anchored.current=true;
    try{
      const res=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({messages:outgoing})});
      if(!res.ok||!res.body){const body=await res.json().catch(()=>({error:'The host is unavailable.'}));throw new Error(body.error||'Chat failed');}
      const reader=res.body.getReader();const decoder=new TextDecoder();let buffer='';let reply='';let frame=0;
      const update=()=>{if(frame)return;frame=requestAnimationFrame(()=>{frame=0;setMessages([...outgoing,{role:'assistant',content:reply}])})};
      while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});
        const blocks=buffer.split('\n\n');buffer=blocks.pop()||'';
        for(const block of blocks){for(const line of block.split('\n')){if(!line.startsWith('data: '))continue;
          try{const payload=JSON.parse(line.slice(6));if(payload.error)throw new Error(payload.error);
            if(payload.token){reply+=payload.token;update();}}
          catch(e){if(e instanceof SyntaxError)continue;throw e;}
        }}
      }
      if(frame)cancelAnimationFrame(frame);setMessages([...outgoing,{role:'assistant',content:reply}]);
    }catch(e){setError(e instanceof Error?e.message:'The host is unavailable');setMessages(prev=>prev.map((m,i)=>i===prev.length-1&&m.role==='assistant'&&!m.content?{...m,content:'The response could not be completed.'}:m));}
    finally{setBusy(false);textarea.current?.focus();}
  }
  const offline=host&&!host.online;
  return <div className="public-app">
    <header className="public-header"><div className="brand"><div className="brand-icon"><Flame size={21}/></div><strong>anvil</strong><span className="brand-badge">LOCAL CHAT</span></div><div className="public-host-status"><span className={`status-dot ${offline?'off':''}`}/>{offline?'Host offline':host?.model||'Connecting…'}</div></header>
    {!host||offline?<main className="public-centered"><div className="big-line-icon"><WifiOff size={32}/></div><h1>{offline?'Local server is offline.':'Connecting to your host.'}</h1><p>{offline?'Open Anvil on your PC and start the local server to chat here.':'Checking the host connection…'}</p></main>
    :<><div className="public-conversation" ref={scrollRef} onScroll={e=>{const el=e.currentTarget;anchored.current=el.scrollHeight-el.scrollTop-el.clientHeight<120}} aria-label="Conversation">
      {messages.length===0?<div className="empty-chat"><div className="empty-orbit"><Flame size={34}/></div><span className="eyebrow">YOUR LOCAL WORKSPACE</span><h1>What can I help with?</h1><p>Your AI runs privately on this computer.</p><div className="suggestions">{['Explain a complex idea simply','Help me write something','Brainstorm a new project'].map(s=><button key={s} onClick={()=>{setInput(s);textarea.current?.focus()}}>{s}</button>)}</div></div>:
        <div className="chat-thread" aria-live="off">{messages.map((m,i)=><div key={i} className={`message ${m.role}`}><div className="message-avatar">{m.role==='assistant'?<Flame size={15}/>:<MessageSquareText size={15}/>}</div><div className="message-body"><span className="message-label">{m.role==='assistant'?'Anvil':'You'}</span><div className="message-text">{m.content||(busy&&i===messages.length-1?<span className="thinking"><LoaderCircle size={16}/> Thinking…</span>:'')}{busy&&i===messages.length-1&&m.content&&<span className="stream-caret"/>}</div></div></div>)}</div>}
    </div><div className="public-composer-wrap"><form className="public-composer" onSubmit={send}><textarea ref={textarea} rows={2} value={input} maxLength={2500} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} placeholder="Message Anvil…" disabled={busy}/><div className="composer-bottom"><span>Local model · {host.model}</span><button type="submit" disabled={busy||!input.trim()} aria-label="Send message"><ArrowUp size={18}/></button></div></form>{error&&<p className="chat-error" role="alert">{error}</p>}<p className="composer-caption">AI can make mistakes. Verify important information.</p></div></>}
  </div>;
}
