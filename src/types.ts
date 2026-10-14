export interface Hardware {
  cpu: string; cores: number; ramTotalGb: number; ramFreeGb: number;
  platform: string; gpu: string; vramGb: number; diskFreeGb: number; diskTotalGb: number;
}
export interface ModelChoice {
  id: string; name: string; gb: number; description: string; tags: string[];
  fit: number; tier: 'excellent'|'good'|'cpu'|'limited'; note: string; context: string;
}
export interface OllamaState { online: boolean; models: {name:string;sizeGb:number}[]; }
export interface HostState {
  online: boolean; localUrl: string|null; lanUrls: {url:string;interface:string;ip:string}[];
  accessEnabled:boolean;publicUrl: string|null;
  connectedUsers: number; activeRequests: number; totalRequests: number; invite: string|null;
}
export interface AccessState {enabled:boolean;code:string;}
export interface GpuUsage {percent:number|null;vramUsedMb:number|null;vramTotalMb:number|null;source:string;scope:string;}
export interface ScanResult {hardware: Hardware; models: ModelChoice[]}
export interface AppState {hardware: Hardware|null; activeModel:string|null;host:HostState;ollama:OllamaState;access:AccessState;}
export interface PullEvent {model:string;status:string;completed:number;total:number;}
export interface ScanEvent {key:string;value:string;status:'complete'|'unknown';}
declare global {
  interface Window {
    anvil?: {
      invoke: <T=unknown>(channel:string,...args:unknown[])=>Promise<T>;
      on: (channel:string,callback:(data:any)=>void)=>()=>void;
    }
  }
}
