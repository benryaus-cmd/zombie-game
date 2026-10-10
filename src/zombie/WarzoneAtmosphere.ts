import * as THREE from 'three';
import type { WorldEngine } from '@/game/worldTypes';
import { wallDistance } from './combat';
import { getTuning } from './tuning';

export type BattlePath={origin:THREE.Vector3;destination:THREE.Vector3};
export type Projectile={from:THREE.Vector3;to:THREE.Vector3;elapsed:number;flight:number};
type Burst={path:BattlePath;groups:number[];group:number;remaining:number;nextShot:number;explode:boolean;impactAt:number};
const MAX_TRACERS=12;
function radialMask(){
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
 const ctx=canvas.getContext('2d')!;
 const radial=ctx.createRadialGradient(32,32,2,32,32,32);
 radial.addColorStop(0,'rgba(255,255,240,1)');radial.addColorStop(.25,'rgba(255,179,68,.75)');
 radial.addColorStop(1,'rgba(255,70,12,0)');
 ctx.fillStyle=radial;ctx.fillRect(0,0,64,64);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
function tracerMask(){
 const c=document.createElement('canvas');c.width=64;c.height=8;
 const ctx=c.getContext('2d')!,g=ctx.createLinearGradient(0,0,64,0);
 g.addColorStop(0,'rgba(255,157,33,0)');g.addColorStop(.6,'rgba(255,189,77,.55)');
 g.addColorStop(.9,'rgba(255,241,169,.98)');g.addColorStop(1,'rgba(255,255,239,1)');
 ctx.fillStyle=g;ctx.fillRect(0,0,64,8);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return tex;
}
export function tracerPose(shot:Projectile,dt:number){
 shot.elapsed+=dt;
 const progress=Math.min(1,shot.elapsed/Math.max(.01,shot.flight));
 const tip=shot.from.clone().lerp(shot.to,progress);
 const span=shot.from.distanceTo(shot.to);
 const tail=shot.from.clone().lerp(shot.to,Math.max(0,progress-3.5/Math.max(1,span)));
 const fade=Math.max(0,Math.min(1,(shot.flight+.16-shot.elapsed)/.16));
 return {tail,tip,fade,done:shot.elapsed>=shot.flight+.16};
}
export function validBattleLine(path:BattlePath,colliders:WorldEngine['colliders']){
 const d=path.destination.clone().sub(path.origin),length=d.length();
 return length>=3&&wallDistance(new THREE.Ray(path.origin,d.divideScalar(length)),colliders)>length-.2;
}
/** A distant battle should travel TOWARD the playable neighbourhood, not away. */
export function battlePointsTowardMap(path:BattlePath,center:THREE.Vector3){
 const from=path.origin.clone().sub(center),to=path.destination.clone().sub(center);
 const sourceMapDistance=path.origin.x**2+path.origin.z**2;
 const targetMapDistance=path.destination.x**2+path.destination.z**2;
 return to.lengthSq()<from.lengthSq() && to.lengthSq()>12*12 &&
   targetMapDistance<sourceMapDistance;
}
/** A single volley: 4–9 rounds. A double volley: two 3–5 bursts. */
export function chooseBurstGroups(double:boolean,random=()=>Math.random()):number[]{
 return double?[3+Math.floor(random()*3),3+Math.floor(random()*3)]:
   [4+Math.floor(random()*6)];
}
/** Decorative distant fighting only. No damage, no colliders, no fire barrels. */
export class WarzoneAtmosphere {
 private root=new THREE.Group();
 private readonly flashTexture=radialMask();
 private readonly trailTexture=tracerMask();
 private readonly muzzle=new THREE.Sprite(new THREE.SpriteMaterial({map:this.flashTexture,
  color:0xffe3a2,transparent:true,depthTest:true,depthWrite:false,fog:false,toneMapped:false}));
 private readonly explosion=new THREE.Sprite(new THREE.SpriteMaterial({map:this.flashTexture,
  color:0xff9a40,transparent:true,depthTest:true,depthWrite:false,fog:false,toneMapped:false}));
 private readonly explosionLight=new THREE.PointLight(0xff7934,0,32);
 private readonly trailPositions=new Float32Array(MAX_TRACERS*12);
 private readonly trailColours=new Float32Array(MAX_TRACERS*12);
 private readonly trailGeom=new THREE.BufferGeometry();
 private readonly trailMat=new THREE.MeshBasicMaterial({map:this.trailTexture,vertexColors:true,
  color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,
  depthTest:true,depthWrite:false,fog:false,toneMapped:false,side:THREE.DoubleSide});
 private readonly trails:THREE.Mesh;
 private projectiles:Projectile[]=[];
 private burst:Burst|null=null;
 private clock=0;
 private nextBattle=10;
 private flashAge=0;
 private explosionAge=0;
 private destroyed=false;
 constructor(private world:WorldEngine,private play:(name:'warShot'|'warBoom'|'firePop',pos:THREE.Vector3)=>void){
  this.root.name='dead-city-rooftop-combat';world.scene.add(this.root);
  this.trailGeom.setAttribute('position',new THREE.BufferAttribute(this.trailPositions,3).setUsage(THREE.DynamicDrawUsage));
  this.trailGeom.setAttribute('color',new THREE.BufferAttribute(this.trailColours,3).setUsage(THREE.DynamicDrawUsage));
  const uv=new Float32Array(MAX_TRACERS*8),indices:number[]=[];
  for(let i=0;i<MAX_TRACERS;i++){
   uv.set([0,0,0,1,1,0,1,1],i*8);
   const p=i*4;indices.push(p,p+1,p+2,p+2,p+1,p+3);
  }
  this.trailGeom.setAttribute('uv',new THREE.BufferAttribute(uv,2));this.trailGeom.setIndex(indices);
  this.trails=new THREE.Mesh(this.trailGeom,this.trailMat);
  this.trails.frustumCulled=false;this.trails.visible=false;this.trails.renderOrder=4;
  this.muzzle.visible=false;this.explosion.visible=false;
  this.explosionLight.visible=false;this.explosionLight.castShadow=false;
  this.root.add(this.trails,this.muzzle,this.explosion,this.explosionLight);
 }
 /** Generate dozens of possible origins around the current neighbourhood.
  * Includes positions outside the map: these are VISUAL distant gun emplacements,
  * not physical player/zombie spawn sites. Prefer inward vectors and validate occlusion. */
 private pickBattle(player:THREE.Vector3):BattlePath|null{
  const t=getTuning();
  for(let attempt=0;attempt<48;attempt++){
   const angle=Math.random()*Math.PI*2;
   const far=t.warOriginMinDistance+Math.random()*
     Math.max(1,t.warOriginMaxDistance-t.warOriginMinDistance);
   const outward=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
   const origin=player.clone().addScaledVector(outward,far);
   const targetDistance=20+Math.random()*Math.min(45,Math.max(15,far-18));
   const aimAngle=angle+Math.PI+(Math.random()-.5)*1.0;
   const destination=player.clone().add(new THREE.Vector3(
    Math.cos(aimAngle)*targetDistance,0,Math.sin(aimAngle)*targetDistance));
   // Keep the target over the playable map, not outside its perimeter.
   destination.x=THREE.MathUtils.clamp(destination.x,-53,53);
   destination.z=THREE.MathUtils.clamp(destination.z,-53,53);
   const height=(x:number,z:number,fallback:number)=>{
    let roof=fallback;
    for(const c of this.world.colliders){
     if(x>=c.minX-.6&&x<=c.maxX+.6&&z>=c.minZ-.6&&z<=c.maxZ+.6)
      roof=Math.max(roof,c.maxY+.9);
    }
    return Math.max(9,Math.min(30,roof));
   };
   origin.y=height(origin.x,origin.z,12+Math.random()*8);
   destination.y=height(destination.x,destination.z,10+Math.random()*6);
   const path={origin,destination};
   if(battlePointsTowardMap(path,player)&&validBattleLine(path,this.world.colliders))return path;
  }
  return null;
 }
 reset(){
  this.burst=null;this.projectiles.length=0;this.nextBattle=this.clock+9;
  this.flashAge=0;this.explosionAge=0;
  this.muzzle.visible=false;this.explosion.visible=false;this.explosionLight.visible=false;
  this.trails.visible=false;
 }
 update(dt:number,player:THREE.Vector3,camera?:THREE.Camera){
  if(this.destroyed)return;
  const t=getTuning();this.clock+=dt;
  // Streetlight blink is driven by the authoritative Map2 instanced light owner.
  this.world.scene.userData.deadCityFlickerStrength=t.warStreetFlicker;
  const tick=this.world.scene.userData.deadCityFlickerTick as
   ((time:number,config:unknown)=>void)|undefined;
  tick?.(performance.now()/1000,{
   strength:t.warStreetFlicker,idle:t.warLampIdle,rate:t.warLampRate,
   chance:t.warLampChance,duration:t.warLampDuration,peak:t.warLampPeak,
   onRange:t.warLampRange,colour:t.warLampWarmth
  });
  if(t.warEventsEnabled<.5){
   this.burst=null;this.projectiles.length=0;
   this.flashAge=0;this.explosionAge=0;
   this.muzzle.visible=false;this.explosion.visible=false;this.explosionLight.visible=false;this.trails.visible=false;
   return;
  }
  if(this.clock>=this.nextBattle&&!this.burst){
   const path=this.pickBattle(player);
   this.nextBattle=this.clock+Math.max(2,t.warBattleInterval)*(.8+Math.random()*.6);
   if(path){
    const double=Math.random()<t.warDoubleBurstChance;
    const groups=chooseBurstGroups(double);
    this.burst={path,groups,group:0,remaining:groups[0],nextShot:this.clock,
      impactAt:Infinity,explode:Math.random()<t.warExplosionChance};
   }
  }
  const b=this.burst;
  if(b&&this.clock>=b.nextShot&&b.remaining>0){
   b.remaining--;
   const target=b.path.destination.clone().add(new THREE.Vector3(
    (Math.random()-.5)*1.3,(Math.random()-.5)*.7,(Math.random()-.5)*1.3));
   const flight=.22+Math.random()*.18;
   this.projectiles.push({from:b.path.origin.clone(),to:target,elapsed:0,flight});
   this.muzzle.position.copy(b.path.origin);this.flashAge=.11;this.muzzle.visible=true;
   this.play('warShot',b.path.origin);
   if(b.remaining>0)b.nextShot=this.clock+.095+Math.random()*.085;
   else if(b.group+1<b.groups.length){
    b.group++;b.remaining=b.groups[b.group];b.nextShot=this.clock+t.warBurstGap;
   }else b.impactAt=this.clock+flight;
  }
  if(b&&b.impactAt!==Infinity&&this.clock>=b.impactAt){
   if(b.explode){
    this.explosion.position.copy(b.path.destination);
    this.explosionLight.position.copy(b.path.destination);
    this.explosionAge=.58;this.explosion.visible=true;this.explosionLight.visible=true;
    this.play('warBoom',b.path.destination);
   }
   this.burst=null;
  }
  if(this.flashAge>0){
   this.flashAge=Math.max(0,this.flashAge-dt);
   this.muzzle.visible=this.flashAge>0;
   (this.muzzle.material as THREE.SpriteMaterial).opacity=this.flashAge/.11;
   this.muzzle.scale.setScalar(2.2*this.flashAge/.11);
  }
  if(this.explosionAge>0){
   this.explosionAge=Math.max(0,this.explosionAge-dt);
   this.explosion.visible=this.explosionAge>0;
   (this.explosion.material as THREE.SpriteMaterial).opacity=this.explosionAge/.58;
   this.explosion.scale.setScalar(4.5+(1-this.explosionAge/.58)*6);
   this.explosionLight.intensity=t.warExplosionLight*20*(this.explosionAge/.58);
   this.explosionLight.visible=this.explosionAge>0&&t.warExplosionLight>0;
  }
  this.projectiles=this.projectiles.filter(p=>p.elapsed<p.flight+.16).slice(-MAX_TRACERS);
  this.trailPositions.fill(0);this.trailColours.fill(0);
  for(let i=0;i<MAX_TRACERS;i++){
   const shot=this.projectiles[i];
   if(!shot){for(let j=0;j<4;j++)this.trailPositions[i*12+j*3+1]=-10000;continue;}
   const {tail,tip,fade}=tracerPose(shot,dt);
   const direction=tip.clone().sub(tail),view=tip.clone().sub(camera?.position??player);
   let perpendicular=direction.clone().cross(view).normalize();
   if(perpendicular.lengthSq()<.01)perpendicular.set(0,1,0);
   perpendicular.multiplyScalar(THREE.MathUtils.clamp(view.length()*.003,.075,.36));
   const corners=[tail.clone().add(perpendicular),tail.clone().sub(perpendicular),
    tip.clone().add(perpendicular),tip.clone().sub(perpendicular)];
   for(let j=0;j<4;j++){
    corners[j].toArray(this.trailPositions,i*12+j*3);
    const strength=t.warTracerBrightness*fade*(j<2?.45:1);
    this.trailColours.set([strength,strength,strength],i*12+j*3);
   }
  }
  (this.trailGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
  (this.trailGeom.getAttribute('color') as THREE.BufferAttribute).needsUpdate=true;
  this.trails.visible=this.projectiles.length>0&&t.warTracerBrightness>0;
 }
 dispose(){
  this.destroyed=true;
  const tick=this.world.scene.userData.deadCityFlickerTick as ((time:number,config:unknown)=>void)|undefined;
  tick?.(performance.now()/1000,{strength:0,idle:1});
  delete this.world.scene.userData.deadCityFlickerStrength;
  this.root.removeFromParent();
  this.trailGeom.dispose();this.trailMat.dispose();
  (this.muzzle.material as THREE.Material).dispose();
  (this.explosion.material as THREE.Material).dispose();
  this.trailTexture.dispose();this.flashTexture.dispose();
 }
}
