'use strict';
const {contextBridge, ipcRenderer} = require('electron');
const channels=new Set(['scan:component','scan:done','model:pull','host:status','app:error']);
contextBridge.exposeInMainWorld('anvil',{
  invoke:(channel,...args)=>{
    const allowed=['hardware:scan','ollama:status','ollama:pull','model:select','model:benchmark','host:start','local:open','local:copy','host:stop','host:status','app:state','external:open'];
    if(!allowed.includes(channel))return Promise.reject(new Error('Invalid action'));
    return ipcRenderer.invoke(channel,...args);
  },
  on:(channel,callback)=>{
    if(!channels.has(channel)||typeof callback!=='function')return ()=>{};
    const listener=(_event,data)=>callback(data);
    ipcRenderer.on(channel,listener);
    return ()=>ipcRenderer.removeListener(channel,listener);
  }
});
