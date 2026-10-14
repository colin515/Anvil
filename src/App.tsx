import {useEffect,useMemo,useState} from 'react';
import {Activity,ArrowDownToLine,ArrowLeft,ArrowRight,ArrowUpRight,BarChart3,Check,CheckCircle2,ChevronDown,ChevronRight,CircleAlert,Cloud,Copy,Cpu,Download,ExternalLink,Flame,Gauge,Globe,HardDrive,HeartPulse,Home,Info,KeyRound,Layers3,LoaderCircle,Lock,MemoryStick,Monitor,MoreHorizontal,Play,Power,RefreshCw,Server,Settings2,Shield,ShieldCheck,Sparkles,Square,Terminal,Users,Wifi,WifiOff,Zap} from 'lucide-react';
import type {AccessState,AppState,GpuUsage,Hardware,HostState,ModelChoice,OllamaState,PullEvent,ScanEvent} from './types';
import {Meter,NumberFlow,Reveal,StatusPill} from './motion';
import {PublicChat} from './PublicChat';

type View='home'|'discover'|'models'|'console'|'settings';
const zeroHost:HostState={online:false,localUrl:null,publicUrl:null,lanUrls:[],accessEnabled:true,connectedUsers:0,activeRequests:0,totalRequests:0,invite:null};
const emptyOllama:OllamaState={online:false,models:[]};
const catalog:ModelChoice[]=[
  {id:'qwen2.5:3b',name:'Qwen 2.5 · 3B',gb:2,description:'Fast everyday conversation',tags:['Fast','General'],context:'Lightweight',fit:0,tier:'cpu',note:'Scan to check compatibility'},
  {id:'llama3.2:3b',name:'Llama 3.2 · 3B',gb:2.1,description:'Compact and responsive assistant',tags:['Fast','Chat'],context:'Lightweight',fit:0,tier:'cpu',note:'Scan to check compatibility'},
  {id:'qwen2.5:7b',name:'Qwen 2.5 · 7B',gb:4.7,description:'Balanced speed and capability',tags:['Balanced','Coding'],context:'Midrange',fit:0,tier:'cpu',note:'Scan to check compatibility'},
  {id:'gemma3:12b',name:'Gemma 3 · 12B',gb:8.1,description:'More advanced responses',tags:['Advanced','Reasoning'],context:'High-end',fit:0,tier:'cpu',note:'Scan to check compatibility'},
  {id:'qwen2.5:14b',name:'Qwen 2.5 · 14B',gb:9,description:'Advanced general and coding',tags:['Advanced','Coding'],context:'High-end',fit:0,tier:'cpu',note:'Scan to check compatibility'},
];
const nav=[{key:'home',label:'Overview',icon:Home},{key:'discover',label:'Discover models',icon:Sparkles},{key:'models',label:'My models',icon:Layers3},{key:'console',label:'Wi-Fi host',icon:BarChart3},{key:'settings',label:'Settings',icon:Settings2}] as const;
const steps=['Welcome','Hardware scan','Your needs','Benchmark','Recommendation','Download','Serve','Local chat'];
const call=<T,>(channel:string,...args:unknown[])=>window.anvil!.invoke<T>(channel,...args);
function compactError(err:unknown){return err instanceof Error?err.message:String(err)}
function displaySpeed(value:number){return value>0?`${value.toFixed(1)} tok/s`:'—'}

function Brand({small=false}:{small?:boolean}){return <div className={`brand ${small?'brand-small':''}`}><div className="brand-icon"><Flame size={small?18:22} strokeWidth={2.3}/></div><span>anvil</span></div>}
function ShellCard({children,className=''}:{children:React.ReactNode;className?:string}){return <section className={`glass-card ${className}`}>{children}</section>}
function SectionHeading({eyebrow,title,subtitle,action}:{eyebrow?:string;title:string;subtitle?:string;action?:React.ReactNode}){
  return <header className="section-header"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</header>;
}
function Stat({icon:Icon,label,value,footer,color='cyan'}:{icon:typeof Cpu;label:string;value:React.ReactNode;footer:string;color?:'cyan'|'heat'|'green'}){
  return <ShellCard className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={17} className={`icon-${color}`}/></div><div className="stat-value">{value}</div><div className="stat-footer">{footer}</div></ShellCard>;
}

export default function App(){
  const [loading,setLoading]=useState(true),[view,setView]=useState<View>('home'),[wizard,setWizard]=useState(false),[step,setStep]=useState(0);
  const [hardware,setHardware]=useState<Hardware|null>(null),[models,setModels]=useState<ModelChoice[]>(catalog);
  const [ollama,setOllama]=useState<OllamaState>(emptyOllama),[host,setHost]=useState<HostState>(zeroHost);
  const [selected,setSelected]=useState<string|null>(null),[choice,setChoice]=useState('qwen2.5:3b');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[scanning,setScanning]=useState(false);
  const [scanResults,setScanResults]=useState<Record<string,ScanEvent>>({}),[pull,setPull]=useState<PullEvent|null>(null);
  const [working,setWorking]=useState(''),[benchmark,setBenchmark]=useState<{tokens:number;seconds:number;tokensPerSecond:number}|null>(null);
  const [usage,setUsage]=useState('balanced'),[shareCopied,setShareCopied]=useState(false);
  const [access,setAccess]=useState<AccessState>({enabled:true,code:''});
  const [gpu,setGpu]=useState<GpuUsage|null>(null);
  const installed=useMemo(()=>new Set(ollama.models.map(m=>m.name)),[ollama]);
  const chosen=models.find(m=>m.id===choice)||models[0];

  useEffect(()=>{
    if(!window.anvil)return;
    const unsub=[
      window.anvil.on('scan:component',(e:ScanEvent)=>setScanResults(prev=>({...prev,[e.key]:e}))),
      window.anvil.on('scan:done',(r:{hardware:Hardware;models:ModelChoice[]})=>{setHardware(r.hardware);setModels(r.models);setChoice(r.models[0]?.id||'qwen2.5:3b');}),
      window.anvil.on('model:pull',(r:PullEvent)=>setPull(r)),
      window.anvil.on('host:status',(r:HostState)=>setHost(r)),
      window.anvil.on('app:error',(e:string)=>setError(e)),
    ];
    void call<AppState>('app:state').then(s=>{
      setHardware(s.hardware);setOllama(s.ollama);setHost(s.host);setSelected(s.activeModel);setAccess(s.access);
      if(s.hardware){setWizard(false);void call<{hardware:Hardware;models:ModelChoice[]}>('hardware:scan').then(r=>{setModels(r.models)});}
      if(s.activeModel)setChoice(s.activeModel);
    }).catch(e=>setError(compactError(e))).finally(()=>setLoading(false));
    return()=>unsub.forEach(u=>u());
  },[]);

  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(timer)},[notice]);
  useEffect(()=>{
    if(!window.anvil)return;
    let mounted=true;
    const read=()=>{void call<GpuUsage>('gpu:usage').then(x=>{if(mounted)setGpu(x)}).catch(()=>{if(mounted)setGpu(null)})};
    read();const timer=window.setInterval(read,4000);
    return()=>{mounted=false;window.clearInterval(timer);};
  },[]);

  async function updateAccess(enabled:boolean){
    if(!enabled&&!window.confirm('Disable the access code? Anyone connected to your Wi-Fi / private LAN who knows the address will be able to use your AI.'))return;
    setWorking('access');setError('');
    try{setAccess(await call<AccessState>('host:access',enabled));setNotice(enabled?'Access code required for LAN chat':'LAN chat is now open to other devices on your network');}
    catch(e){setError(compactError(e))}finally{setWorking('')}
  }
  async function regenerateCode(){
    if(!window.confirm('Generate a new access code? Existing chat sessions will need to log in again.'))return;
    try{setAccess(await call<AccessState>('host:regenerate'));setNotice('New access code generated');}
    catch(e){setError(compactError(e))}
  }
  async function stopAi(){
    if(!window.confirm('Stop hosting, interrupt current requests and unload the selected AI model from Ollama GPU/RAM?'))return;
    setWorking('stop-ai');setError('');
    try{await call('model:unload');setHost(await call<HostState>('host:status'));setNotice('AI unloaded and LAN server stopped');}
    catch(e){setError(compactError(e))}finally{setWorking('')}
  }
  async function shutDown(){
    if(!window.confirm('Stop the server, unload the AI model and quit Anvil? Ollama itself will stay installed and any separately running Ollama daemon will not be killed.'))return;
    setWorking('shutdown');try{await call('app:shutdown')}catch(e){setError(compactError(e));setWorking('')}
  }

  async function refreshOllama(){try{setOllama(await call('ollama:status'));}catch(e){setError(compactError(e));}}
  async function scan(){setScanning(true);setError('');setScanResults({});try{const r=await call<{hardware:Hardware;models:ModelChoice[]}>('hardware:scan');setHardware(r.hardware);setModels(r.models);setChoice(r.models[0]?.id||choice)}catch(e){setError(compactError(e))}finally{setScanning(false)}}
  async function download(model:string){setError('');setWorking('download');setPull({model,status:'Starting download',completed:0,total:0});
    try{const result=await call<OllamaState>('ollama:pull',model);setOllama(result);await call('model:select',model);setSelected(model);setNotice(`${model} downloaded and activated successfully`);setPull(null);}
    catch(e){setError(compactError(e));setPull(null)}finally{setWorking('')}
  }
  async function selectModel(model:string){setWorking('select');setError('');try{await call('model:select',model);setSelected(model);setChoice(model);setNotice('Active model updated');}
    catch(e){setError(compactError(e))}finally{setWorking('')}
  }
  async function runBenchmark(){setWorking('benchmark');setError('');try{setBenchmark(await call('model:benchmark',selected||choice));setNotice('Benchmark complete — measured on your machine');}catch(e){setError(compactError(e))}finally{setWorking('')}}
  async function startHost(){setWorking('start');setError('');try{const s=await call<HostState>('host:start');setHost(s);setNotice('Wi-Fi AI server started');}catch(e){setError(compactError(e))}finally{setWorking('')}}
  async function stopHost(){setWorking('stop');setError('');try{setHost(await call<HostState>('host:stop'));setNotice('LAN server stopped. Access sessions have been closed.');}catch(e){setError(compactError(e))}finally{setWorking('')}}
  async function copyLocal(url?:string){try{await call('local:copy',url);setShareCopied(true);setTimeout(()=>setShareCopied(false),1500)}catch(e){setError(compactError(e))}}
  async function openLocal(){try{await call('local:open')}catch(e){setError(compactError(e))}}
  async function openLink(url:string){try{await call('external:open',url)}catch(e){setError(compactError(e))}}
  function advance(){setStep(prev=>Math.min(7,prev+1));setError('')}
  function back(){setStep(prev=>Math.max(0,prev-1));setError('')}

  if(!window.anvil)return <PublicChat/>;
  if(loading)return <div className="boot-screen"><Brand/><span className="loading-copy">Preparing your workspace…</span></div>;


  const stopButton=<button className="button danger-outline" onClick={stopHost} disabled={!!working}><Power size={17}/> Stop hosting</button>;
  const preferredLan=host.lanUrls?.[0]?.url||'http://192.168.x.x:3000';
  const accessPanel=<div className="anvil-access">
    <div className="anvil-access-heading"><div><strong>Require access code</strong><p>Protect your AI from other people on your Wi-Fi network.</p></div>
      <label className="anvil-switch"><input type="checkbox" checked={access.enabled} onChange={e=>void updateAccess(e.target.checked)} disabled={!!working} aria-label="Require access code"/><span/></label>
    </div>
    {access.enabled?<div className="anvil-code"><div><small>ACCESS CODE</small><code>{access.code||'Loading…'}</code></div><button className="button secondary small" onClick={()=>void regenerateCode()}><RefreshCw size={14}/> Regenerate</button></div>:
      <p className="anvil-access-warning"><CircleAlert size={15}/> Anyone on your private network who has the link can use the AI.</p>}
  </div>;
  const localPanel=<div className="local-panel">
    <div className="local-status"><span className={`local-dot ${host.online?'online':''}`}/><strong>{host.online?'Wi-Fi server running':'Wi-Fi server stopped'}</strong><span className="local-only">PRIVATE NETWORK</span></div>
    <div className="local-address"><div><small>WI-FI / LAN CHAT LINK</small><code>{host.online?preferredLan:'Start server to get a Wi-Fi address'}</code></div><button className="icon-button" disabled={!host.online||!host.lanUrls?.length} title="Copy Wi-Fi link" aria-label="Copy Wi-Fi link" onClick={()=>void copyLocal(preferredLan)}>{shareCopied?<Check size={17}/>:<Copy size={17}/>}</button></div>
    {host.online&&host.lanUrls.length>1&&<div className="anvil-interface-links">{host.lanUrls.map(n=><button title={n.interface} key={n.url} onClick={()=>void copyLocal(n.url)}>{n.interface}: {n.url} <Copy size={13}/></button>)}</div>}
    <div className="anvil-local-loopback">On this PC: <code>http://127.0.0.1:3000</code></div>
    <p className="local-hint">{host.online?'Open the Wi-Fi link from another device on the same network. Windows Firewall must allow Anvil on Private networks. This is not publicly hosted on the internet.':'Start the server to create a link that devices connected to the same Wi-Fi can use.'}</p>
    <div className="local-actions">{!host.online?<button className="button primary" disabled={!selected||!!working} onClick={()=>void startHost()}><Play size={16}/> {working==='start'?'Starting…':'Start Wi-Fi server'}</button>:<><button className="button primary" onClick={()=>void openLocal()}><ExternalLink size={16}/> Open Chat</button><button className="button secondary" onClick={()=>void copyLocal(preferredLan)}><Copy size={16}/> Copy Wi-Fi link</button>{stopButton}</>}</div>
    {!selected&&<p className="local-hint">Select an installed model in My models before starting the host.</p>}
  </div>;


  return <div className="desktop-app">
    {!wizard?<>
      <aside className="sidebar"><div className="sidebar-top"><Brand/><div className="sidebar-workspace"><div className="workspace-icon"><Monitor size={16}/></div><div><strong>My workstation</strong><small>Personal host</small></div><ChevronDown size={14}/></div></div>
      <div className="nav-label">WORKSPACE</div><nav aria-label="Main navigation">{nav.map(({key,label,icon:Icon})=><button key={key} className={`nav-item ${view===key?'active':''}`} onClick={()=>setView(key)}><Icon size={18}/>{label}{key==='console'&&host.online&&<span className="tiny-live-dot"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="side-runtime"><span className={`runtime-light ${ollama.online?'running':''}`}/><span>{ollama.online?'Ollama connected':'Ollama disconnected'}</span><button title="Refresh Ollama connection" onClick={()=>void refreshOllama()}><RefreshCw size={15}/></button></div><div className="side-footer"><span>ANVIL</span><span>v0.3.0 LAN</span></div></div></aside>
      <div className="app-main"><header className="app-topbar"><div className="breadcrumbs">Workspace <ChevronRight size={14}/><span>{nav.find(n=>n.key===view)?.label}</span></div><div className="top-actions"><span className="desktop-only">Windows · Local AI</span><StatusPill state={host.online?'live':'idle'}/><button className="avatar" title="Personal host">A</button></div></header>
      <main className="app-content">
      {view==='home'&&<>
        <SectionHeading eyebrow="ANVIL / WORKSPACE" title="Your local AI workspace." subtitle="Everything you need, without the complexity." action={<button className="button secondary" onClick={()=>{setWizard(true);setStep(1)}}><RefreshCw size={15}/> Scan hardware</button>}/>
        <div className="overview-grid">
          <ShellCard className="overview-server">
            <div className="card-heading"><div><span className="eyebrow">LOCAL SERVER</span><h3>Browser chat</h3></div><Server size={20} className="icon-cyan"/></div>
            {localPanel}
          </ShellCard>
          <ShellCard className="overview-model">
            <div className="card-heading"><div><span className="eyebrow">ACTIVE MODEL</span><h3>{selected||'No model selected'}</h3></div><Layers3 size={20} className="icon-cyan"/></div>
            <p>{selected?'Your model is installed and ready to use locally.':'Select an installed model or download one from the library to get started.'}</p>
            <div className="overview-model-facts"><span>Ollama engine</span><strong className={ollama.online?'text-green':''}>{ollama.online?'Connected':'Not connected'}</strong></div>
            <div className="overview-model-facts"><span>Benchmark speed</span><strong>{benchmark?displaySpeed(benchmark.tokensPerSecond):'Not measured'}</strong></div>
            <div className="overview-model-actions"><button className="button secondary" onClick={()=>setView('models')}><Layers3 size={15}/> Manage models</button><button className="button ghost" disabled={!selected||!!working} onClick={()=>void runBenchmark()}><Gauge size={15}/> Benchmark</button></div>
          </ShellCard>
        </div>
        <div className="overview-stats">
          <ShellCard className="overview-metric"><Cpu size={18}/><div><small>PROCESSOR</small><strong title={hardware?.cpu}>{hardware?.cpu||'Not scanned'}</strong></div></ShellCard>
          <ShellCard className="overview-metric"><MemoryStick size={18}/><div><small>SYSTEM RAM</small><strong>{hardware?`${hardware.ramTotalGb} GB`:'—'}</strong></div></ShellCard>
          <ShellCard className="overview-metric"><HardDrive size={18}/><div><small>GRAPHICS</small><strong title={hardware?.gpu}>{gpu?.percent==null?'Unavailable':gpu.percent+'%'} GPU usage</strong><small className="anvil-gpu-note">{gpu?.scope||'GPU-wide, not AI-only'}</small></div></ShellCard>
        </div>
        <div className="overview-footnote"><ShieldCheck size={16}/> Only private Wi-Fi / LAN devices · No public tunnel or internet exposure configured.</div>
      </>}
      {view==='discover'&&<><SectionHeading eyebrow="MATCHED TO YOUR MACHINE" title="Find your model." subtitle="Fit scores are estimates based on available memory. Run a real benchmark after downloading." action={<button className="button ghost" onClick={()=>{setWizard(true);setStep(1)}}><RefreshCw size={15}/> Rescan</button>}/><div className="recommend-feature"><div className="recommend-icon"><Sparkles size={20}/></div><div><span className="eyebrow">RECOMMENDED FIT</span><h2>{models[0]?.name}</h2><p>{models[0]?.note} · Estimated download {models[0]?.gb} GB</p></div><button className="button primary" onClick={()=>{setChoice(models[0].id);setView('models')}}>Get model <ArrowRight size={17}/></button></div><div className="model-grid">{models.map((model,i)=><ModelCard key={model.id} model={model} installed={installed.has(model.id)} selected={selected===model.id} onDownload={()=>void download(model.id)} onSelect={()=>void selectModel(model.id)} busy={!!working} highlighted={i===0}/>)}</div></>}
      {view==='models'&&<><SectionHeading eyebrow="LOCAL MODEL LIBRARY" title="Your models." subtitle="Downloaded models live on your PC and are managed by Ollama." action={<button className="button secondary" onClick={()=>void refreshOllama()}><RefreshCw size={16}/> Refresh</button>}/>
        {!ollama.online&&<div className="warning-banner"><CircleAlert size={19}/><div><strong>Ollama is not connected.</strong><span>Install and run Ollama on your Windows PC to download and use local models.</span></div><button className="button secondary" onClick={()=>void openLink('https://ollama.com/download/windows')}>Get Ollama <ExternalLink size={14}/></button></div>}
        <div className="card-heading library-heading"><h3>{ollama.models.length} installed models</h3><span className="eyebrow">STORAGE ON YOUR MACHINE</span></div>
        {ollama.models.length?<div className="installed-list">{ollama.models.map(m=><ShellCard className="installed-row" key={m.name}><div className="model-icon"><Layers3 size={22}/></div><div className="installed-meta"><h3>{m.name}</h3><span>{m.sizeGb} GB on disk</span></div>{selected===m.name?<span className="small-chip selected">ACTIVE MODEL</span>:<button className="button secondary" disabled={!!working} onClick={()=>void selectModel(m.name)}>Make active</button>}</ShellCard>)}</div>:
          <div className="empty-panel"><div className="empty-panel-icon"><ArrowDownToLine size={25}/></div><h3>No models installed yet</h3><p>Browse recommended models below, or install Ollama first.</p></div>}
        <h3 className="spaced-title">Available to download</h3><div className="model-grid">{models.map(model=><ModelCard key={model.id} model={model} installed={installed.has(model.id)} selected={selected===model.id} onDownload={()=>void download(model.id)} onSelect={()=>void selectModel(model.id)} busy={!!working}/>)}</div>
        {pull&&<div className="progress-overlay" role="status"><div className="pull-title"><Download size={18}/><strong>Downloading {pull.model}</strong></div><p>{pull.status}</p><Meter value={pull.total?100*pull.completed/pull.total:0} label="Real downloaded bytes" tone="cyan"/><span>{pull.total?`${(pull.completed/1e6).toFixed(1)} / ${(pull.total/1e6).toFixed(1)} MB`:'Waiting for download progress…'}</span></div>}
      </>}
      {view==='console'&&<>
        <SectionHeading eyebrow="PRIVATE BY DESIGN" title="Local server." subtitle="Chat from phones and other devices connected to the same Wi-Fi." action={<StatusPill state={host.online?'live':'idle'}/>}/>
        <div className="console-grid">
          <ShellCard className="console-main"><div className="card-heading"><div><span className="eyebrow">SERVER CONTROLS</span><h3>Chat on your PC</h3></div><Monitor size={20} className="icon-cyan"/></div>{localPanel}</ShellCard>
          <ShellCard className="console-side"><div className="card-heading"><div><span className="eyebrow">RUNTIME</span><h3>Current configuration</h3></div><Settings2 size={18}/></div>
          <div className="config-line"><span>AI model</span><strong>{selected||'None selected'}</strong></div>
          <div className="config-line"><span>Ollama</span><strong>{ollama.online?'Connected':'Disconnected'}</strong></div>
          <div className="config-line"><span>Wi-Fi address</span><strong>{host.lanUrls?.[0]?.url||'Start server'}</strong></div>
          <div className="config-line"><span>Access code</span><strong>{access.enabled?'Required':'Disabled'}</strong></div>
          <div className="config-line"><span>GPU usage</span><strong>{gpu?.percent==null?'Not available':gpu.percent+'%'}</strong></div>
          <div className="config-line"><span>GPU VRAM</span><strong>{gpu?.vramUsedMb!=null?gpu.vramUsedMb+' / '+gpu.vramTotalMb+' MB':'Unavailable'}</strong></div>
          <p className="anvil-gpu-note">{gpu?.source||'Waiting for GPU driver'} · Reports GPU-wide use, not exclusive AI usage.</p>
          <button className="button secondary full-button" onClick={()=>setView('models')}>Choose model <ArrowRight size={15}/></button></ShellCard>
        </div>
        <ShellCard className="anvil-security-card">{accessPanel}<div className="anvil-shutdown-actions"><button className="button danger-outline" onClick={()=>void stopAi()} disabled={!!working}><Square size={15}/> Stop AI and unload model</button><button className="button danger-outline" onClick={()=>void shutDown()} disabled={!!working}><Power size={15}/> Shut down Anvil</button></div></ShellCard>
        <div className="overview-stats">
          <ShellCard className="overview-metric"><Activity size={18}/><div><small>REQUESTS PROCESSED</small><strong>{host.totalRequests}</strong></div></ShellCard>
          <ShellCard className="overview-metric"><Gauge size={18}/><div><small>ACTIVE REQUESTS</small><strong>{host.activeRequests}</strong></div></ShellCard>
          <ShellCard className="overview-metric"><ShieldCheck size={18}/><div><small>NETWORK ACCESS</small><strong>Private LAN / Wi-Fi</strong></div></ShellCard>
        </div>
      </>}
      {view==='settings'&&<><SectionHeading eyebrow="PREFERENCES" title="Settings." subtitle="A simple, local-first setup."/>
        <div className="settings-list">
          <ShellCard className="setting-card"><div className="setting-icon"><Monitor size={20}/></div><div><h3>Hardware detection</h3><p>Refresh CPU, RAM, GPU and storage information.</p></div><button className="button secondary" onClick={()=>{setWizard(true);setStep(1)}}>Run scan</button></ShellCard>
          <ShellCard className="setting-card"><div className="setting-icon"><Terminal size={20}/></div><div><h3>Ollama</h3><p>{ollama.online?'Connected to Ollama at 127.0.0.1:11434.':'Start Ollama to download and run local models.'}</p></div><button className="button secondary" onClick={()=>void refreshOllama()}><RefreshCw size={15}/> Refresh</button></ShellCard>
          <ShellCard className="setting-card"><div className="setting-icon"><Wifi size={20}/></div><div><h3>Wi-Fi / local network</h3><p>Anvil listens on port 3000 for devices on your private LAN. No public tunnel. Check Windows Firewall Private network permissions.</p></div><span className="small-chip selected">LAN ONLY</span></ShellCard>
          <ShellCard className="anvil-security-card">{accessPanel}</ShellCard>
          <ShellCard className="anvil-security-card"><h3>Full shutdown</h3><p>Stop the chat, unload the AI model from Ollama and exit Anvil. Ollama's own background service is not terminated.</p><button className="button danger-outline" onClick={()=>void shutDown()}><Power size={16}/> Shut down Anvil</button></ShellCard>
        </div><p className="settings-disclaimer">Anvil · Local AI for Windows · Powered by Ollama. Model compatibility estimates are not benchmarks.</p></>}
      </main></div></>:<main className="wizard-root"><div className="wizard-top"><Brand/><div className="wizard-counter">SETUP <span>{String(step+1).padStart(2,'0')} / 08</span></div><button className="wizard-exit" onClick={()=>{setWizard(false);setView('home')}} title="Exit setup"><ArrowUpRight size={17}/> Dashboard</button></div>
      <div className="wizard-progress">{steps.map((name,i)=><div className={`wizard-progress-segment ${i<=step?'filled':''}`} key={name}/>)}</div>
      <div className="wizard-body"><div className="wizard-sidebar"><div className="wizard-steps">{steps.map((name,i)=><button onClick={()=>i<=step&&setStep(i)} disabled={i>step} className={`wizard-step ${i===step?'current':''} ${i<step?'completed':''}`} key={name}><span>{i<step?<Check size={15}/>:String(i+1).padStart(2,'0')}</span>{name}</button>)}</div><div className="wizard-sidebar-note"><ShieldCheck size={19}/><span>Your computer.<br/>Your local AI.</span></div></div>
      <div className="wizard-content"><div className="wizard-scene">
      {step===0&&<Reveal><div className="welcome-graphic"><div className="welcome-core"><Flame size={43}/></div><div className="welcome-orbit orbit-a"/><div className="welcome-orbit orbit-b"/></div><span className="eyebrow heat-label">WELCOME TO ANVIL</span><h1>Your hardware.<br/><em>Your intelligence.</em></h1><p className="wizard-lead">Discover the AI your PC can run and chat privately in your browser. No cloud model required.</p><div className="wizard-features"><span><Cpu size={16}/> Detect your hardware</span><span><Sparkles size={16}/> Find the right model</span><span><Monitor size={16}/> Local browser chat</span></div></Reveal>}
      {step===1&&<><span className="eyebrow heat-label">SYSTEM DIAGNOSTICS</span><h1>Discover your power.</h1><p className="wizard-lead">Anvil checks your CPU, RAM, graphics and storage. Every result appears as soon as it's measured.</p><ShellCard className="scan-console"><div className="scan-top"><div><Activity size={17}/><strong>Hardware scanner</strong></div><span className="scan-status">{scanning?'MEASURING':hardware?'COMPLETE':'READY TO SCAN'}</span></div><HardwareDiagram active={scanning} results={scanResults}/><div className="scan-items">{[{key:'cpu',icon:Cpu,label:'Processor',default:hardware?.cpu},{key:'memory',icon:MemoryStick,label:'System memory',default:hardware&&`${hardware.ramTotalGb} GB RAM`},{key:'gpu',icon:Monitor,label:'Graphics',default:hardware?.gpu},{key:'disk',icon:HardDrive,label:'Storage',default:hardware?.diskTotalGb&&`${hardware.diskFreeGb} GB free`}].map(({key,icon:Icon,label,default:val})=><div className="scan-item" key={key}><Icon size={18}/><div><small>{label}</small><strong>{scanResults[key]?.value||val||'Not measured'}</strong></div>{scanResults[key]?.status==='complete'?<CheckCircle2 size={17} className="icon-green"/>:scanResults[key]?.status==='unknown'?<CircleAlert size={17} className="icon-heat"/>:scanning?<LoaderCircle size={16} className="spin"/>:<span className="dim-dash">—</span>}</div>)}</div></ShellCard></>}
      {step===2&&<><span className="eyebrow heat-label">FIND YOUR FIT</span><h1>How will you use AI?</h1><p className="wizard-lead">Anvil makes an initial recommendation based on hardware. Your priorities help explain the trade-offs.</p><div className="purpose-grid">{[{id:'speed',icon:Zap,title:'Fast responses',desc:'Quick answers and smooth everyday chat'},{id:'balanced',icon:Layers3,title:'Balanced performance',desc:'Good quality without exhausting resources'},{id:'quality',icon:Sparkles,title:'Maximum capability',desc:'Prioritize model quality over response speed'}].map(({id,icon:Icon,title,desc})=><button className={`purpose-card ${usage===id?'selected':''}`} key={id} onClick={()=>setUsage(id)}><Icon size={22}/><strong>{title}</strong><span>{desc}</span>{usage===id&&<CheckCircle2 size={17} className="purpose-check"/>}</button>)}</div><p className="hint"><Info size={15}/> Hardware compatibility remains the deciding factor. Actual speed must be benchmarked.</p></>}
      {step===3&&<><span className="eyebrow heat-label">REAL PERFORMANCE</span><h1>Measure. Don't guess.</h1><p className="wizard-lead">Benchmarking uses a real local model and its measured token generation speed. You can also benchmark after setup.</p><ShellCard className="benchmark-card"><Gauge size={33} className="icon-cyan"/><span className="eyebrow">ACTUAL GENERATION SPEED</span><div className="benchmark-number">{benchmark?<><NumberFlow value={benchmark.tokensPerSecond} digits={1}/> <small>tokens / sec</small></>:<span>— <small>tokens / sec</small></span>}</div><p>{benchmark?`${benchmark.tokens} tokens generated in ${benchmark.seconds} seconds.`:'Install a model first to collect real speed measurements.'}</p><button className="button secondary" disabled={!selected||!!working} onClick={runBenchmark}>{working==='benchmark'?<LoaderCircle size={16} className="spin"/>:<Play size={16}/>} {working==='benchmark'?'Benchmarking…':'Run benchmark'}</button></ShellCard></>}
      {step===4&&<><span className="eyebrow heat-label">PERSONALIZED MODEL FIT</span><h1>Meet your match.</h1><p className="wizard-lead">We've ranked models for your machine. Fit scores estimate memory suitability — quality and measured speed can vary.</p><div className="wizard-models">{models.slice(0,4).map((m,i)=><button key={m.id} className={`wizard-model ${choice===m.id?'selected':''}`} onClick={()=>setChoice(m.id)}><div className="wizard-model-badge">{i===0?<Sparkles size={17}/>:<Layers3 size={17}/>}</div><div className="wizard-model-main"><div className="wizard-model-name">{m.name} {i===0&&<span className="tiny-tag">RECOMMENDED</span>}</div><span>{m.note}</span><Meter value={m.fit} tone={m.tier==='excellent'?'green':'heat'}/></div><strong>{m.fit}%</strong></button>)}</div></>}
      {step===5&&<><span className="eyebrow heat-label">MAKE IT REAL</span><h1>Bring your model home.</h1><p className="wizard-lead">Anvil uses your installed Ollama engine to download models to your own machine. Downloads show real byte progress.</p><ShellCard className="download-card"><div className="download-card-icon"><ArrowDownToLine size={31}/></div><h2>{chosen?.name}</h2><p>{chosen?.description}</p><div className="download-card-details"><span>ESTIMATED SIZE</span><strong>{chosen?.gb} GB</strong></div><div className="download-card-details"><span>LOCAL RUNTIME</span><strong>{ollama.online?'Ollama connected':'Ollama missing'}</strong></div>{installed.has(choice)?<div className="download-complete"><CheckCircle2 size={18}/> Downloaded and ready</div>:<button className="button primary full-button" onClick={()=>void download(choice)} disabled={!ollama.online||!!working}><Download size={17}/> {working==='download'?'Downloading…':'Download model'}</button>}
        {pull&&<div className="download-progress"><div className="pull-info"><strong>{pull.status}</strong><span>{pull.total?Math.round(100*pull.completed/pull.total)+'%':'Waiting for bytes…'}</span></div><Meter value={pull.total?100*pull.completed/pull.total:0} tone="cyan"/><small>{pull.total?`${Math.round(pull.completed/1e6)} of ${Math.round(pull.total/1e6)} MB`:'Progress will appear when Ollama reports it'}</small></div>}
        {!ollama.online&&<button className="text-link" onClick={()=>void openLink('https://ollama.com/download/windows')}>Install Ollama first <ExternalLink size={13}/></button>}{installed.has(choice)&&selected!==choice&&<button className="button secondary full-button" onClick={()=>void selectModel(choice)} disabled={!!working}>Set as active model <ArrowRight size={16}/></button>}</ShellCard></>}
      {step===6&&<><span className="eyebrow heat-label">LOCAL SERVER</span><h1>Ready to serve.</h1><p className="wizard-lead">Devices connected to your private Wi-Fi can access this server at its LAN address.</p><ShellCard className="serve-card"><div className={`serve-mark ${host.online?'on':''}`}><Server size={35}/></div><StatusPill state={host.online?'live':'idle'}/><h2>{host.online?'Your local server is running.':'The forge is ready.'}</h2><p>{host.online?'http://127.0.0.1:3000':'Start the server to activate http://127.0.0.1:3000'}</p>{selected?<div className="serve-model"><Layers3 size={16}/> {selected}</div>:<div className="warning-inline"><CircleAlert size={17}/> Select an installed model in the previous step.</div>}{host.online?<div className="local-actions"><button className="button primary" onClick={()=>void openLocal()}><ExternalLink size={16}/> Open Chat</button>{stopButton}</div>:<button className="button primary" disabled={!selected||!!working} onClick={startHost}><Play size={17}/> Start server</button>}</ShellCard></>}
      {step===7&&<><span className="eyebrow heat-label">LOCAL CHAT</span><h1>You're ready.</h1><p className="wizard-lead">Use your computer or another device connected to the same private Wi-Fi. This is not a public internet link.</p><ShellCard className="wizard-share-card">{localPanel}</ShellCard></>}
      </div>{error&&<div className="error-banner" role="alert"><CircleAlert size={18}/><span>{error}</span><button onClick={()=>setError('')}>Dismiss</button></div>}
      <div className="wizard-actions"><button className="button ghost" onClick={back} disabled={step===0}><ArrowLeft size={17}/> Back</button><span className="wizard-step-label">{steps[step]}</span>{step<7?<button className="button primary" onClick={advance} disabled={step===1&&(!hardware||scanning)}>{step===0?'Get started':'Continue'} <ArrowRight size={17}/></button>:<button className="button primary" onClick={()=>{setWizard(false);setView('home')}}>Open dashboard <ArrowRight size={17}/></button>}{step===1&&!scanning&&<button className="button secondary" onClick={scan}><RefreshCw size={16}/> {hardware?'Rescan':'Scan PC'}</button>}</div></div></div></main>}
    {notice&&<div className="toast" role="status"><CheckCircle2 size={17}/>{notice}</div>}
    {error&&!wizard&&<div className="toast error-toast" role="alert"><CircleAlert size={17}/>{error}<button onClick={()=>setError('')}>Close</button></div>}
  </div>;
}

function HardwareDiagram({active,results}:{active:boolean;results:Record<string,ScanEvent>}){
  return <div className={`hardware-diagram ${active?'scanning':''}`}><svg viewBox="0 0 480 180" role="img" aria-label="Schematic of CPU, GPU, memory and storage">
    <g fill="none" stroke="currentColor" strokeWidth="1.1" className="circuit-line"><rect x="170" y="20" width="140" height="140" rx="13"/><rect x="198" y="47" width="84" height="86" rx="6"/><path d="M170 62H111V36H49 M170 120H111V146H49 M310 62H372V36H430 M310 120H372V146H430"/>{Array.from({length:6},(_,i)=><g key={i}><path d={`M${191+i*17} 38v9 M${191+i*17} 133v9`}/></g>)}</g>
    <g fill="none" strokeWidth="2"><path className={results.cpu?'diagnostic-lit':'diagnostic-dim'} d="M170 62H111V36H49"/><path className={results.memory?'diagnostic-lit':'diagnostic-dim'} d="M170 120H111V146H49"/><path className={results.gpu?'diagnostic-lit':'diagnostic-dim'} d="M310 62H372V36H430"/><path className={results.disk?'diagnostic-lit':'diagnostic-dim'} d="M310 120H372V146H430"/></g>
    <g fill="currentColor" fontSize="11"><text x="239" y="96" textAnchor="middle" fontWeight="600">ANVIL</text><text x="49" y="27">CPU</text><text x="49" y="169">RAM</text><text x="430" y="27" textAnchor="end">GPU</text><text x="430" y="169" textAnchor="end">SSD</text></g>
    </svg></div>;
}

function ModelCard({model,installed,selected,onDownload,onSelect,busy,highlighted=false}:{model:ModelChoice;installed:boolean;selected:boolean;onDownload:()=>void;onSelect:()=>void;busy:boolean;highlighted?:boolean}){
  return <ShellCard className={`model-card ${highlighted?'highlighted':''}`}><div className="model-card-top"><div className="model-icon"><Sparkles size={20}/></div>{highlighted?<span className="tiny-tag">BEST MATCH</span>:<MoreHorizontal size={18} className="muted-icon"/>}</div><h3>{model.name}</h3><p>{model.description}</p><div className="model-tags">{model.tags.map(t=><span key={t}>{t}</span>)}</div><div className="fit-heading"><span>MEMORY FIT ESTIMATE</span><strong>{model.fit||'—'}{model.fit?'%':''}</strong></div><Meter value={model.fit} tone={model.tier==='excellent'?'green':'heat'}/><span className="fit-note">{model.note}</span><div className="model-card-footer"><span><HardDrive size={14}/> ~{model.gb} GB</span>{selected?<span className="model-active"><Check size={15}/> Active</span>:installed?<button className="button secondary small" onClick={onSelect} disabled={busy}>Use model</button>:<button className="button secondary small" onClick={onDownload} disabled={busy}><Download size={15}/> Download</button>}</div></ShellCard>;
}
