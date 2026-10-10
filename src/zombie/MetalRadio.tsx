import { useEffect, useRef, useState } from 'react';
import { RADIO_STATIONS } from '@/config/radio';
import { LiveRadioController, type LiveRadioState } from '@/game/liveRadio';

// Use HubSide's PROVEN lazy HTMLAudioElement controller, not an embedded <audio>
// tag and not a static literal stream URL scanned by Aippy's asset preloader.
const METAL=RADIO_STATIONS.find(station=>station.id==='metal')!;
const VOLUME_KEY='dead-city-radio-volume';
const ENABLED_KEY='dead-city-radio-enabled';
function storedVolume(){
  try {const stored=localStorage.getItem(VOLUME_KEY);
    if(stored!==null){const n=Number(stored);if(Number.isFinite(n))return Math.max(0,Math.min(1,n));}
  }catch{/* defaults */}
  return .3;
}
function storedEnabled(){
  try{return localStorage.getItem(ENABLED_KEY)!=='off';}catch{return true;}
}
export function useMetalRadio(){
  const controllerRef=useRef<LiveRadioController|null>(null);
  if(!controllerRef.current)controllerRef.current=new LiveRadioController(METAL.url,storedVolume());
  const controller=controllerRef.current;
  const [status,setStatus]=useState<LiveRadioState>(()=>controller.getState());
  const [enabled,setEnabled]=useState(storedEnabled);
  const [opened,setOpened]=useState(false);
  useEffect(()=>{
    const stop=controller.subscribe(setStatus);
    return ()=>{stop();controller.dispose();};
  },[controller]);
  // Starting or resuming the game is a user gesture. Never autoplay at page load.
  const play=()=>{if(enabled)controller.play();};
  const on=()=>{setEnabled(true);
    try{localStorage.setItem(ENABLED_KEY,'on');}catch{}
    controller.play();
  };
  const off=()=>{controller.pause();setEnabled(false);
    try{localStorage.setItem(ENABLED_KEY,'off');}catch{}
  };
  const change=(value:number)=>{
    controller.setVolume(value);
    try{localStorage.setItem(VOLUME_KEY,String(controller.getState().volume));}catch{}
  };
  return {volume:status.volume,enabled,playing:status.playing,buffering:status.buffering,
    error:status.error,opened,setOpened,play,on,off,change};
}
export type RadioController=ReturnType<typeof useMetalRadio>;
export function MetalRadio({radio,onOpen,onClose}:{radio:RadioController;onOpen:()=>void;onClose:()=>void}){
  return <>
    <button className="dc-radio-mini" onClick={onOpen} aria-label="MetalFM radio settings"
      aria-pressed={radio.playing}>♫ METAL {radio.playing?'●':radio.buffering?'◌':'○'}</button>
    {radio.opened&&<div className="dc-radio-overlay" onPointerDown={event=>event.stopPropagation()}>
      <div className="dc-radio-dialog">
        <h2>♫ METAL FM</h2>
        <p>Live metal station</p>
        <div className="dc-radio-actions">
          <button aria-pressed={radio.enabled} onClick={radio.on}>ON</button>
          <button aria-pressed={!radio.enabled} onClick={radio.off}>OFF</button>
        </div>
        <label htmlFor="dc-radio-volume">VOLUME · {Math.round(radio.volume*100)}%</label>
        <input id="dc-radio-volume" type="range" min="0" max="1" step=".01"
          value={radio.volume} onChange={event=>radio.change(Number(event.target.value))}/>
        {radio.buffering&&<p className="dc-radio-status">Connecting to live radio…</p>}
        {radio.error&&<p className="dc-radio-error">Radio couldn't start. Tap ON to retry.</p>}
        <button className="dc-radio-close" onClick={onClose}>BACK TO GAME</button>
      </div>
    </div>}
  </>;
}
