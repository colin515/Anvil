import {useEffect,useMemo,useRef,useState} from 'react';
import {BarChart3,BookOpen,ChevronLeft,ChevronRight,Download,FileBarChart,FilePlus,FileText,FolderOpen,Grid2X2,Layers3,Mail,Palette,Plus,Presentation,Save,Search,Settings2,Share2,Shapes,Trash2,Upload,Users,Check,Copy,SlidersHorizontal,Bell,Code2,ShieldCheck} from 'lucide-react';
import './studio.css';

type Kind='presentation'|'visualization'|'report'|'diagram';
type Datum=Record<string,string|number>;
type Slide={title:string;body:string};
type Project={id:string;kind:Kind;name:string;updated:number;theme:string;chart:'bar'|'line'|'donut';data:Datum[];slides:Slide[];nodes:string[];versions?:{date:number;name:string;slides:Slide[];nodes:string[];data:Datum[]}[]};
type Plugin={id:string;name:string;description:string;kind:string;installed:boolean;custom?:boolean};
type State={projects:Project[];name:string;theme:string;widgets:string[];plugins:Plugin[];notifications:{id:string;text:string;date:number}[]};
type Page='dashboard'|'projects'|'editor'|'gallery'|'plugins'|'profile'|'notifications'|'integrations';
const STORE='anvil:studio:v1';
const themes=['Graphite','Light','Indigo'];
const kinds:Kind[]=['presentation','visualization','report','diagram'];
const seeds:Datum[]=[{Month:'Jan',Value:24},{Month:'Feb',Value:40},{Month:'Mar',Value:33},{Month:'Apr',Value:62},{Month:'May',Value:51},{Month:'Jun',Value:78}];
const builtin:Plugin[]=[
{id:'slides',name:'Presentation Studio',description:'Create editable slide decks and export a shareable HTML presentation.',kind:'Creator',installed:true},
{id:'chart',name:'Data Explorer',description:'Import CSV/JSON and generate interactive bar, line and donut charts.',kind:'Analytics',installed:true},
{id:'diagram',name:'Flow Diagrams',description:'Build and reorder step-by-step process diagrams.',kind:'Creator',installed:true},
{id:'report',name:'Report Builder',description:'Summarize data and export a printable HTML report.',kind:'Analytics',installed:true},
{id:'email',name:'Email Composer',description:'Open an email draft in your installed mail client. No inbox access.',kind:'Utility',installed:false}
];
function uid(){
  try{if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID()}catch{}
  return 'st-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
}
function base():State{return {projects:[],name:'Local creator',theme:'Graphite',widgets:['Recent projects','Quick actions','Data overview'],plugins:builtin,notifications:[]}}
function load():State{
  try{
    const parsed=JSON.parse(localStorage.getItem(STORE)||'null') as State|null;
    if(!parsed||!Array.isArray(parsed.projects))return base();
    return {...base(),...parsed,plugins:Array.isArray(parsed.plugins)?parsed.plugins:builtin,widgets:Array.isArray(parsed.widgets)?parsed.widgets:base().widgets};
  }catch{return base();}
}
function makeProject(kind:Kind,name:string):Project{
  return {id:uid(),kind,name:name||'Untitled '+kind,updated:Date.now(),chart:'bar',theme:'Graphite',
    data:kind==='visualization'||kind==='report'?seeds:[],
    slides:kind==='presentation'?[{title:name||'Untitled presentation',body:'A clear opening statement and overview.'},{title:'Key insights',body:'Summarize the most important findings.'},{title:'Next steps',body:'Close with specific actions and ownership.'}]:[],
    nodes:kind==='diagram'?['Start','Collect information','Review findings','Present result']:[]};
}
function parseCells(src:string):string[][]{
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  for(let i=0;i<src.length;i++){
    const c=src[i];if(c==='"'){
      if(quoted&&src[i+1]==='"'){cell+='"';i++}else quoted=!quoted;
    }else if(c===','&&!quoted){row.push(cell);cell=''}
    else if((c==='\n'||c==='\r')&&!quoted){
      if(c==='\r'&&src[i+1]==='\n')i++;
      row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';
    }else cell+=c;
  }
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  return rows;
}
function parseData(text:string,name:string):Datum[]{
  if(name.toLowerCase().endsWith('.json')){
    const parsed=JSON.parse(text);
    const data=Array.isArray(parsed)?parsed:Array.isArray(parsed.data)?parsed.data:null;
    if(!data)throw Error('JSON must be an array of records or an object with a data array.');
    return data.slice(0,2000).map((item:unknown)=>{if(typeof item!=='object'||!item||Array.isArray(item))throw Error('Each JSON record must be an object.');return Object.fromEntries(Object.entries(item).map(([k,v])=>[k,typeof v==='number'?v:String(v??'')])) as Datum});
  }
  const rows=name.endsWith('.tsv')?text.trim().split(/\r?\n/).map(l=>l.split('\t')):parseCells(text);
  if(rows.length<2)throw Error('The file needs a header row and at least one data row.');
  const names=rows[0].map((x,i)=>x.trim()||'Column '+(i+1));
  return rows.slice(1,2001).map(row=>Object.fromEntries(names.map((key,i)=>{
    const raw=(row[i]||'').trim();const number=Number(raw);return [key,raw!==''&&Number.isFinite(number)?number:raw]
  })) as Datum);
}
function download(name:string,content:string,type:string){
  const blob=new Blob([content],{type});const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);link.download=name;link.click();
  window.setTimeout(()=>URL.revokeObjectURL(link.href),1000);
}
function htmlEscape(v:unknown){
  return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function displayKind(k:Kind){return {presentation:'Presentation',visualization:'Visualization',report:'Report',diagram:'Diagram'}[k]}
function projectIcon(k:Kind){return {presentation:Presentation,visualization:BarChart3,report:FileText,diagram:Shapes}[k]}
function DataChart({data,mode}:{data:Datum[];mode:'bar'|'line'|'donut'}){
  const keys=Object.keys(data[0]||{});const numeric=keys.find(k=>data.some(r=>typeof r[k]==='number'))||keys[1]||keys[0];
  const label=keys.find(k=>k!==numeric)||numeric;
  const values=data.slice(0,12).map(d=>({name:String(d[label]??'Value'),value:Math.max(0,Number(d[numeric])||0)}));
  const max=Math.max(1,...values.map(v=>v.value));
  const [hover,setHover]=useState<number|null>(null);
  if(!values.length)return <div className="studio-empty-mini">Import data to start exploring.</div>;
  if(mode==='donut'){
    const total=values.reduce((a,b)=>a+b.value,0)||1;let start=0;
    const palette=['#9aa7fa','#67cdb8','#f4b879','#b39ce5','#7aaee8','#dfa1bb'];
    const gradients=values.map((p,i)=>{const a=start;start+=p.value/total*100;return palette[i%palette.length]+' '+a+'% '+start+'%'}).join(', ');
    return <div className="studio-donut-layout"><div className="studio-donut" style={{background:'conic-gradient('+gradients+')'}}><span>{Math.round(total).toLocaleString()}</span></div><div className="studio-chart-legend">{values.map((p,i)=><button key={i} onClick={()=>setHover(i)} className={hover===i?'active':''}><span style={{background:palette[i%palette.length]}}/>{p.name} <strong>{p.value}</strong></button>)}</div></div>;
  }
  const width=680,height=270,padding=32;
  const points=values.map((v,i)=>({x:padding+(i+.5)*(width-padding*2)/values.length,y:height-padding-v.value/max*(height-2*padding)}));
  return <div className="studio-chart-scroll"><svg role="img" aria-label={mode+' chart using '+numeric} className="studio-chart" viewBox={'0 0 '+width+' '+height}>
    {[0,1,2,3,4].map(i=><line key={i} x1={padding} x2={width-padding} y1={padding+i*(height-padding*2)/4} y2={padding+i*(height-padding*2)/4} stroke="currentColor" opacity=".12"/>)}
    {mode==='line'?<polyline points={points.map(p=>p.x+','+p.y).join(' ')} fill="none" stroke="#96aaff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>:null}
    {points.map((p,i)=>mode==='bar'?<rect key={i} x={p.x-(width-padding*2)/values.length*.34} y={p.y} width={(width-padding*2)/values.length*.68} height={height-padding-p.y} fill={hover===i?'#c3ccff':'#899df0'} rx="5" onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}/>:<circle key={i} cx={p.x} cy={p.y} r={hover===i?8:5} fill="#aebcff" onMouseEnter={()=>setHover(i)} onMouseLeave={()=>setHover(null)}/>)}
    {points.map((p,i)=><text key={i} x={p.x} y={height-8} textAnchor="middle" fill="currentColor" opacity=".7" fontSize="11">{values[i].name.slice(0,9)}</text>)}
    {hover!==null&&points[hover]?<g><rect x={Math.min(width-120,Math.max(5,points[hover].x-48))} y={Math.max(5,points[hover].y-49)} width="114" height="30" rx="7" fill="#2e313e"/><text x={Math.min(width-110,Math.max(15,points[hover].x-38))} y={Math.max(24,points[hover].y-30)} fontSize="12" fill="#fff">{values[hover].name+': '+values[hover].value}</text></g>:null}
  </svg></div>;
}
function Studio(){
  const [state,setState]=useState<State>(load);
  const [page,setPage]=useState<Page>('dashboard');
  const [activeId,setActiveId]=useState<string|null>(null);
  const [slideIndex,setSlideIndex]=useState(0);
  const [query,setQuery]=useState('');
  const [createKind,setCreateKind]=useState<Kind>('presentation');
  const [newTitle,setNewTitle]=useState('');
  const [emailTo,setEmailTo]=useState('');
  const [emailSubject,setEmailSubject]=useState('');
  const [emailBody,setEmailBody]=useState('');
  const [error,setError]=useState('');
  const [saved,setSaved]=useState(false);
  const inputFile=useRef<HTMLInputElement>(null);
  const active=state.projects.find(p=>p.id===activeId)||null;
  const projects=useMemo(()=>[...state.projects].filter(p=>p.name.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.updated-a.updated),[state.projects,query]);
  useEffect(()=>{const handle=window.setTimeout(()=>{try{localStorage.setItem(STORE,JSON.stringify(state));setSaved(true)}catch{setError('Browser storage is full. Export your project backup before continuing.')}},250);return()=>clearTimeout(handle)},[state]);
  function note(text:string){setState(v=>({...v,notifications:[{id:uid(),text,date:Date.now()},...v.notifications].slice(0,50)}))}
  function updateProject(patch:Partial<Project>){
    if(!activeId)return;
    setState(s=>({...s,projects:s.projects.map(p=>p.id===activeId?{...p,...patch,updated:Date.now()}:p)}));
  }
  function updateSlides(slides:Slide[]){updateProject({slides})}
  function create(kind:Kind,title?:string){
    const p=makeProject(kind,(title||newTitle).trim()||'Untitled '+kind);
    setState(s=>({...s,projects:[p,...s.projects],notifications:[{id:uid(),text:'Created '+p.name,date:Date.now()},...s.notifications].slice(0,50)}));
    setActiveId(p.id);setSlideIndex(0);setPage('editor');setNewTitle('');
  }
  function remove(id:string){if(!window.confirm('Delete this project from this browser?'))return;
    setState(s=>({...s,projects:s.projects.filter(p=>p.id!==id)}));if(activeId===id){setActiveId(null);setPage('projects');}}
  function exportProject(p:Project){
    download((p.name||'project').replace(/[^a-z0-9_-]+/gi,'_')+'.anvil.json',JSON.stringify({format:'anvil-project-v1',project:p},null,2),'application/json');
  }
  async function importFile(file:File|null,mode:'data'|'project'){
    if(!file)return;
    setError('');
    try{
      if(file.size>5_000_000)throw Error('Files are limited to 5 MB in this local workspace.');
      const text=await file.text();
      if(mode==='project'){
        const parsed=JSON.parse(text);
        if(parsed.format!=='anvil-project-v1'||!parsed.project||!kinds.includes(parsed.project.kind))throw Error('Not an Anvil project backup.');
        const p={...makeProject(parsed.project.kind,'Imported'),...parsed.project,id:uid(),updated:Date.now()} as Project;
        setState(s=>({...s,projects:[p,...s.projects]}));setActiveId(p.id);setPage('editor');return;
      }
      const data=parseData(text,file.name);
      if(!data.length)throw Error('No records found in the imported file.');
      if(active)updateProject({data});else {
        const p=makeProject('visualization',file.name.replace(/\.[^.]+$/,''));
        p.data=data;setState(s=>({...s,projects:[p,...s.projects]}));setActiveId(p.id);setPage('editor');
      }
    }catch(e){setError(e instanceof Error?e.message:'Could not read the file.')}
  }
  function exportHTML(p:Project){
    const style='<style>body{font-family:system-ui;background:#11141f;color:#f5f5ff;margin:0;padding:7vw}section{padding:7vw;border:1px solid #353949;min-height:45vh;margin-bottom:20px;border-radius:18px}h1{font-size:clamp(24px,4vw,50px)}p{font-size:20px;line-height:1.7}table{border-collapse:collapse;width:100%}th,td{border:1px solid #4a4a59;text-align:left;padding:10px}@media print{section{break-after:page}}</style>';
    let content='';
    if(p.kind==='presentation')content=p.slides.map(sl=>'<section><h1>'+htmlEscape(sl.title)+'</h1><p>'+htmlEscape(sl.body).replace(/\n/g,'<br>')+'</p></section>').join('');
    else if(p.kind==='diagram')content='<h1>'+htmlEscape(p.name)+'</h1>'+p.nodes.map((x,i)=>'<section><h2>Step '+(i+1)+'</h2><p>'+htmlEscape(x)+'</p></section>').join('');
    else {
      const cols=Object.keys(p.data[0]||{});content='<h1>'+htmlEscape(p.name)+'</h1><table><tr>'+cols.map(k=>'<th>'+htmlEscape(k)+'</th>').join('')+'</tr>'+p.data.map(row=>'<tr>'+cols.map(k=>'<td>'+htmlEscape(row[k])+'</td>').join('')+'</tr>').join('')+'</table>';
    }
    download(p.name.replace(/[^a-z0-9_-]+/gi,'_')+'.html','<!doctype html><html lang="en"><meta charset="utf-8"><title>'+htmlEscape(p.name)+'</title>'+style+'<body>'+content+'</body></html>','text/html');
  }
  function snapshot(){
    if(!active)return;
    const versions=[{date:Date.now(),name:active.name,slides:active.slides.map(s=>({...s})),data:active.data.map(d=>({...d})),nodes:[...active.nodes]},...(active.versions||[])].slice(0,12);
    updateProject({versions});note('Saved a version of '+active.name);
  }
  function restore(index:number){
    if(!active||!active.versions?.[index])return;
    const v=active.versions[index];updateProject({slides:v.slides.map(x=>({...x})),nodes:[...v.nodes],data:v.data.map(x=>({...x}))});
  }
  function emailDraft(){
    const params=new URLSearchParams({subject:emailSubject,body:emailBody});
    window.location.href='mailto:'+encodeURIComponent(emailTo)+'?'+params.toString();
  }
  const activePlugin=(id:string)=>state.plugins.some(p=>p.id===id&&p.installed);
  return <div className={'studio studio-'+state.theme.toLowerCase()}>
    <div className="studio-topbar"><div className="studio-title"><Layers3 size={19}/> <span>Anvil Studio</span><small>Private workspace</small></div><div className="studio-top-actions"><span className="studio-saved"><Check size={14}/> {saved?'Saved locally':'Saving…'}</span><button onClick={()=>{download('anvil-studio-backup.json',JSON.stringify({format:'anvil-studio-v1',state},null,2),'application/json')}} title="Export all Studio projects" aria-label="Export workspace"><Download size={16}/></button></div></div>
    <div className="studio-shell"><nav className="studio-nav" aria-label="Studio navigation">
      {([{id:'dashboard',label:'Dashboard',icon:Grid2X2},{id:'projects',label:'My projects',icon:FolderOpen},{id:'gallery',label:'Gallery',icon:Palette},{id:'plugins',label:'Plugins',icon:Layers3},{id:'integrations',label:'Connections',icon:Share2},{id:'profile',label:'Profile',icon:Users},{id:'notifications',label:'Activity',icon:Bell}] as const).map(item=><button key={item.id} className={page===item.id?'selected':''} onClick={()=>setPage(item.id)} title={item.label}><item.icon size={17}/><span>{item.label}</span></button>)}
    </nav>
    <main className="studio-main">
      {error&&<div className="studio-error" role="alert">{error} <button onClick={()=>setError('')}>Dismiss</button></div>}
      {page==='dashboard'&&<><div className="studio-head"><div><small>WORKSPACE</small><h2>Build something clear.</h2><p>Charts, presentations, diagrams and reports — from the same local workspace.</p></div><button className="studio-primary" onClick={()=>create('presentation','New presentation')}><Plus size={16}/> New presentation</button></div>
        <div className="studio-metrics">
          <div><span>Total projects</span><strong>{state.projects.length}</strong></div>
          <div><span>Presentations</span><strong>{state.projects.filter(p=>p.kind==='presentation').length}</strong></div>
          <div><span>Visualizations</span><strong>{state.projects.filter(p=>p.kind==='visualization').length}</strong></div>
          <div><span>Enabled plugins</span><strong>{state.plugins.filter(p=>p.installed).length}</strong></div>
        </div>
        <div className="studio-head studio-subhead"><h3>Dashboard widgets</h3><details><summary><SlidersHorizontal size={15}/> Customize</summary><div className="studio-widget-choices">{['Recent projects','Quick actions','Data overview'].map(v=><label key={v}><input type="checkbox" checked={state.widgets.includes(v)} onChange={e=>setState(s=>({...s,widgets:e.target.checked?[...s.widgets,v]:s.widgets.filter(x=>x!==v)}))}/>{v}</label>)}</div></details></div>
        {state.widgets.includes('Quick actions')&&<div className="studio-quick-actions">{kinds.map(k=>{const Icon=projectIcon(k);return <button key={k} onClick={()=>create(k)}><Icon size={20}/><span>New {displayKind(k)}</span><Plus size={15}/></button>})}</div>}
        {state.widgets.includes('Recent projects')&&<><h3 className="studio-subtitle">Recent projects</h3><div className="studio-cards">{state.projects.length?state.projects.slice(0,4).map(p=>{const Icon=projectIcon(p.kind);return <button key={p.id} className="studio-card" onClick={()=>{setActiveId(p.id);setPage('editor')}}><Icon size={23}/><strong>{p.name}</strong><small>{displayKind(p.kind)} · {new Date(p.updated).toLocaleDateString()}</small></button>}):<div className="studio-empty-mini">No projects yet. Use a quick action to create your first project.</div>}</div></>}
        {state.widgets.includes('Data overview')&&<div className="studio-panel"><div className="studio-panel-head"><strong>Data overview</strong><small>Sample values — replace by importing your data</small></div><DataChart data={seeds} mode="line"/></div>}
      </>}
      {page==='projects'&&<><div className="studio-head"><div><small>YOUR LIBRARY</small><h2>Projects</h2><p>Saved in this browser on this device.</p></div><div className="studio-head-actions"><button onClick={()=>inputFile.current?.click()}><Upload size={15}/> Import</button><button className="studio-primary" onClick={()=>create(createKind)}><Plus size={16}/> New</button></div></div>
        <div className="studio-toolbar"><label><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search projects…"/></label><select value={createKind} onChange={e=>setCreateKind(e.target.value as Kind)} aria-label="New project type">{kinds.map(k=><option value={k} key={k}>{displayKind(k)}</option>)}</select></div>
        <div className="studio-project-list">{projects.map(p=>{const Icon=projectIcon(p.kind);return <div key={p.id} className="studio-project-row"><button onClick={()=>{setActiveId(p.id);setPage('editor')}}><Icon size={19}/><span><strong>{p.name}</strong><small>{displayKind(p.kind)} · Updated {new Date(p.updated).toLocaleString()}</small></span></button><button aria-label={'Export '+p.name} title="Export project JSON" onClick={()=>exportProject(p)}><Download size={17}/></button><button aria-label={'Delete '+p.name} title="Delete project" onClick={()=>remove(p.id)}><Trash2 size={17}/></button></div>})}{!projects.length&&<div className="studio-empty-mini">No matching projects. Create one or import a backup.</div>}</div>
        <input className="studio-hidden" type="file" ref={inputFile} accept=".json" onChange={e=>{void importFile(e.target.files?.[0]||null,'project');e.target.value=''}}/>
      </>}
      {page==='editor'&&active&&<><div className="studio-head"><div><button className="studio-back" onClick={()=>setPage('projects')}><ChevronLeft size={16}/> My projects</button><small>{displayKind(active.kind).toUpperCase()} EDITOR</small><input className="studio-project-title" aria-label="Project name" value={active.name} onChange={e=>updateProject({name:e.target.value})}/></div><div className="studio-head-actions"><button onClick={snapshot}><Save size={15}/> Snapshot</button><button onClick={()=>exportProject(active)}><Download size={15}/> JSON</button><button className="studio-primary" onClick={()=>exportHTML(active)}><Share2 size={15}/> Export HTML</button></div></div>
        {active.kind==='presentation'&&activePlugin('slides')&&<div className="studio-editor-layout"><aside className="studio-slide-rail">{active.slides.map((sl,i)=><button className={slideIndex===i?'selected':''} key={i} onClick={()=>setSlideIndex(i)}><small>{i+1}</small>{sl.title}</button>)}<button onClick={()=>{updateSlides([...active.slides,{title:'New slide',body:'Write your message here.'}]);setSlideIndex(active.slides.length)}}><Plus size={15}/> Add slide</button></aside>
          <div className="studio-slide-main"><div className="studio-slide-preview"><small>SLIDE {Math.min(slideIndex+1,active.slides.length)} / {active.slides.length}</small><h2>{active.slides[slideIndex]?.title}</h2><p>{active.slides[slideIndex]?.body}</p></div><div className="studio-slide-fields"><label>Slide heading<input value={active.slides[slideIndex]?.title||''} onChange={e=>updateSlides(active.slides.map((sl,i)=>i===slideIndex?{...sl,title:e.target.value}:sl))}/></label><label>Slide text<textarea rows={5} value={active.slides[slideIndex]?.body||''} onChange={e=>updateSlides(active.slides.map((sl,i)=>i===slideIndex?{...sl,body:e.target.value}:sl))}/></label><div className="studio-edit-actions"><button disabled={slideIndex===0} onClick={()=>setSlideIndex(x=>x-1)}><ChevronLeft size={16}/> Previous</button><button disabled={slideIndex===active.slides.length-1} onClick={()=>setSlideIndex(x=>x+1)}>Next <ChevronRight size={16}/></button><button disabled={active.slides.length<=1} onClick={()=>{updateSlides(active.slides.filter((_,i)=>i!==slideIndex));setSlideIndex(Math.max(0,slideIndex-1))}}><Trash2 size={15}/> Remove</button></div></div></div></div>}
        {(active.kind==='visualization'||active.kind==='report')&&<div className="studio-panel"><div className="studio-panel-head"><strong>{active.kind==='report'?'Report builder':'Interactive visualization'}</strong><div className="studio-head-actions"><select aria-label="Chart type" value={active.chart} onChange={e=>updateProject({chart:e.target.value as Project['chart']})}><option value="bar">Bars</option><option value="line">Line</option><option value="donut">Donut</option></select><label className="studio-file-button"><Upload size={15}/> Import CSV / JSON / TSV<input type="file" accept=".csv,.tsv,.json" onChange={e=>{void importFile(e.target.files?.[0]||null,'data');e.target.value=''}}/></label></div></div><DataChart data={active.data} mode={active.chart}/>{active.kind==='report'&&<div className="studio-report-summary"><strong>Summary</strong><p>{active.data.length} records · {Object.keys(active.data[0]||{}).length} columns. Values can be explored in the chart above or exported as a printable report.</p></div>}<div className="studio-data-table-wrap"><table><thead><tr>{Object.keys(active.data[0]||{}).map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{active.data.slice(0,30).map((row,i)=><tr key={i}>{Object.keys(active.data[0]||{}).map(k=><td key={k}>{row[k]}</td>)}</tr>)}</tbody></table></div><small className="studio-note">CSV, TSV and JSON supported. Excel XLSX, Google Analytics, AWS, Tableau and Power BI require separate secure connectors.</small></div>}
        {active.kind==='diagram'&&activePlugin('diagram')&&<div className="studio-panel"><div className="studio-panel-head"><strong>Editable process flow</strong><button onClick={()=>updateProject({nodes:[...active.nodes,'New step']})}><Plus size={16}/> Add step</button></div><div className="studio-flow">{active.nodes.map((node,i)=><div className="studio-flow-step" key={i}><div><span>{i+1}</span><input aria-label={'Step '+(i+1)} value={node} onChange={e=>updateProject({nodes:active.nodes.map((n,x)=>x===i?e.target.value:n)})}/></div><div><button disabled={i===0} onClick={()=>{const n=[...active.nodes];[n[i-1],n[i]]=[n[i],n[i-1]];updateProject({nodes:n})}} aria-label="Move up">↑</button><button disabled={i===active.nodes.length-1} onClick={()=>{const n=[...active.nodes];[n[i],n[i+1]]=[n[i+1],n[i]];updateProject({nodes:n})}} aria-label="Move down">↓</button><button onClick={()=>updateProject({nodes:active.nodes.filter((_,x)=>x!==i)})} aria-label="Delete step"><Trash2 size={14}/></button></div></div>)}</div></div>}
        {!!active.versions?.length&&<div className="studio-panel"><strong>Saved versions</strong><div className="studio-versions">{active.versions.map((v,i)=><button onClick={()=>restore(i)} key={i}>{new Date(v.date).toLocaleString()} <span>Restore</span></button>)}</div></div>}
      </>}
      {page==='gallery'&&<><div className="studio-head"><div><small>INSPIRATION</small><h2>Gallery</h2><p>Editable starter styles for presentations and data stories.</p></div></div><div className="studio-gallery">{[{t:'Boardroom',c:'boardroom'},{t:'Midnight',c:'midnight'},{t:'Editorial',c:'editorial'},{t:'Color Study',c:'color'}].map(x=><button key={x.t} onClick={()=>{const p=makeProject('presentation',x.t+' deck');p.theme=x.t;setState(s=>({...s,projects:[p,...s.projects]}));setActiveId(p.id);setSlideIndex(0);setPage('editor')}}><div className={'studio-gallery-art '+x.c}><span>{x.t}</span><i/></div><strong>{x.t}</strong><small>Use presentation template</small></button>)}</div>
        <div className="studio-head studio-subhead"><h3>Visualization styles</h3><p>Explore sample data, then customize your own chart.</p></div>
        <div className="studio-gallery studio-gallery-charts">{(['bar','line','donut'] as const).map(mode=><button key={mode} onClick={()=>{
          const p=makeProject('visualization',mode.charAt(0).toUpperCase()+mode.slice(1)+' chart');p.chart=mode;
          setState(v=>({...v,projects:[p,...v.projects]}));setActiveId(p.id);setPage('editor');
        }}><DataChart data={seeds} mode={mode}/><strong>{mode.charAt(0).toUpperCase()+mode.slice(1)} chart</strong><small>Open editable chart</small></button>)}</div></>}
      {page==='plugins'&&<><div className="studio-head"><div><small>EXTENSIONS</small><h2>Plugin library</h2><p>Choose enabled tools for your local workspace. Custom manifests don't execute untrusted code.</p></div></div><div className="studio-plugin-grid">{state.plugins.map(p=><div className="studio-panel studio-plugin" key={p.id}><Layers3 size={22}/><span>{p.kind}</span><strong>{p.name}</strong><p>{p.description}</p><div className="studio-head-actions"><button onClick={()=>setState(s=>({...s,plugins:s.plugins.map(x=>x.id===p.id?{...x,installed:!x.installed}:x)}))}>{p.installed?'Disable':'Enable'}</button>{p.custom&&<button onClick={()=>setState(s=>({...s,plugins:s.plugins.filter(x=>x.id!==p.id)}))}><Trash2 size={14}/> Remove</button>}</div></div>)}</div><div className="studio-panel"><h3>Developer plugin registry (local demo)</h3><p className="studio-note">Register descriptive plugin manifests here. Code execution, permissions, store distribution, remote downloads and plugin collaboration require a reviewed sandboxed API and a backend.</p><button onClick={()=>{const name=window.prompt('Plugin name');if(!name?.trim())return;setState(s=>({...s,plugins:[...s.plugins,{id:uid(),name:name.trim().slice(0,60),description:'Custom local plugin manifest. No executable code.',kind:'Custom',installed:false,custom:true}]}))}}><Plus size={16}/> Add manifest</button></div></>}
      {page==='integrations'&&<><div className="studio-head"><div><small>CONNECTED DATA</small><h2>Integrations & collaboration</h2><p>Privacy-first foundations with honest connection status.</p></div></div><div className="studio-integrations">{['CSV / TSV / JSON import','Excel XLSX','Google Analytics','Amazon Web Services','Tableau','Power BI','Real-time coediting','Email inbox / outbox'].map((t,i)=><div className="studio-panel" key={t}><ShieldCheck size={19}/><strong>{t}</strong><span>{i===0?'Available locally':'Requires server-side integration'}</span></div>)}</div><div className="studio-panel"><h3>Share projects without an account</h3><p className="studio-note">Export a project JSON file from the editor and share it with another Anvil user. They can import it under My projects. This is manual file collaboration, not simultaneous editing.</p></div></>}
      {page==='profile'&&<><div className="studio-head"><div><small>PERSONALIZATION</small><h2>My workspace</h2><p>Your profile here is stored only in this browser. It is not an authenticated account.</p></div></div><div className="studio-panel studio-profile"><div className="studio-avatar">{state.name.slice(0,1).toUpperCase()}</div><label>Display name<input value={state.name} onChange={e=>setState(s=>({...s,name:e.target.value.slice(0,60)}))}/></label><label>Theme<select value={state.theme} onChange={e=>setState(s=>({...s,theme:e.target.value}))}>{themes.map(t=><option value={t} key={t}>{t}</option>)}</select></label><p className="studio-note">Cloud accounts, profile photos, organization permissions and account history require secure sign-in and storage.</p></div><div className="studio-panel"><h3>Compose an email draft</h3><p className="studio-note">Opens your device's email client. Anvil does not access, send or receive email without an authorized provider integration.</p><div className="studio-mail"><input type="email" aria-label="Recipient" placeholder="To" value={emailTo} onChange={e=>setEmailTo(e.target.value)}/><input aria-label="Subject" placeholder="Subject" value={emailSubject} onChange={e=>setEmailSubject(e.target.value)}/><textarea aria-label="Message" rows={4} placeholder="Message" value={emailBody} onChange={e=>setEmailBody(e.target.value)}/><button onClick={emailDraft} disabled={!emailTo.includes('@')}><Mail size={15}/> Open email draft</button></div></div></>}
      {page==='notifications'&&<><div className="studio-head"><div><small>RECENT ACTIVITY</small><h2>Notifications</h2><p>Local changes and project history on this device.</p></div><button onClick={()=>setState(s=>({...s,notifications:[]}))}>Clear</button></div>{state.notifications.length?<div className="studio-project-list">{state.notifications.map(n=><div className="studio-activity" key={n.id}><Bell size={17}/><span>{n.text}<small>{new Date(n.date).toLocaleString()}</small></span></div>)}</div>:<div className="studio-empty-mini">No activity recorded yet.</div>}</>}
    </main></div>
  </div>;
}
export {Studio};
