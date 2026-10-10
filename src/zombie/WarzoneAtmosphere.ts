import * as THREE from 'three';
import type { WorldEngine } from '@/game/worldTypes';
import { getGroundHeight } from '@/game/worldMovement';
import { freeAt } from './navigation';
import { getTuning } from './tuning';

type Site = { group:THREE.Group;fire:THREE.Mesh[];glow:THREE.Mesh; pos:THREE.Vector3; phase:number };
type Streak={start:THREE.Vector3;end:THREE.Vector3;age:number};
const LOCATIONS:[number,number][]=[
 [-34,12],[30,28],[-19,-29],[34,-20],[-55,30],[48,40],[-13,51],[8,-46]
];
const BATTLES:[number,number,number,number][]=[
 [-53,-53,-24,-52],[-25,-18,23,-17],[24,16,57,14],
 [-51,30,-25,29],[-15,57,15,57],[42,-52,55,-22]
];

/**
 * Optional Dead City atmosphere, independent of the HubSide world and gameplay.
 * Shared geometries, at most two shadowless local lights, one smoke Points buffer,
 * and a tiny capped LineSegments pool. Does NOT add collision or real gun damage.
 */
export class WarzoneAtmosphere {
 private sites:Site[]=[];
 private readonly root=new THREE.Group();
 private readonly barrel=new THREE.CylinderGeometry(.37,.39,.85,8);
 private readonly barrelMat=new THREE.MeshStandardMaterial({color:0x322b28,metalness:.26,roughness:.89});
 private readonly stripeMat=new THREE.MeshBasicMaterial({color:0x9b5330});
 private readonly flame=new THREE.ConeGeometry(.34,.94,5);
 private readonly flameMats=[
   new THREE.MeshBasicMaterial({color:0xf65818,transparent:true,opacity:.87,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),
   new THREE.MeshBasicMaterial({color:0xffb12b,transparent:true,opacity:.93,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),
   new THREE.MeshBasicMaterial({color:0xffe985,transparent:true,opacity:.87,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),
 ];
 private readonly glowMat=new THREE.MeshBasicMaterial({color:0xed632a,transparent:true,opacity:.20,depthWrite:false,side:THREE.DoubleSide});
 private readonly glowGeo=new THREE.CircleGeometry(2.3,16);
 private readonly smokeGeom=new THREE.BufferGeometry();
 private readonly smokePositions=new Float32Array(8*11*3);
 private readonly smokeMat=new THREE.PointsMaterial({color:0x4d4844,size:1.2,transparent:true,opacity:.30,depthWrite:false,sizeAttenuation:true});
 private readonly smoke:THREE.Points;
 private readonly lights=[new THREE.PointLight(0xff6d29,0,10),new THREE.PointLight(0xff6d29,0,10)];
 private readonly tracerGeom=new THREE.BufferGeometry();
 private readonly tracerMaterial=new THREE.LineBasicMaterial({color:0xfdb95b,transparent:true,opacity:.0,depthWrite:false,depthTest:true});
 private readonly traces:THREE.LineSegments;
 private readonly traceData=new Float32Array(3*8*2);
 private streaks:Streak[]=[];
 private clock=0;
 private nextBattle=13;
 private battleBurst=0;
 private lastLampTick=0;
 private nextFirePop=2.2;
 private shotTimer=0;
 private destroyed=false;
 constructor(private world:WorldEngine,private onSound:(name:'warShot'|'warBoom'|'firePop',pos:THREE.Vector3)=>void){
   this.root.name='dead-city-warzone-atmosphere';world.scene.add(this.root);
   const nearby=world.colliders;
   for(let index=0;index<LOCATIONS.length;index++){
     const [x,z]=LOCATIONS[index];
     if(!freeAt(x,z,nearby,1.3))continue;
     const group=new THREE.Group();
     group.position.set(x,getGroundHeight(world,x,z),z);
     const cylinder=new THREE.Mesh(this.barrel,this.barrelMat);cylinder.position.y=.46;group.add(cylinder);
     // Rust bands use shared geometry/materials and do not block the road.
     for(const y of [.2,.75]){
       const rim=new THREE.Mesh(this.barrel,this.stripeMat);rim.scale.set(1.03,.055,1.03);rim.position.y=y;group.add(rim);
     }
     const fire:THREE.Mesh[]=[];
     for(let i=0;i<3;i++){
       const f=new THREE.Mesh(this.flame,this.flameMats[i]);
       f.position.set(Math.sin(i*2)*.13,1.13+i*.07,Math.cos(i*2)*.13);
       f.scale.set(.74-i*.1,.72-i*.11,.74-i*.1);
       group.add(f);fire.push(f);
     }
     const glow=new THREE.Mesh(this.glowGeo,this.glowMat);
     glow.rotation.x=-Math.PI/2;glow.position.y=.04;group.add(glow);
     this.root.add(group);
     this.sites.push({group,fire,glow,pos:group.position,phase:index*1.91});
   }
   this.smokeGeom.setAttribute('position',new THREE.BufferAttribute(this.smokePositions,3).setUsage(THREE.DynamicDrawUsage));
   this.smoke=new THREE.Points(this.smokeGeom,this.smokeMat);this.smoke.frustumCulled=false;this.root.add(this.smoke);
   this.tracerGeom.setAttribute('position',new THREE.BufferAttribute(this.traceData,3).setUsage(THREE.DynamicDrawUsage));
   this.traces=new THREE.LineSegments(this.tracerGeom,this.tracerMaterial);
   this.traces.frustumCulled=false;this.traces.renderOrder=2;this.root.add(this.traces);
   for(const lamp of this.lights) {lamp.castShadow=false;this.root.add(lamp);}
 }
 reset(){this.nextBattle=this.clock+12;this.streaks=[];this.battleBurst=0;}
 update(dt:number,player:THREE.Vector3){
   if(this.destroyed)return;
   const t=getTuning();this.clock+=dt;
   const count=Math.min(this.sites.length,Math.round(t.warFireCount));
   let closest:{pos:THREE.Vector3;distance:number}[]=[];
   for(let i=0;i<this.sites.length;i++){
     const site=this.sites[i],distance=site.pos.distanceToSquared(player);
     const visible=i<count&&distance<105*105;
     site.group.visible=visible;
     if(!visible)continue;
     const flicker=.83+.12*Math.sin(this.clock*9.7+site.phase)+.05*Math.sin(this.clock*22.3+site.phase*2);
     for(let j=0;j<site.fire.length;j++){
       const f=site.fire[j],bob=Math.sin(this.clock*(5+j)+site.phase)*.10;
       f.scale.y=(.62-j*.10)*(1+bob)*t.warFlameScale;
       f.rotation.z=Math.sin(this.clock*3+j+site.phase)*.15;
       f.position.y=1.1+j*.12+bob*.12;
     }
     site.glow.scale.setScalar(t.warFlameScale*flicker);
     if(distance<33*33)closest.push({pos:site.pos,distance});
   }
   // Reuse existing HubSide streetlamp bulbs. No added geometry or shadows.
   // Change ONLY a few bulbs, irregularly, and avoid a full scene traversal.
   if(this.clock-this.lastLampTick>.14){
     this.lastLampTick=this.clock;
     for(const chunk of this.world.scene.children){
       const lamps=chunk.userData.lampAnchors as
         {position:THREE.Vector3;bulbMaterial:THREE.MeshStandardMaterial}[]|undefined;
       if(!lamps)continue;
       for(const lamp of lamps){
         if(lamp.position.distanceToSquared(player)>42*42)continue;
         const seed=Math.abs(Math.sin(lamp.position.x*12.9898+lamp.position.z*78.233));
         if(seed<t.warStreetFlicker*.15){
           const pattern=Math.sin(this.clock*(11+seed*12)+seed*37);
           lamp.bulbMaterial.emissiveIntensity=pattern>.35?2.5:.04;
         }
       }
     }
   }
   closest.sort((a,b)=>a.distance-b.distance);
   if(closest.length && this.clock>=this.nextFirePop && t.warFireSoundVolume>.01){
     this.nextFirePop=this.clock+1.2+Math.random()*2.8;
     // A tiny verified CC0 crackle beside an actual nearby fire, not an arcade chime.
     this.onSound('firePop',closest[0].pos.clone().add(new THREE.Vector3(0,1,0)));
   }
   for(let i=0;i<this.lights.length;i++){
     const light=this.lights[i],near=closest[i];
     light.intensity=near?t.warFireLight*(.84+.13*Math.sin(this.clock*12+i*1.7)):0;
     if(near)light.position.copy(near.pos).add(new THREE.Vector3(0,1.55,0));
   }
   // Reuse the same 88 world-space vertices. Smoke rises without allocations.
   let cursor=0;
   for(let i=0;i<8;i++){
     const site=this.sites[i];
     for(let j=0;j<11;j++){
       const base=cursor++*3;
       if(!site||i>=count||site.pos.distanceToSquared(player)>58*58){
         this.smokePositions[base+1]=-999;continue;
       }
       const phase=((this.clock*.28+j/11+i*.11)%1),spread=phase*.6;
       this.smokePositions[base]=site.pos.x+Math.sin(j*4.93+i+this.clock*.4)*spread;
       this.smokePositions[base+1]=site.pos.y+1.8+phase*4.5;
       this.smokePositions[base+2]=site.pos.z+Math.cos(j*3.77+i)*spread;
     }
   }
   (this.smokeGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
   this.smokeMat.opacity=t.warSmokeOpacity;
   // Nearby ambient combat only. It is NOT player combat and never changes health.
   if(t.warEventsEnabled>.5){
     if(this.clock>=this.nextBattle&&this.battleBurst===0){
       this.battleBurst=3+Math.floor(Math.random()*4);
       this.shotTimer=this.clock;
       this.nextBattle=this.clock+Math.max(5,t.warBattleInterval)*(.75+Math.random()*.5);
     }
     if(this.battleBurst>0&&this.clock>=this.shotTimer){
       this.battleBurst--;this.shotTimer=this.clock+.12+Math.random()*.2;
       const picked=BATTLES[Math.floor(Math.random()*BATTLES.length)];
       const from=new THREE.Vector3(picked[0],12+Math.random()*3,picked[1]);
       const end=new THREE.Vector3(picked[2],9+Math.random()*3,picked[3]);
       const len=end.distanceTo(from);
       const travel=.22+Math.random()*.4;
       const mid=from.clone().lerp(end,travel);
       const tip=from.clone().lerp(end,Math.min(.97,travel+Math.min(3,len*.12)/len));
       this.streaks.push({start:mid,end:tip,age:.20+Math.random()*.11});
       if(t.warAmbienceVolume>.01)this.onSound('warShot',mid);
       if(this.battleBurst===0 && Math.random()<.22 && t.warAmbienceVolume>.01)
         this.onSound('warBoom',end);
     }
   }
   this.streaks=this.streaks.filter(s=>{s.age-=dt;return s.age>0;}).slice(-8);
   this.traceData.fill(0);
   for(let i=0;i<8;i++){
     const s=this.streaks[i],offset=i*6;
     if(s){
       s.start.toArray(this.traceData,offset);
       s.end.toArray(this.traceData,offset+3);
     }else{
       this.traceData[offset+1]=-999;this.traceData[offset+4]=-999;
     }
   }
   (this.tracerGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
   this.tracerMaterial.opacity=Math.max(0,Math.min(.9,t.warTracerBrightness));
 }
 dispose(){
   this.destroyed=true;this.root.removeFromParent();
   this.barrel.dispose();this.flame.dispose();this.glowGeo.dispose();this.smokeGeom.dispose();this.tracerGeom.dispose();
   this.barrelMat.dispose();this.stripeMat.dispose();this.glowMat.dispose();this.smokeMat.dispose();this.tracerMaterial.dispose();
   for(const mat of this.flameMats)mat.dispose();
 }
}
