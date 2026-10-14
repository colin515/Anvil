import {useEffect,useRef,useState,type ReactNode} from 'react';

export const motion={instant:0,fast:120,base:180,slow:320,hero:480,stagger:45,spring:{stiffness:420,damping:34,mass:.85}} as const;

export function useReducedMotion(){
  const [reduce,setReduce]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const listener=()=>setReduce(query.matches);query.addEventListener('change',listener);return()=>query.removeEventListener('change',listener)},[]);
  return reduce;
}

export function Reveal({children,delay=0,className=''}:{children:ReactNode;delay?:number;className?:string}){
  const reduced=useReducedMotion();
  return <div className={`reveal ${className}`} style={{animationDelay:reduced?'0ms':`${delay}ms`}}>{children}</div>;
}
export function Stagger({children,className=''}:{children:ReactNode[];className?:string}){
  return <div className={className}>{children.map((child,i)=><Reveal key={i} delay={Math.min(i,7)*motion.stagger}>{child}</Reveal>)}</div>;
}
export function Presence({visible,children}:{visible:boolean;children:ReactNode}){
  const reduced=useReducedMotion();const [mounted,setMounted]=useState(visible);
  useEffect(()=>{if(visible){setMounted(true);return;}if(reduced){setMounted(false);return;}const id=window.setTimeout(()=>setMounted(false),motion.fast);return()=>clearTimeout(id)},[visible,reduced]);
  if(!mounted)return null;
  return <div className={visible?'presence-in':'presence-out'}>{children}</div>;
}
export function NumberFlow({value,suffix='',digits=0}:{value:number;suffix?:string;digits?:number}){
  const reduced=useReducedMotion();const [shown,setShown]=useState(value);const previous=useRef(value);
  useEffect(()=>{
    if(reduced){setShown(value);previous.current=value;return;}
    const start=performance.now(),from=previous.current;let raf=0;
    function frame(now:number){const p=Math.min((now-start)/motion.slow,1),e=1-Math.pow(1-p,3);setShown(from+(value-from)*e);if(p<1)raf=requestAnimationFrame(frame);else previous.current=value;}
    raf=requestAnimationFrame(frame);return()=>{cancelAnimationFrame(raf);previous.current=value};
  },[value,reduced]);
  return <span className="tabular">{shown.toFixed(digits)}{suffix}</span>;
}
export function Meter({value,tone='heat',label}:{value:number;tone?:'heat'|'cyan'|'green';label?:string}){
  return <div className="meter-wrap" role="progressbar" aria-valuenow={Math.max(0,Math.min(100,value))} aria-valuemin={0} aria-valuemax={100} aria-label={label||'Fit meter'}>
    <div className="meter-track"><div className={`meter-fill ${tone}`} style={{transform:`scaleX(${Math.max(0,Math.min(100,value))/100})`}}/></div>
  </div>;
}
export function StatusPill({state}:{state:'live'|'idle'|'busy'|'error'}){
  return <span className={`status-pill status-${state}`}><span className="status-dot" aria-hidden="true"/>{state==='live'?'Live':state==='busy'?'Working':state==='error'?'Attention':'Offline'}</span>;
}
