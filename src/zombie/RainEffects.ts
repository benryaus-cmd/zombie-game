import * as THREE from 'three';
import type { WorldEngine } from '@/game/worldTypes';
import { getTuning } from './tuning';

/** Temporary, isolated rain stress-test. Pool exactly one line draw call.
 * Does not switch HubSide's sky preset or mutate its weather/rain geometry. */
export class DeadCityRain {
 private readonly limit=1800;
 private readonly positions=new Float32Array(this.limit*6);
 private readonly speeds=new Float32Array(this.limit);
 private readonly geometry=new THREE.BufferGeometry();
 private readonly material=new THREE.LineBasicMaterial({
  color:0xbdd7ea,transparent:true,opacity:.6,depthWrite:false,depthTest:true,fog:false
 });
 private readonly mesh=new THREE.LineSegments(this.geometry,this.material);
 constructor(private world:WorldEngine) {
  const t=getTuning();
  for(let i=0;i<this.limit;i++){
   const k=i*6,angle=i*2.399963,radius=Math.sqrt((i+.5)/this.limit)*t.rainRadius;
   const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
   const y=2+(i*17.91)%18;
   this.positions[k]=x;this.positions[k+1]=y;this.positions[k+2]=z;
   this.positions[k+3]=x-.12;this.positions[k+4]=y-.72;this.positions[k+5]=z+.1;
   this.speeds[i]=12+((i*47)%29)/3;
  }
  this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
  this.mesh.frustumCulled=false;this.mesh.name='dead-city-test-rain';
  this.world.scene.add(this.mesh);
 }
 update(dt:number) {
  const t=getTuning(),active=Math.min(this.limit,Math.max(0,Math.floor(t.rainCount)));
  this.mesh.visible=active>0&&t.rainOpacity>0;
  if(!this.mesh.visible){return;}
  // Changing levels changes drawRange, not buffer allocations or draw calls.
  this.geometry.setDrawRange(0,active*2);
  this.material.opacity=t.rainOpacity;
  this.material.color.setRGB(t.rainBrightness,t.rainBrightness,t.rainBrightness);
  this.mesh.position.set(this.world.playerPosition.x,this.world.playerPosition.y-3.5,this.world.playerPosition.z);
  const length=t.rainLength;
  const radius=t.rainRadius;
  for(let i=0;i<active;i++){
   const k=i*6,dy=this.speeds[i]*dt*t.rainSpeed;
   let y=this.positions[k+1]-dy,x=this.positions[k],z=this.positions[k+2];
   if(y<0) {
    // deterministic pseudo-random distribution keeps streaks around moving player
    x=Math.sin(i*12.9898+Math.floor(this.positions[k+1])*2.71)*radius;
    z=Math.cos(i*23.531+Math.floor(this.positions[k+1])*3.13)*radius;
    y=16+((i*17)%31)*.13;
   } else {
    x+=dt*t.rainWind*.6;
    if(x>radius)x-=radius*2;else if(x< -radius)x+=radius*2;
   }
   this.positions[k]=x;this.positions[k+1]=y;this.positions[k+2]=z;
   this.positions[k+3]=x-t.rainWind*.09;
   this.positions[k+4]=y-length;
   this.positions[k+5]=z+.09;
  }
  // When a new level enables previously hidden drops, they retain their initial
  // positions; all visible active vertices are refreshed every tick.
  (this.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
 }
 dispose() {
  this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();
 }
}
