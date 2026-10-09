import * as THREE from 'three';
import { getTuning } from './tuning';

/** A single draw-call, capped pool of short-lived tracer streaks (cosmetic, hits remain hitscan). */
export class ShotTrails {
  private readonly capacity=96;
  private readonly vertex=new Float32Array(this.capacity*6);
  private readonly colours=new Float32Array(this.capacity*6);
  private readonly active=new Float32Array(this.capacity);
  private readonly duration=new Float32Array(this.capacity);
  private cursor=0;
  private readonly lines:THREE.LineSegments;
  constructor(scene:THREE.Scene) {
    const geometry=new THREE.BufferGeometry();
    for(let i=0;i<this.capacity;i++) {
      this.vertex[i*6+1]=-10000;this.vertex[i*6+4]=-10000;
    }
    geometry.setAttribute('position',new THREE.BufferAttribute(this.vertex,3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color',new THREE.BufferAttribute(this.colours,3).setUsage(THREE.DynamicDrawUsage));
    const material=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.8,
      depthWrite:false,blending:THREE.AdditiveBlending});
    this.lines=new THREE.LineSegments(geometry,material);
    this.lines.frustumCulled=false;
    this.lines.renderOrder=9;
    scene.add(this.lines);
  }
  shot(start:THREE.Vector3,direction:THREE.Vector3,hitDistance:number) {
    const t=getTuning();
    const i=this.cursor++%this.capacity,p=i*6,dir=direction.clone().normalize();
    const distance=Math.max(.3,Math.min(t.tracerLength, hitDistance));
    const from=start.clone().addScaledVector(dir,Math.min(.4,distance*.2));
    const to=start.clone().addScaledVector(dir,distance);
    from.toArray(this.vertex,p);to.toArray(this.vertex,p+3);
    for(let j=0;j<2;j++) {
      const n=p+j*3;this.colours[n]=1;this.colours[n+1]=.64;this.colours[n+2]=.27;
    }
    this.active[i]=t.tracerTime;this.duration[i]=t.tracerTime;
    this.refresh();
  }
  update(dt:number) {
    const t=getTuning();
    (this.lines.material as THREE.LineBasicMaterial).opacity=t.tracerOpacity;
    let dirty=false;
    for(let i=0;i<this.capacity;i++) if(this.active[i]>0) {
      this.active[i]=Math.max(0,this.active[i]-dt);
      const brightness=Math.max(0,this.active[i]/Math.max(.01,this.duration[i]));
      for(let j=0;j<2;j++) {
        const n=i*6+j*3;this.colours[n]=brightness;this.colours[n+1]=brightness*.6;this.colours[n+2]=brightness*.25;
      }
      if(!this.active[i])this.vertex[i*6+1]=this.vertex[i*6+4]=-10000;
      dirty=true;
    }
    if(dirty)this.refresh();
  }
  clear() {
    this.active.fill(0);
    for(let i=0;i<this.capacity;i++)this.vertex[i*6+1]=this.vertex[i*6+4]=-10000;
    this.refresh();
  }
  private refresh() {
    (this.lines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate=true;
    (this.lines.geometry.attributes.color as THREE.BufferAttribute).needsUpdate=true;
  }
  dispose() {this.lines.removeFromParent();this.lines.geometry.dispose();(this.lines.material as THREE.Material).dispose();}
}
