'use strict';
// Anvil's HTTP service is deliberately restricted to this machine and its
// private IPv4 LAN/Wi-Fi. This never creates a tunnel or configures the router.
const http=require('node:http');
const os=require('node:os');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const MIME={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.html':'text/html; charset=utf-8','.woff2':'font/woff2'};
const MAX_BODY=1024*1024; // Guard resource exhaustion, not a chat quota.
const MAX_MESSAGES=72;
const MAX_MESSAGE_CHARS=120000;
const SESSION_TTL=12*60*60*1000;
const LOGIN_WINDOW=15*60*1000;
const MAX_FAILED_LOGINS=6;
const sha=v=>crypto.createHash('sha256').update(String(v)).digest();
const secureMatch=(a,b)=>crypto.timingSafeEqual(sha(a),sha(b));
const json=(res,status,body)=>{if(res.writableEnded)return;res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
function privateIP(ip){
  if(typeof ip!=='string')return false;
  if(/^127\./.test(ip)||/^10\./.test(ip)||/^192\.168\./.test(ip))return true;
  const m=/^172\.(\d{1,2})\./.exec(ip);
  return !!m&&Number(m[1])>=16&&Number(m[1])<=31;
}
function normalizeRemote(address=''){return address.startsWith('::ffff:')?address.slice(7):address;}
function networkUrls(port){
  if(port==null)return [];
  const addresses=[];
  for(const [name,entries] of Object.entries(os.networkInterfaces())){
    for(const entry of entries||[]){
      if(entry.family==='IPv4'&&!entry.internal&&privateIP(entry.address))
        addresses.push({interface:name,url:`http://${entry.address}:${port}`,ip:entry.address});
    }
  }
  // Put actual Wi-Fi adapters before Ethernet and virtual/VPN adapters.
  const rank=name=>/wi-?fi|wireless|wlan|wlp/i.test(name)?0:/vEthernet|docker|WSL|virtual|vmware|virtualbox|hyper-v|tailscale|vpn|loopback/i.test(name)?3:/ethernet|eth/i.test(name)?1:2;
  addresses.sort((a,b)=>rank(a.interface)-rank(b.interface)||a.interface.localeCompare(b.interface));
  return addresses;
}
async function bodyJson(req){
  let size=0;const chunks=[];
  for await(const part of req){
    size+=part.length;
    if(size>MAX_BODY){const err=new Error('Message history exceeds the 1 MB request safety limit. Start a new chat or shorten the conversation.');err.status=413;throw err;}
    chunks.push(part);
  }
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
  catch{const err=new Error('Invalid JSON.');err.status=400;throw err;}
}
class HostServer{
  constructor({distDir,ollamaUrl,getModel,onMetrics,port=3000,bindAddress='0.0.0.0',accessEnabled=true,accessCode}){
    this.distDir=distDir;this.ollamaUrl=ollamaUrl;this.getModel=getModel;this.onMetrics=onMetrics;
    this.portPreference=port;this.bindAddress=bindAddress;
    this.accessEnabled=Boolean(accessEnabled);this.accessCode=accessCode||crypto.randomBytes(9).toString('base64url');
    this.sessions=new Map();this.failed=new Map();this.controllers=new Set();this.sockets=new Set();
    this.active=0;this.total=0;this.online=false;this.server=null;this.port=null;
  }
  status(){
    return {online:this.online,localUrl:this.port!=null?`http://127.0.0.1:${this.port}`:null,
      lanUrls:networkUrls(this.port),accessEnabled:this.accessEnabled,publicUrl:null,
      connectedUsers:this.sessions.size,activeRequests:this.active,totalRequests:this.total,invite:null};
  }
  accessSettings(){return {enabled:this.accessEnabled,code:this.accessCode};}
  setAccess(enabled){
    this.accessEnabled=Boolean(enabled);
    this.sessions.clear();this.failed.clear();
    this.onMetrics?.(this.status());
    return this.accessSettings();
  }
  regenerateCode(){
    this.accessCode=crypto.randomBytes(9).toString('base64url');
    this.sessions.clear();this.failed.clear();
    return this.accessSettings();
  }
  async start(){
    if(this.online)return this.status();
    if(!fs.existsSync(path.join(this.distDir,'index.html')))throw Error('Web assets are missing. Build Anvil before hosting.');
    const server=http.createServer((req,res)=>{this.handle(req,res).catch(e=>json(res,e.status||500,{error:e.status?e.message:'Request could not be completed.'}));});
    server.on('connection',socket=>{this.sockets.add(socket);socket.on('close',()=>this.sockets.delete(socket));});
    try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(this.portPreference,this.bindAddress,resolve);});}
    catch(e){server.close();throw Error(e.code==='EADDRINUSE'?'Port 3000 is already in use. Close the other app and try again.':e.message);}
    this.server=server;this.port=server.address().port;this.online=true;this.onMetrics?.(this.status());
    return this.status();
  }
  allowedHost(header){
    // Do not trust arbitrary Host names: avoids browser DNS-rebinding.
    const allowed=new Set([`127.0.0.1:${this.port}`,`localhost:${this.port}`,...networkUrls(this.port).map(x=>new URL(x.url).host)]);
    return allowed.has(String(header||'').toLowerCase());
  }
  isAuthenticated(req){
    if(!this.accessEnabled)return true;
    const cookie=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('anvil_session='));
    const session=this.sessions.get(cookie?.slice('anvil_session='.length)||'');
    if(!session)return false;
    if(session.expires<Date.now()){this.sessions.delete(cookie.slice('anvil_session='.length));return false;}
    return true;
  }
  async handle(req,res){
    const remote=normalizeRemote(req.socket.remoteAddress||'');
    if(!privateIP(remote))return json(res,403,{error:'Anvil is only accessible from private LAN devices.'});
    if(!this.allowedHost(req.headers.host))return json(res,403,{error:'Use the Anvil LAN IP address, not a public hostname.'});
    if(req.method!=='GET'&&req.method!=='HEAD'){
      const origin=req.headers.origin;
      if(origin){let target;try{target=new URL(origin);}catch{return json(res,403,{error:'Invalid origin.'});}
        if(!['http:','https:'].includes(target.protocol)||target.host!==req.headers.host)return json(res,403,{error:'Cross-origin requests blocked.'});
      }
      if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Cross-site requests blocked.'});
    }
    res.setHeader('x-content-type-options','nosniff');
    res.setHeader('referrer-policy','no-referrer');
    res.setHeader('x-frame-options','DENY');
    res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
    const url=new URL(req.url||'/','http://localhost');
    if(url.pathname==='/api/status'&&req.method==='GET')
      return json(res,200,{online:this.online,model:this.getModel(),activeRequests:this.active,maxConcurrent:2,accessEnabled:this.accessEnabled});
    if(url.pathname==='/api/session'&&req.method==='GET')
      return json(res,200,{authenticated:this.isAuthenticated(req),accessEnabled:this.accessEnabled});
    if(url.pathname==='/api/login'&&req.method==='POST'){
      if(!this.accessEnabled)return json(res,200,{authenticated:true,accessEnabled:false});
      const key=remote,record=this.failed.get(key)||{started:Date.now(),tries:0};
      if(Date.now()-record.started>LOGIN_WINDOW){record.started=Date.now();record.tries=0;}
      if(record.tries>=MAX_FAILED_LOGINS)return json(res,429,{error:'Too many incorrect codes. Please wait 15 minutes.'});
      const data=await bodyJson(req);
      if(!data||typeof data.code!=='string'||!secureMatch(data.code,this.accessCode)){
        record.tries++;this.failed.set(key,record);
        return json(res,401,{error:'Incorrect access code.'});
      }
      this.failed.delete(key);
      const token=crypto.randomBytes(32).toString('hex');
      this.sessions.set(token,{expires:Date.now()+SESSION_TTL});
      res.setHeader('set-cookie',`anvil_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);
      return json(res,200,{authenticated:true,accessEnabled:true});
    }
    if(url.pathname==='/api/logout'&&req.method==='POST'){
      const token=String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('anvil_session='))?.slice(14);
      if(token)this.sessions.delete(token);
      res.setHeader('set-cookie','anvil_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
      return json(res,200,{authenticated:false});
    }
    if(url.pathname==='/api/chat'&&req.method==='POST'){
      if(!this.isAuthenticated(req))return json(res,401,{error:'Enter the access code from the Anvil desktop app.'});
      if(this.active>=2)return json(res,503,{error:'The GPU is busy with two requests. Try again in a moment.'});
      const data=await bodyJson(req);
      if(!data||!Array.isArray(data.messages)||data.messages.length<1||data.messages.length>MAX_MESSAGES)
        return json(res,400,{error:'Too many messages in one request. Start a new conversation.'});
      const messages=data.messages;
      if(messages.some(m=>!m||!['user','assistant','system'].includes(m.role)||typeof m.content!=='string'||m.content.length>MAX_MESSAGE_CHARS))
        return json(res,400,{error:'A message is too large or invalid.'});
      const model=this.getModel();
      if(!model)return json(res,503,{error:'Select a local model in Anvil first.'});
      this.total++;this.active++;this.onMetrics?.(this.status());
      const controller=new AbortController();this.controllers.add(controller);
      res.once('close',()=>controller.abort());
      try{
        const response=await fetch(`${this.ollamaUrl}/api/chat`,{
          method:'POST',headers:{'content-type':'application/json'},signal:controller.signal,
          body:JSON.stringify({model,messages,stream:true}) // model controls context and output, no artificial token cap
        });
        if(!response.ok||!response.body){
          const details=await response.text().catch(()=>null);
          return json(res,502,{error:`Ollama failed (${response.status}). Check that your model is loaded.`});
        }
        res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no'});
        const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
        while(true){
          const {done,value}=await reader.read();if(done)break;
          buffer+=decoder.decode(value,{stream:true});
          const lines=buffer.split('\n');buffer=lines.pop()||'';
          for(const line of lines){
            if(!line.trim())continue;
            try{
              const item=JSON.parse(line);
              if(item.message?.content)res.write(`data: ${JSON.stringify({token:item.message.content})}\n\n`);
              if(item.error)res.write(`data: ${JSON.stringify({error:'Model generation failed.'})}\n\n`);
            }catch{/* Incomplete upstream fragment */}
          }
        }
        if(!res.writableEnded)res.end('data: {"done":true}\n\n');
      }catch(e){
        if(!controller.signal.aborted){
          if(res.headersSent)res.end(`data: ${JSON.stringify({error:'Connection to Ollama failed.'})}\n\n`);
          else json(res,502,{error:'Could not contact Ollama.'});
        }
      }finally{this.controllers.delete(controller);this.active--;this.onMetrics?.(this.status());}
      return;
    }
    if(!['GET','HEAD'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
    const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const candidate=path.resolve(this.distDir,relative),root=path.resolve(this.distDir);
    if(!candidate.startsWith(root+path.sep)&&candidate!==root)return json(res,403,{error:'Forbidden'});
    let file=candidate;
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){
      if(relative.startsWith('assets/'))return json(res,404,{error:'Not found'});
      file=path.join(root,'index.html');
    }
    const ext=path.extname(file);
    res.writeHead(200,{'content-type':MIME[ext]||'application/octet-stream','cache-control':ext==='.html'?'no-store':'public, max-age=3600'});
    if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
  }
  async stop(){
    this.online=false;
    for(const c of this.controllers)c.abort();
    this.controllers.clear();this.sessions.clear();this.failed.clear();
    if(this.server){this.server.closeAllConnections();this.server.close();this.server=null;}
    this.port=null;this.onMetrics?.(this.status());return this.status();
  }
}
module.exports={HostServer,secureMatch,privateIP,networkUrls};
