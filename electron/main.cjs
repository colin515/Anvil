'use strict';

const {app, BrowserWindow, ipcMain, shell, clipboard} = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const {execFile} = require('node:child_process');
const {promisify} = require('node:util');
const {HostServer} = require('./host-server.cjs');
const {gb,recommendations,displaySafeError} = require('./logic.cjs');

const execFileAsync=promisify(execFile);
const OLLAMA='http://127.0.0.1:11434';
let window=null, hardware=null, host=null, activeModel=null, accessEnabled=true, accessCode=null;
function preferencesPath(){return path.join(app.getPath('userData'),'preferences.json');}
function loadPreferences(){try{const settings=JSON.parse(fs.readFileSync(preferencesPath(),'utf8'));hardware=settings.hardware||null;activeModel=typeof settings.activeModel==='string'?settings.activeModel:null;accessEnabled=settings.accessEnabled!==false;accessCode=typeof settings.accessCode==='string'?settings.accessCode:null;}catch{/* First launch or invalid settings */}}
function savePreferences(){try{fs.mkdirSync(app.getPath('userData'),{recursive:true});fs.writeFileSync(preferencesPath(),JSON.stringify({hardware,activeModel,accessEnabled,accessCode},null,2));}catch(err){emit('app:error',`Could not save local preferences: ${displaySafeError(err)}`);}}

function emit(channel, data) { if(window && !window.isDestroyed()) window.webContents.send(channel,data); }
async function powerShell(code) {
  if(process.platform!=='win32') return null;
  const {stdout}=await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-Command',code],{windowsHide:true,timeout:12000,maxBuffer:1024*1024});
  return JSON.parse(stdout.trim());
}

async function scanHardware() {
  const result={cpu:os.cpus()[0]?.model||'Unknown CPU',cores:os.cpus().length,ramTotalGb:gb(os.totalmem()),ramFreeGb:gb(os.freemem()),
    platform:`${os.type()} ${os.release()}`,gpu:'Unknown',vramGb:0,diskFreeGb:0,diskTotalGb:0};
  emit('scan:component',{key:'cpu',value:result.cpu,status:'complete'});
  emit('scan:component',{key:'memory',value:`${result.ramTotalGb} GB`,status:'complete'});
  const promises=[
    (async()=>{
      try {const g=await powerShell("Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress");
        const rows=Array.isArray(g)?g:[g]; const primary=rows.filter(Boolean).sort((a,b)=>Number(b.AdapterRAM||0)-Number(a.AdapterRAM||0))[0];
        if(primary){result.gpu=primary.Name||'Unknown';result.vramGb=gb(primary.AdapterRAM);}
        if(/nvidia/i.test(result.gpu)){
          try {const n=await execFileAsync('nvidia-smi',['--query-gpu=memory.total','--format=csv,noheader,nounits'],{windowsHide:true,timeout:6000});
            const mib=parseFloat(n.stdout.trim().split('\n')[0]);if(Number.isFinite(mib)&&mib>0)result.vramGb=+(mib/1024).toFixed(1);}
          catch{/* Continue with CIM data */}
        }}
      catch { /* Continue gracefully */ }
      emit('scan:component',{key:'gpu',value:result.gpu,status:result.gpu==='Unknown'?'unknown':'complete'});
    })(),
    (async()=>{
      try {const d=await powerShell("Get-CimInstance Win32_LogicalDisk -Filter \"DriveType=3\" | Select-Object -First 1 Size,FreeSpace | ConvertTo-Json -Compress");
        if(d){result.diskFreeGb=gb(d.FreeSpace);result.diskTotalGb=gb(d.Size);}}
      catch { /* Continue gracefully */ }
      emit('scan:component',{key:'disk',value:result.diskTotalGb?`${result.diskFreeGb} GB free`:'Unknown',status:result.diskTotalGb?'complete':'unknown'});
    })()
  ];
  await Promise.allSettled(promises);
  hardware=result;
  savePreferences();
  emit('scan:done',{hardware:result,models:recommendations(result)});
  return {hardware:result,models:recommendations(result)};
}

async function api(route, options={}) {
  const response=await fetch(`${OLLAMA}${route}`,{...options,signal:options.signal||AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error(`Ollama returned ${response.status}`);
  return response;
}

async function ollamaStatus() {
  try {const r=await api('/api/tags'); const d=await r.json();return {online:true,models:(d.models||[]).map(m=>({name:m.name,sizeGb:gb(m.size)}))};}
  catch{return {online:false,models:[]};}
}

async function pullModel(model) {
  if(typeof model!=='string'|| !/^[a-z0-9_.:/-]{1,80}$/i.test(model)) throw new Error('Invalid model name');
  const res=await api('/api/pull',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:model,stream:true}),signal:AbortSignal.timeout(60*60*1000)});
  if(!res.body)throw new Error('No download stream');
  const reader=res.body.getReader(); const decoder=new TextDecoder(); let pending='';
  while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});
    const lines=pending.split('\n');pending=lines.pop()||'';
    for(const line of lines){if(!line.trim())continue;const data=JSON.parse(line);
      if(data.error)throw new Error(data.error);
      emit('model:pull',{model,status:data.status,completed:data.completed||0,total:data.total||0});
    }
  }
  return ollamaStatus();
}

async function benchmarkModel(model) {
  if(!model)throw new Error('Select a model first');
  const res=await api('/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model,prompt:'Describe the purpose of a reliable personal AI assistant in one sentence.',stream:false,options:{num_predict:80}}),signal:AbortSignal.timeout(180000)});
  const d=await res.json();
  const tokens=Number(d.eval_count)||0,duration=Number(d.eval_duration)||0;
  return {tokens,seconds:+(duration/1e9).toFixed(2),tokensPerSecond:duration>0?+(tokens/(duration/1e9)).toFixed(1):0};
}


async function unloadModel(){
  if(!activeModel)return {unloaded:false,reason:'No active model'};
  const model=activeModel;
  try{
    const r=await api('/api/generate',{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({model,prompt:'',keep_alive:0,stream:false}),signal:AbortSignal.timeout(20000)});
    await r.text();
    return {unloaded:true,model};
  }catch(e){throw Error('Could not unload model from Ollama: '+displaySafeError(e));}
}

async function gpuUsage(){
  // GPU-wide utilization, NOT Ollama-process-only: drivers don't reliably expose that cross-vendor.
  if(process.platform!=='win32')return {percent:null,source:'Unavailable',scope:'whole GPU',vramUsedMb:null,vramTotalMb:null};
  try{
    const x=await execFileAsync('nvidia-smi',['--query-gpu=utilization.gpu,memory.used,memory.total','--format=csv,noheader,nounits'],{windowsHide:true,timeout:5000,maxBuffer:65536});
    const cells=x.stdout.trim().split('\n')[0].split(',').map(v=>Number(v.trim()));
    if(cells.length===3&&cells.every(Number.isFinite))return {percent:Math.min(100,Math.max(0,cells[0])),vramUsedMb:cells[1],vramTotalMb:cells[2],source:'NVIDIA NVML',scope:'whole GPU'};
  }catch{ /* Fall back to Windows GPU engine counters */ }
  try{
    const ps="$ErrorActionPreference='Stop'; $x=(Get-Counter '\\GPU Engine(*)\\Utilization Percentage' -ErrorAction Stop).CounterSamples | Select-Object -ExpandProperty CookedValue; if($x){[math]::Round(($x | Measure-Object -Maximum).Maximum,0)} else {'NA'}";
    const {stdout}=await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{windowsHide:true,timeout:5000});
    const percent=Number(stdout.trim());
    if(Number.isFinite(percent)&&stdout.trim()!=='NA')return {percent:Math.min(100,Math.max(0,percent)),vramUsedMb:null,vramTotalMb:null,source:'Windows GPU engines (peak)',scope:'peak engine estimate'};
  }catch{}
  return {percent:null,source:'GPU counters unavailable',scope:'whole GPU',vramUsedMb:null,vramTotalMb:null};
}
async function shutdownAnvil(){
  await host.stop();
  let unloadError=null;
  try{await unloadModel();}catch(e){unloadError=e.message;}
  // Stop Anvil completely; never kill a separately managed Ollama daemon or other apps.
  setImmediate(()=>app.quit());
  return {stopped:true,unloadError};
}
function register() {
  ipcMain.handle('hardware:scan',scanHardware);
  ipcMain.handle('ollama:status',ollamaStatus);
  ipcMain.handle('ollama:pull',(_e,model)=>pullModel(model));
  ipcMain.handle('model:select',async(_e,model)=>{
    const status=await ollamaStatus();
    if(!status.models.some(m=>m.name===model))throw new Error('Download this model before selecting it.');
    activeModel=model; savePreferences(); emit('host:status',host.status());return {model};
  });
  ipcMain.handle('model:benchmark',(_e,model)=>benchmarkModel(model||activeModel));
  ipcMain.handle('host:start',()=>host.start());
  ipcMain.handle('host:access',(_e,enabled)=>{if(typeof enabled!=='boolean')throw Error('Expected boolean');accessEnabled=enabled;const state=host.setAccess(enabled);savePreferences();return state;});
  ipcMain.handle('host:regenerate',()=>{const state=host.regenerateCode();accessCode=state.code;savePreferences();return state;});
  ipcMain.handle('host:settings',()=>host.accessSettings());
  ipcMain.handle('gpu:usage',gpuUsage);
  ipcMain.handle('model:unload',async()=>{await host.stop();return unloadModel();});
  ipcMain.handle('app:shutdown',shutdownAnvil);
  ipcMain.handle('local:open',async()=>{if(!host.status().online)throw new Error('Start the local server first.');return shell.openExternal(host.status().localUrl);});
  ipcMain.handle('local:copy',(_e,requested)=>{const st=host.status();const allowed=[st.localUrl,...st.lanUrls.map(x=>x.url)].filter(Boolean);const link=typeof requested==='string'&&allowed.includes(requested)?requested:st.lanUrls[0]?.url||st.localUrl||'http://127.0.0.1:3000';clipboard.writeText(link);return link;});
  ipcMain.handle('host:stop',()=>host.stop());
  ipcMain.handle('host:status',()=>host.status());
  ipcMain.handle('app:state',async()=>({hardware,activeModel,host:host.status(),ollama:await ollamaStatus(),access:host.accessSettings()}));
  ipcMain.handle('external:open',(_e,url)=>{
    const allowed=['https://ollama.com/','https://github.com/colin515/Anvil'];
    if(typeof url!=='string'||!allowed.some(p=>url.startsWith(p)))throw new Error('URL not allowed');
    return shell.openExternal(url);
  });
}

function createWindow() {
  window=new BrowserWindow({width:1360,height:850,minWidth:960,minHeight:680,backgroundColor:'#1C1C1E',title:'Anvil',
    webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event)=>event.preventDefault());
  if(process.env.ANVIL_DEV_URL)window.loadURL(process.env.ANVIL_DEV_URL);
  else window.loadFile(path.join(__dirname,'../dist/index.html'));
}

app.whenReady().then(()=>{
  loadPreferences();
  host=new HostServer({distDir:path.join(__dirname,'../dist'),ollamaUrl:OLLAMA,getModel:()=>activeModel,onMetrics:s=>emit('host:status',s),accessEnabled,accessCode});
  accessCode=host.accessSettings().code;savePreferences();
  register();createWindow();
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{host?.stop();if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>host?.stop());
process.on('unhandledRejection',err=>emit('app:error',displaySafeError(err)));
