import * as THREE from 'three';
import { getTuning } from './tuning';

/** Standalone, local-file-only Web Audio mixer. One context + decoded shared buffers. */
const URLS: Record<string,string> = {
  'pistol-0.wav': new URL('../../public/audio/sfx/pistol-0.wav', import.meta.url).href,
  'pistol-1.wav': new URL('../../public/audio/sfx/pistol-1.wav', import.meta.url).href,
  'pistol-2.wav': new URL('../../public/audio/sfx/pistol-2.wav', import.meta.url).href,
  'rifle-0.wav': new URL('../../public/audio/sfx/rifle-0.wav', import.meta.url).href,
  'rifle-1.wav': new URL('../../public/audio/sfx/rifle-1.wav', import.meta.url).href,
  'rifle-2.wav': new URL('../../public/audio/sfx/rifle-2.wav', import.meta.url).href,
  'shotgun-0.wav': new URL('../../public/audio/sfx/shotgun-0.wav', import.meta.url).href,
  'shotgun-1.wav': new URL('../../public/audio/sfx/shotgun-1.wav', import.meta.url).href,
  'zombie-1.wav': new URL('../../public/audio/sfx/zombie-1.wav', import.meta.url).href,
  'zombie-3.wav': new URL('../../public/audio/sfx/zombie-3.wav', import.meta.url).href,
  'zombie-4.wav': new URL('../../public/audio/sfx/zombie-4.wav', import.meta.url).href,
  'zombie-5.wav': new URL('../../public/audio/sfx/zombie-5.wav', import.meta.url).href,
  'zombie-6.wav': new URL('../../public/audio/sfx/zombie-6.wav', import.meta.url).href,
  'zombie-7.wav': new URL('../../public/audio/sfx/zombie-7.wav', import.meta.url).href,
  'zombie-8.wav': new URL('../../public/audio/sfx/zombie-8.wav', import.meta.url).href,
  'zombie-9.wav': new URL('../../public/audio/sfx/zombie-9.wav', import.meta.url).href,
  'zombie-10.wav': new URL('../../public/audio/sfx/zombie-10.wav', import.meta.url).href,
  'zombie-11.wav': new URL('../../public/audio/sfx/zombie-11.wav', import.meta.url).href,
  'zombie-12.wav': new URL('../../public/audio/sfx/zombie-12.wav', import.meta.url).href,
  'reload.ogg': new URL('../../public/audio/sfx/reload.ogg', import.meta.url).href,
  'empty-click.ogg': new URL('../../public/audio/sfx/empty-click.ogg', import.meta.url).href,
  'bullet-impact-0.ogg': new URL('../../public/audio/sfx/bullet-impact-0.ogg', import.meta.url).href,
  'bullet-impact-1.ogg': new URL('../../public/audio/sfx/bullet-impact-1.ogg', import.meta.url).href,
};
export type SfxEvent = 'pistol'|'rifle'|'shotgun'|'idle'|'alert'|'attack'|'hurt'|'death'|'critical'|'crawl'|'reload'|'empty'|'impact';
const CLIPS: Record<SfxEvent,string[]> = {
 pistol:['pistol-0.wav','pistol-1.wav','pistol-2.wav'],
 rifle:['rifle-0.wav','rifle-1.wav','rifle-2.wav'],
 shotgun:['shotgun-0.wav','shotgun-1.wav'],
 idle:['zombie-1.wav','zombie-3.wav','zombie-4.wav','zombie-5.wav','zombie-6.wav','zombie-7.wav'],
 alert:['zombie-8.wav','zombie-9.wav','zombie-10.wav'],
 attack:['zombie-10.wav','zombie-11.wav','zombie-12.wav'],
 hurt:['zombie-3.wav','zombie-6.wav','zombie-8.wav'],
 death:['zombie-9.wav','zombie-11.wav','zombie-12.wav'],
 critical:['zombie-7.wav','zombie-12.wav'],
 crawl:['zombie-1.wav','zombie-5.wav'],
 reload:['reload.ogg'],
 empty:['empty-click.ogg'],
 impact:['bullet-impact-0.ogg','bullet-impact-1.ogg'],
};
type Playback = {category:'weapon'|'zombie'|'ui';started:number};
export class ZombieAudio {
 private context: AudioContext | null = null;
 private master: GainNode | null = null;
 private weaponBus: GainNode | null = null;
 private zombieBus: GainNode | null = null;
 private uiBus: GainNode | null = null;
 private readonly cache=new Map<string,AudioBuffer>();
 private readonly pending=new Set<string>();
 private readonly playing=new Set<Playback>();
 private readonly cooldowns=new Map<string,number>();
 private listenerPosition=new THREE.Vector3();
 private disposed=false;
 private lastClip=new Map<string,string>();

 unlock() {
  if(this.disposed)return;
  if(!this.context) {
   const Factory=window.AudioContext;
   if(!Factory)return;
   try {
    const context=new Factory({latencyHint:'interactive'});
    this.context=context;
    this.master=context.createGain();this.master.connect(context.destination);
    this.weaponBus=context.createGain();this.weaponBus.connect(this.master);
    this.zombieBus=context.createGain();this.zombieBus.connect(this.master);
    this.uiBus=context.createGain();this.uiBus.connect(this.master);
    this.update();
   } catch(e){console.warn('Dead City: audio unavailable',e);return;}
  }
  if(this.context.state==='suspended')void this.context.resume().catch(()=>undefined);
  void this.preload();
 }
 private async preload() {
  // Small essentials first, then only the files the current game actually uses.
  for(const [index,name] of Object.keys(URLS).entries()){
   if(this.disposed)return;
   // Batch with explicit yield; don't decode all samples in one frame.
   void this.load(name);
   if(index%3===2)await new Promise(resolve=>setTimeout(resolve,35));
  }
 }
 private async load(name:string) {
  const context=this.context, url=URLS[name];
  if(!context||!url||this.cache.has(name)||this.pending.has(name)||this.disposed)return;
  this.pending.add(name);
  try{
   const response=await fetch(url);
   if(!response.ok)throw new Error(name+': '+response.status);
   const raw=await response.arrayBuffer();
   if(this.disposed)return;
   const decoded=await context.decodeAudioData(raw);
   if(!this.disposed)this.cache.set(name,decoded);
  }catch(e){if(!this.disposed)console.warn('Dead City audio not loaded:',name,e)}
  finally{this.pending.delete(name)}
 }
 update(listener?:THREE.Vector3,forward?:THREE.Vector3) {
  const t=getTuning();
  if(listener)this.listenerPosition.copy(listener);
  const ctx=this.context;if(!ctx)return;
  if(this.master)this.master.gain.value=t.masterVolume;
  if(this.weaponBus)this.weaponBus.gain.value=t.weaponVolume;
  if(this.zombieBus)this.zombieBus.gain.value=t.zombieVolume;
  if(this.uiBus)this.uiBus.gain.value=t.uiVolume;
  const l=ctx.listener,p=this.listenerPosition,f=forward||new THREE.Vector3(0,0,-1);
  if(l.positionX){l.positionX.value=p.x;l.positionY.value=p.y;l.positionZ.value=p.z;}
  else if(l.setPosition)l.setPosition(p.x,p.y,p.z);
  if(l.forwardX){l.forwardX.value=f.x;l.forwardY.value=f.y;l.forwardZ.value=f.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
  else if(l.setOrientation)l.setOrientation(f.x,f.y,f.z,0,1,0);
 }
 play(event:SfxEvent,pos?:THREE.Vector3,gateKey?:string) {
  const ctx=this.context;if(this.disposed||!ctx||ctx.state!=='running')return;
  const t=getTuning(), category=event==='pistol'||event==='rifle'||event==='shotgun'?'weapon':event==='reload'||event==='empty'?'ui':'zombie';
  const now=ctx.currentTime;
  const key=gateKey||event;
  const minGap=category==='zombie'?t.zombieMinGap:event==='empty'?.11:0;
  if(now-(this.cooldowns.get(key)||-100)<minGap)return;
  if(category==='zombie'){
   const distance=pos?.distanceTo(this.listenerPosition)||0;
   if(distance>t.zombieAudibleDistance)return;
   const voices=Array.from(this.playing).filter(p=>p.category==='zombie').length;
   if(voices>=t.zombieVoiceLimit)return;
  }
  const variants=CLIPS[event];
  if(!variants?.length)return;
  let candidate=variants[Math.floor(Math.random()*variants.length)];
  if(variants.length>1 && this.lastClip.get(event)===candidate)candidate=variants[(variants.indexOf(candidate)+1)%variants.length];
  this.lastClip.set(event,candidate);
  const buffer=this.cache.get(candidate);
  if(!buffer){void this.load(candidate);return;}
  try{
   const source=ctx.createBufferSource();source.buffer=buffer;
   source.playbackRate.value=1+(Math.random()-.5)*2*(category==='zombie'?t.zombiePitchVariation:t.gunPitchVariation);
   const gain=ctx.createGain();
   gain.gain.value=category==='zombie'?.7:1;
   source.connect(gain);
   if(category==='zombie'&&pos){
    const pan=ctx.createPanner();pan.panningModel='HRTF';pan.distanceModel='inverse';
    pan.refDistance=Math.max(1,t.zombieRefDistance);pan.maxDistance=t.zombieAudibleDistance;
    pan.rolloffFactor=t.zombieRolloff;
    pan.positionX.value=pos.x;pan.positionY.value=pos.y;pan.positionZ.value=pos.z;
    gain.connect(pan);pan.connect(this.zombieBus!);
    source.onended=()=>{this.playing.delete(token);source.disconnect();gain.disconnect();pan.disconnect()};
   }else{
    gain.connect(category==='weapon'?this.weaponBus!:category==='ui'?this.uiBus!:this.zombieBus!);
    source.onended=()=>{this.playing.delete(token);source.disconnect();gain.disconnect()};
   }
   const token:Playback={category,started:now};this.playing.add(token);
   source.start();
   this.cooldowns.set(key,now);
  }catch(e){console.warn('Sound playback failed',event,e)}
 }
 dispose() {
  this.disposed=true;this.cache.clear();this.pending.clear();this.playing.clear();
  this.cooldowns.clear();void this.context?.close().catch(()=>undefined);this.context=null;
 }
}
