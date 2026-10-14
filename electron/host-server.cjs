'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const MIME = {'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.html':'text/html; charset=utf-8','.woff2':'font/woff2'};
const MAX_BODY = 12_000;
const SESSION_TTL = 12 * 60 * 60 * 1000;

const sha = value => crypto.createHash('sha256').update(value).digest();
function secureMatch(a, b) {
  return crypto.timingSafeEqual(sha(String(a)), sha(String(b)));
}
const json = (res, status, data) => {
  if (res.writableEnded) return;
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify(data));
};

async function bodyJson(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) { const error = new Error('Request too large'); error.status = 413; throw error; }
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { const error = new Error('Invalid JSON'); error.status = 400; throw error; }
}

class HostServer {
  constructor({distDir, ollamaUrl, getModel, onMetrics, port = 3000}) {
    this.portPreference = port;
    this.distDir = distDir;
    this.ollamaUrl = ollamaUrl;
    this.getModel = getModel;
    this.onMetrics = onMetrics;
    this.sessions = new Map();
    this.failed = new Map();
    this.sockets = new Set();
    this.active = 0;
    this.total = 0;
    this.online = false;
    this.server = null;
    this.port = null;
    this.publicUrl = null;
    this.tunnel = null;
    this.invite = null;
  }

  status() { return { online: this.online, localUrl: this.port ? `http://127.0.0.1:${this.port}` : null,
    publicUrl: this.publicUrl, connectedUsers: this.sessions.size, activeRequests: this.active, totalRequests: this.total,
    invite: this.invite }; }

  async start() {
    if (this.online) return this.status();
    if (!fs.existsSync(path.join(this.distDir, 'index.html'))) throw new Error('Web assets are missing. Build Anvil before hosting.');
    this.invite = null;
    this.server = http.createServer((req, res) => { this.handle(req, res).catch(e => json(res, e.status || 500, {error: e.status ? e.message : 'Request could not be completed'})); });
    this.server.on('connection', socket => { this.sockets.add(socket); socket.on('close',()=>this.sockets.delete(socket)); });
    try { await new Promise((resolve, reject) => { this.server.once('error', reject); this.server.listen(this.portPreference, '127.0.0.1', resolve); }); }
    catch(e) { this.server = null; throw new Error(e.code === 'EADDRINUSE' ? 'Port 3000 is already in use. Close the other app and try again.' : e.message); }
    this.port = this.server.address().port;
    this.online = true;
    this.onMetrics?.(this.status());
    return this.status();
  }

  cookieSession(req) {
    const raw = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('anvil_session='));
    const token = raw?.slice('anvil_session='.length) || '';
    const state = this.sessions.get(token);
    if (!state || state.expires < Date.now()) { if(state) this.sessions.delete(token); return null; }
    return state;
  }

  async handle(req, res) {
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'");
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/api/status' && req.method === 'GET') return json(res, 200, {online: this.online, model: this.getModel(), maxConcurrent: 2, activeRequests: this.active});
    if (url.pathname === '/api/session' && req.method === 'GET') return json(res, 200, {authenticated:true});
    if (url.pathname === '/api/chat' && req.method === 'POST') {
      if (this.active >= 2) return json(res, 429, {error:'The host is busy. Try again shortly.'});
      const data = await bodyJson(req);
      const messages = Array.isArray(data.messages) ? data.messages.slice(-12) : [];
      if (!messages.length || messages.some(m => !['user','assistant'].includes(m?.role) || typeof m.content !== 'string' || m.content.length > 2500))
        return json(res,400,{error:'Invalid messages. Maximum 12 messages and 2,500 characters each.'});
      const model = this.getModel();
      if (!model) return json(res,503,{error:'The host has not selected a model.'});
      this.total++; this.active++;
      this.onMetrics?.(this.status());
      const controller = new AbortController();
      // Abort inference if visitor drops the connection.
      res.on('close', () => controller.abort());
      try {
        const response = await fetch(`${this.ollamaUrl}/api/chat`, {
          method:'POST', headers:{'content-type':'application/json'}, signal:controller.signal,
          body:JSON.stringify({model, messages, stream:true, options:{num_predict:512}})
        });
        if (!response.ok || !response.body) {json(res,502,{error:'Local model is unavailable. The host may need to start Ollama.'});return;}
        res.writeHead(200, {'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-accel-buffering':'no'});
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          buf += decoder.decode(value, {stream:true});
          const lines = buf.split('\n'); buf=lines.pop()||'';
          for(const line of lines) {
            if(!line.trim()) continue;
            try {
              const item=JSON.parse(line);
              if(item.message?.content) res.write(`data: ${JSON.stringify({token:item.message.content})}\n\n`);
              if(item.error) res.write(`data: ${JSON.stringify({error:'Model generation failed.'})}\n\n`);
            } catch { /* ignore malformed fragment */ }
          }
        }
        if(!res.writableEnded) res.end('data: {"done":true}\n\n');
      } catch (e) {
        if (!controller.signal.aborted) {
          if (res.headersSent) res.end(`data: ${JSON.stringify({error:'Inference connection failed.'})}\n\n`);
          else json(res,502,{error:'Could not contact the local model.'});
        }
      } finally { this.active--; this.onMetrics?.(this.status()); }
      return;
    }
    if(req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, {error:'Method not allowed'});
    const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const candidate = path.resolve(this.distDir, relative);
    const root = path.resolve(this.distDir);
    if (!candidate.startsWith(root + path.sep) && candidate !== root) return json(res,403,{error:'Forbidden'});
    let file = candidate;
    if(!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      if(relative.startsWith('assets/')) return json(res,404,{error:'Not found'});
      file = path.join(root,'index.html');
    }
    const ext=path.extname(file);
    res.writeHead(200, {'content-type':MIME[ext]||'application/octet-stream', 'cache-control': ext==='.html'?'no-store':'public, max-age=3600'});
    if(req.method==='HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  }

  async stop() {
    this.online=false;
    this.invite=null;
    this.sessions.clear(); this.failed.clear();
    if(this.server){ this.server.closeAllConnections(); this.server.close(); this.server=null; }
    this.port=null;
    this.onMetrics?.(this.status());
    return this.status();
  }
}

module.exports={HostServer,secureMatch};
