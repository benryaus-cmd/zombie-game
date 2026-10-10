import { useEffect, useRef } from 'react';
import type { Collider } from './combat';
import type { PickupPoint } from './Pickups';
import { getTuning } from './tuning';
export type RadarFrame = { px:number;pz:number;yaw:number;zombies:{x:number;z:number}[];supplies:PickupPoint[];buildings:Collider[] };
/** World-space to heading-up radar pixels: forward is always up. */
export function radarProject(dx:number,dz:number,yaw:number,scale:number) {
  return {x:(dx*Math.cos(yaw)-dz*Math.sin(yaw))*scale,
    y:(dx*Math.sin(yaw)+dz*Math.cos(yaw))*scale};
}
export default function Radar({read}:{read:()=>RadarFrame|null}) {
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current;if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  let timer=0,last=-1000;
  const paint=(now:number)=>{
   timer=requestAnimationFrame(paint);
   if(now-last<125)return;last=now;
   const state=read();if(!state)return;
   const diameter=148,mid=diameter/2,range=getTuning().radarRange,scale=(mid-8)/range;
   ctx.clearRect(0,0,diameter,diameter);
   ctx.save();
   ctx.beginPath();ctx.arc(mid,mid,mid-3,0,Math.PI*2);ctx.clip();
   ctx.fillStyle='rgba(6,18,21,.78)';ctx.fillRect(0,0,diameter,diameter);
   ctx.strokeStyle='#a1bcc161';ctx.lineWidth=.8;
   for(const f of [.5,1]){ctx.beginPath();ctx.arc(mid,mid,(mid-8)*f,0,Math.PI*2);ctx.stroke();}
   const {px,pz,yaw}=state;
   const point=(x:number,z:number)=>radarProject(x-px,z-pz,yaw,scale);
   ctx.fillStyle='#778086b5';
   let buildings=0;
   for(const box of state.buildings){
     if(box.maxY<.65||box.minY>2.3)continue;
     const centerX=(box.minX+box.maxX)/2,centerZ=(box.minZ+box.maxZ)/2;
     if(Math.abs(centerX-px)>range+15||Math.abs(centerZ-pz)>range+15)continue;
     if(++buildings>550)break;
     const corners=[[box.minX,box.minZ],[box.maxX,box.minZ],[box.maxX,box.maxZ],[box.minX,box.maxZ]];
     ctx.beginPath();
     corners.forEach(([x,z],i)=>{const q=point(x,z);if(!i)ctx.moveTo(mid+q.x,mid+q.y);else ctx.lineTo(mid+q.x,mid+q.y);});
     ctx.closePath();ctx.fill();
   }
   for(const p of state.supplies){
     const q=point(p.x,p.z);if(Math.hypot(q.x,q.y)>mid-5)continue;
     ctx.fillStyle='#ffda54';ctx.fillRect(mid+q.x-3,mid+q.y-3,6,6);
   }
   for(const z of state.zombies){
     const q=point(z.x,z.z);if(Math.hypot(q.x,q.y)>mid-5)continue;
     ctx.fillStyle='#71e883';ctx.beginPath();ctx.arc(mid+q.x,mid+q.y,3.3,0,Math.PI*2);ctx.fill();
   }
   ctx.fillStyle='#ffeb65';ctx.beginPath();ctx.moveTo(mid,mid-8);ctx.lineTo(mid-6,mid+7);ctx.lineTo(mid+6,mid+7);ctx.closePath();ctx.fill();
   ctx.restore();
   ctx.strokeStyle='#a5d6be91';ctx.lineWidth=2;ctx.beginPath();ctx.arc(mid,mid,mid-2,0,Math.PI*2);ctx.stroke();
   ctx.fillStyle='#cfe3dc';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText(range+'m',mid,diameter-12);
  };
  timer=requestAnimationFrame(paint);
  return()=>cancelAnimationFrame(timer);
 },[read]);
 return <canvas className="dc-radar" ref={ref} width={148} height={148} aria-label="Heading up radar: yellow player and supplies, green zombies, grey buildings"/>;
}
