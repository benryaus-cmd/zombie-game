import { useEffect, useRef, useState } from 'react';
export const METAL_STREAM = 'https://channels.fluxfm.de/metal-fm/externalembedflxhp/stream.mp3';
const VOLUME_KEY='dead-city-radio-volume';
const ENABLED_KEY='dead-city-radio-enabled';
function storedVolume() {
 try{const v=Number(localStorage.getItem(VOLUME_KEY));return Number.isFinite(v)&&localStorage.getItem(VOLUME_KEY)!==null?Math.max(0,Math.min(1,v)):.3;}catch{return .3;}
}
export function useMetalRadio() {
 const audioRef=useRef<HTMLAudioElement|null>(null);
 const [volume,setVolume]=useState(storedVolume);
 const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem(ENABLED_KEY)!=='off';}catch{return true;}});
 const [error,setError]=useState(false);
 const [playing,setPlaying]=useState(false);
 const [opened,setOpened]=useState(false);
 const play=()=>{
   const audio=audioRef.current;
   if(!audio||!enabled)return;
   audio.volume=volume;
   if(!audio.src)audio.src=METAL_STREAM;
   void audio.play().then(()=>{setError(false);setPlaying(true);}).catch(()=>{setError(true);setPlaying(false);});
 };
 const on=()=>{
   setEnabled(true);
   try{localStorage.setItem(ENABLED_KEY,'on');}catch{}
   const audio=audioRef.current;
   if(audio){audio.volume=volume;if(!audio.src)audio.src=METAL_STREAM;void audio.play().then(()=>{setError(false);setPlaying(true)}).catch(()=>{setError(true);setPlaying(false)});}
 };
 const off=()=>{audioRef.current?.pause();setPlaying(false);setEnabled(false);try{localStorage.setItem(ENABLED_KEY,'off');}catch{}};
 const change=(v:number)=>{
   const clamped=Math.min(1,Math.max(0,v));setVolume(clamped);
   if(audioRef.current)audioRef.current.volume=clamped;
   try{localStorage.setItem(VOLUME_KEY,String(clamped));}catch{}
 };
 useEffect(()=>()=>{audioRef.current?.pause();audioRef.current?.removeAttribute('src');audioRef.current?.load();},[]);
 return {audioRef,volume,enabled,error,playing,opened,setOpened,play,on,off,change};
}
export type RadioController=ReturnType<typeof useMetalRadio>;
export function MetalRadio({radio,onOpen,onClose}:{radio:RadioController;onOpen:()=>void;onClose:()=>void}) {
 return <>
  <audio ref={radio.audioRef} preload="none" onPlaying={()=>{}} />
  <button className="dc-radio-mini" onClick={onOpen} aria-label="MetalFM radio settings">♫ METAL FM {radio.enabled ? '●' : '○'}</button>
  {radio.opened && <div className="dc-radio-overlay" onPointerDown={e=>e.stopPropagation()}>
    <div className="dc-radio-dialog">
      <h2>♫ METAL FM</h2>
      <p>Live metal station</p>
      <div className="dc-radio-actions">
        <button aria-pressed={radio.enabled} onClick={radio.on}>ON</button>
        <button aria-pressed={!radio.enabled} onClick={radio.off}>OFF</button>
      </div>
      <label htmlFor="dc-radio-volume">VOLUME · {Math.round(radio.volume*100)}%</label>
      <input id="dc-radio-volume" type="range" min="0" max="1" step=".01" value={radio.volume}
        onChange={e=>radio.change(Number(e.target.value))}/>
      {radio.error&&<p className="dc-radio-error">Stream unavailable or blocked by the WebView. Tap ON to retry.</p>}
      <button className="dc-radio-close" onClick={onClose}>BACK TO GAME</button>
    </div>
   </div>}
 </>;
}
