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
  'war-stinger-0.ogg': new URL('../../public/audio/sfx/war-stinger-0.ogg', import.meta.url).href,
  'war-stinger-1.ogg': new URL('../../public/audio/sfx/war-stinger-1.ogg', import.meta.url).href,
  'war-stinger-2.ogg': new URL('../../public/audio/sfx/war-stinger-2.ogg', import.meta.url).href,
  'war-explosion.wav': new URL('../../public/audio/sfx/war-explosion.wav', import.meta.url).href,
  'war-fire-crackle.ogg': new URL('../../public/audio/sfx/war-fire-crackle.ogg', import.meta.url).href,
  'combo-hit.ogg': new URL('../../public/audio/sfx/combo-hit.ogg', import.meta.url).href,
  'combo-up.ogg': new URL('../../public/audio/sfx/combo-up.ogg', import.meta.url).href,
  'combo-big.ogg': new URL('../../public/audio/sfx/combo-big.ogg', import.meta.url).href,
  'reload.ogg': new URL('../../public/audio/sfx/reload.ogg', import.meta.url).href,
  'reload-rifle.ogg': new URL('../../public/audio/sfx/reload-rifle.ogg', import.meta.url).href,
  'reload-shotgun.ogg': new URL('../../public/audio/sfx/reload-shotgun.ogg', import.meta.url).href,
  'empty-click.ogg': new URL('../../public/audio/sfx/empty-click.ogg', import.meta.url).href,
  'bullet-impact-0.ogg': new URL('../../public/audio/sfx/bullet-impact-0.ogg', import.meta.url).href,
  'bullet-impact-1.ogg': new URL('../../public/audio/sfx/bullet-impact-1.ogg', import.meta.url).href,
};
export type SfxEvent = 'pistol'|'rifle'|'shotgun'|'idle'|'alert'|'attack'|'hurt'|'death'|'critical'|'crawl'|'reload'|'reloadRifle'|'reloadShotgun'|'empty'|'impact'|'comboHit'|'comboUp'|'comboBig'|'warShot'|'warBoom'|'firePop';
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
 reloadRifle:['reload-rifle.ogg'],
 reloadShotgun:['reload-shotgun.ogg'],
 empty:['empty-click.ogg'],
 impact:['bullet-impact-0.ogg','bullet-impact-1.ogg'],
 comboHit:['war-stinger-0.ogg'],comboUp:['war-stinger-1.ogg'],comboBig:['war-stinger-2.ogg'],
 warShot:['rifle-0.wav','rifle-1.wav','rifle-2.wav'],warBoom:['war-explosion.wav'],firePop:['war-fire-crackle.ogg'],
};
type Playback = {category:'weapon'|'zombie'|'ui'|'ambient';started:number};
export class ZombieAudio {
 private context: AudioContext | null = null;
 private master: GainNode | null = null;
 private weaponBus: GainNode | null = null;
 private zombieBus: GainNode | null = null;
 private uiBus: GainNode | null = null;
 private ambientBus: GainNode | null = null;
 private windSource: AudioBufferSourceNode | null=null;
 private windGain: GainNode | null=null;
 private readonly cache=new Map<string,AudioBuffer>();
 private readonly pending=new Set<string>();
 private readonly playing=new Set<Playback>();
 private readonly cooldowns=new Map<string,number>();
 private listenerPosition=new THREE.Vector3();
 private disposed=false;
 private paused=false;
 private lastClip=new Map<string,string>();

 setPaused(state:boolean){this.paused=state;this.update();}
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
    this.ambientBus=context.createGain();this.ambientBus.connect(this.master);
    // Filtered 2s procedural wind loop: no extra download, one reusable node.
    const windBuffer=context.createBuffer(1,Math.ceil(context.sampleRate*2),context.sampleRate);
    const channel=windBuffer.getChannelData(0);
    for(let i=0;i<channel.length;i++)channel[i]=Math.random()*2-1;
    const lowpass=context.createBiquadFilter();lowpass.type='lowpass';lowpass.frequency.value=220;
    this.windGain=context.createGain();this.windGain.gain.value=0;
    const source=context.createBufferSource();source.buffer=windBuffer;source.loop=true;
    source.connect(lowpass);lowpass.connect(this.windGain);this.windGain.connect(this.ambientBus);source.start();
    this.windSource=source;
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
  if(this.ambientBus)this.ambientBus.gain.value=this.paused?0:1;
  if(this.windGain)this.windGain.gain.value=t.warWindVolume*.035;
  const l=ctx.listener,p=this.listenerPosition,f=forward||new THREE.Vector3(0,0,-1);
  if(l.positionX){l.positionX.value=p.x;l.positionY.value=p.y;l.positionZ.value=p.z;}
  else if(l.setPosition)l.setPosition(p.x,p.y,p.z);
  if(l.forwardX){l.forwardX.value=f.x;l.forwardY.value=f.y;l.forwardZ.value=f.z;l.upX.value=0;l.upY.value=1;l.upZ.value=0;}
  else if(l.setOrientation)l.setOrientation(f.x,f.y,f.z,0,1,0);
 }
 play(event:SfxEvent,pos?:THREE.Vector3,gateKey?:string) {
  const ctx=this.context;if(this.disposed||!ctx||ctx.state!=='running')return;
  const t=getTuning();
  const category:Playback['category'] = event==='warShot'||event==='warBoom'||event==='firePop'?'ambient':
    event==='pistol'||event==='rifle'||event==='shotgun'?'weapon':
    event==='reload'||event==='reloadRifle'||event==='reloadShotgun'||event==='empty'||event.startsWith('combo')?'ui':'zombie';
  const now=ctx.currentTime;
  const key=gateKey||event;
  const minGap=category==='zombie'?t.zombieMinGap:event==='empty'?.11:event==='warShot'?.09:event==='warBoom'?3:event==='firePop'?.7:event.startsWith('combo')?.55:0;
  if(now-(this.cooldowns.get(key)||-100)<minGap)return;
  if(category==='ambient'&&this.paused)return;
   if(category==='ambient'&&pos){
     const distance=pos.distanceTo(this.listenerPosition);
     if(distance>(event==='firePop'?26:event==='warShot'?150:180))return;
   }
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
   source.playbackRate.value=(event==='warShot'?.91:event==='warBoom'?.84:1)+(Math.random()-.5)*2*(category==='zombie'?t.zombiePitchVariation:category==='ambient'?.045:t.gunPitchVariation);
   const gain=ctx.createGain();
   gain.gain.value=category==='zombie'?.7:
    event==='warShot'?.4*t.warAmbienceVolume:
    event==='warBoom'?.38*t.warExplosionVolume:
    event==='firePop'?.65*t.warFireSoundVolume:
    event.startsWith('combo')?t.comboVolume:1;
   source.connect(gain);
   if((category==='zombie'||category==='ambient')&&pos){
    const pan=ctx.createPanner();pan.panningModel='HRTF';pan.distanceModel='inverse';
    pan.refDistance=event==='firePop'?4:event==='warShot'?24:event==='warBoom'?30:Math.max(1,t.zombieRefDistance);
    pan.maxDistance=event==='firePop'?26:event==='warShot'?150:event==='warBoom'?180:t.zombieAudibleDistance;
    pan.rolloffFactor=event==='firePop'?1.4:event==='warShot'?.35:event==='warBoom'?.5:t.zombieRolloff;
    pan.positionX.value=pos.x;pan.positionY.value=pos.y;pan.positionZ.value=pos.z;
    gain.connect(pan);pan.connect(category==='ambient'?this.ambientBus!:this.zombieBus!);
    source.onended=()=>{this.playing.delete(token);source.disconnect();gain.disconnect();pan.disconnect()};
   }else{
    gain.connect(category==='weapon'?this.weaponBus!:category==='ui'?this.uiBus!:category==='ambient'?this.ambientBus!:this.zombieBus!);
    source.onended=()=>{this.playing.delete(token);source.disconnect();gain.disconnect()};
   }
   const token:Playback={category,started:now};this.playing.add(token);
   source.start();
   this.cooldowns.set(key,now);
  }catch(e){console.warn('Sound playback failed',event,e)}
 }
 dispose() {
  this.disposed=true;this.cache.clear();this.pending.clear();this.playing.clear();
  this.cooldowns.clear();try{this.windSource?.stop();}catch{/* already stopped */}
  this.windSource?.disconnect();this.windGain?.disconnect();this.windSource=null;this.windGain=null;
  void this.context?.close().catch(()=>undefined);this.context=null;
 }
}
