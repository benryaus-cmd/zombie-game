import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { TUNING, DEFAULT_TUNING, getTuning, setTuning, resetTuning, subscribeTuning, tuningJSON, type TuneKey } from './tuning';
import './debug.css';

type Preview='pistol'|'rifle'|'shotgun'|'idle'|'reload'|'warShot'|'warBoom'|'firePop';
/** Standalone removable draggable overlay. Removing this file/import/CSS removes it. */
export default function DebugPanel({onClose,orientation,haptics,onTestAudio,onCollapseChange}:{
 onClose:()=>void;orientation:'portrait'|'landscape';haptics:boolean;
 onTestAudio:(event:Preview)=>void;onCollapseChange?:(collapsed:boolean)=>void;
}){
 const panel=useRef<HTMLDivElement>(null);
 const drag=useRef<{pointer:number;x:number;y:number;left:number;top:number}|null>(null);
 const [position,setPosition]=useState({left:12,top:30});
 const [collapsed,setCollapsed]=useState(false);
 const [fps,setFps]=useState('FPS --');
 const [values,setValues]=useState(getTuning());
 const [status,setStatus]=useState('');
 useEffect(()=>subscribeTuning(()=>setValues(getTuning())),[]);
 useEffect(()=>{
  const update=()=>setFps(document.querySelector('.dc-debug-fps')?.getAttribute('aria-label')??'FPS --');
  update();const timer=window.setInterval(update,750);
  return()=>window.clearInterval(timer);
 },[]);
 const json=JSON.stringify({...JSON.parse(tuningJSON()),orientation,hapticsEnabled:haptics,fps},null,2);
 async function copy(){
  try{await navigator.clipboard.writeText(json);setStatus('COPIED');}
  catch{
   const field=panel.current?.querySelector<HTMLTextAreaElement>('.dc-debug-json');
   field?.focus();field?.select();
   try{setStatus(document.execCommand('copy')?'COPIED':'SELECT JSON TO COPY');}
   catch{setStatus('SELECT JSON TO COPY');}
  }
 }
 function pointerDown(event:PointerEvent<HTMLElement>){
  if(event.target instanceof HTMLElement&&event.target.closest('button'))return;
  if(!panel.current)return;
  drag.current={pointer:event.pointerId,x:event.clientX,y:event.clientY,left:position.left,top:position.top};
  event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();event.stopPropagation();
 }
 function pointerMove(event:PointerEvent<HTMLElement>){
  const d=drag.current;if(!d||d.pointer!==event.pointerId)return;
  const parent=panel.current?.parentElement,rect=parent?.getBoundingClientRect();
  const width=panel.current?.offsetWidth??320,height=collapsed?50:panel.current?.offsetHeight??400;
  const maxX=Math.max(0,(rect?.width??window.innerWidth)-Math.min(width,130));
  const maxY=Math.max(0,(rect?.height??window.innerHeight)-50);
  setPosition({left:Math.min(maxX,Math.max(0,d.left+event.clientX-d.x)),
    top:Math.min(maxY,Math.max(0,d.top+event.clientY-d.y))});
  event.stopPropagation();
 }
 function endDrag(event:PointerEvent<HTMLElement>){
  if(drag.current?.pointer===event.pointerId)drag.current=null;
  event.stopPropagation();
 }
 const keys=Object.keys(TUNING) as TuneKey[];
 const groups=Array.from(new Set(keys.map(k=>TUNING[k][1])));
 return <div ref={panel} className={'dc-debug-panel'+(collapsed?' dc-debug-collapsed':'')}
   style={{left:position.left,top:position.top}} onPointerDown={event=>event.stopPropagation()}
   onPointerMove={event=>event.stopPropagation()}>
   <header className="dc-debug-head" onPointerDown={pointerDown} onPointerMove={pointerMove}
     onPointerUp={endDrag} onPointerCancel={endDrag}>
     <strong>☷ DEAD CITY · LIVE</strong>
     <output aria-label="Current FPS">{fps}</output>
     <button onClick={()=>{const next=!collapsed;setCollapsed(next);onCollapseChange?.(next);}}
       aria-label={collapsed?'Expand settings':'Collapse settings'}>{collapsed?'EXPAND':'MINIMISE'}</button>
     <button onClick={onClose} aria-label="Close developer settings">✕</button>
   </header>
   {!collapsed&&<div className="dc-debug-scroll">
    <p>Drag the title bar anywhere. Collapse to keep FPS visible while playing.</p>
    {groups.map(group=><section key={group}>
     <h3>{group}</h3>
     {group==='Audio'&&<div className="dc-sound-preview">
      {(['pistol','rifle','shotgun','idle','reload','warShot','warBoom'] as const).map(event=>
       <button key={event} onClick={()=>onTestAudio(event)}>▶ {event.toUpperCase()}</button>)}
     </div>}
     <div className="dc-debug-grid">{keys.filter(k=>TUNING[k][1]===group).map(k=>{
      const [label,,,min,max,step]=TUNING[k];
      return <div className="dc-debug-field" key={k}>
       <div><label htmlFor={'dc-'+k}>{label}</label><button title="Reset this value"
        onClick={()=>resetTuning(k)} disabled={values[k]===DEFAULT_TUNING[k]}>↺</button></div>
       {k==='warLampInvert' ?
        <button type="button" className="dc-lamp-mode" aria-pressed={values.warLampInvert>=.5}
          onPointerDown={event=>{
            if(event.pointerType==='mouse'&&event.button!==0)return;
            event.preventDefault();event.stopPropagation();
            setTuning('warLampInvert',getTuning().warLampInvert>=.5?0:1);
          }}
          onClick={event=>{
            if(event.detail===0)setTuning('warLampInvert',getTuning().warLampInvert>=.5?0:1);
          }}>
          {values.warLampInvert>=.5 ? 'ON BY DEFAULT · FLICKER OFF' : 'OFF BY DEFAULT · FLICKER ON'}
        </button> :
        <TuningInput keyName={k} value={values[k]} min={min} max={max} step={step}/>}

      </div>;
     })}</div>
    </section>)}
    <div className="dc-debug-export">
     <button onClick={()=>resetTuning()}>RESET ALL DEFAULTS</button>
     <button onClick={copy}>COPY SETTINGS JSON</button>
     <span role="status">{status}</span>
     <textarea className="dc-debug-json" readOnly value={json} spellCheck={false}/>
    </div>
   </div>}
  </div>;
}
function TuningInput({keyName,value,min,max,step}:{keyName:TuneKey;value:number;min:number;max:number;step:number}){
 const [draft,setDraft]=useState(String(value));
 useEffect(()=>setDraft(String(value)),[value]);
 return <input id={'dc-'+keyName} type="number" min={min} max={max} step={step}
  value={draft} onChange={event=>{
   const text=event.target.value;setDraft(text);
   if(text.trim()!==''&&Number.isFinite(Number(text)))setTuning(keyName,Number(text));
  }} onBlur={()=>setDraft(String(getTuning()[keyName]))}/>;
}
