import * as THREE from 'three';
import type { WorldEngine } from '@/game/worldTypes';
import { getGroundHeight } from '@/game/worldMovement';
import { wallDistance } from './combat';
import { freeAt } from './navigation';
import { getTuning } from './tuning';

type Site={group:THREE.Group;flames:THREE.Mesh[];glow:THREE.Mesh;position:THREE.Vector3;phase:number};
export type BattlePath={origin:THREE.Vector3;destination:THREE.Vector3};
type Projectile={from:THREE.Vector3;to:THREE.Vector3;elapsed:number;flight:number};
type Burst={path:BattlePath;remaining:number;nextShot:number;explode:boolean;impactAt:number};
const SITES:[number,number][]=[[-34,12],[30,28],[-19,-29],[34,-20],[-55,30],[48,40],[-13,51],[8,-46]];
const BATTLES:[number,number,number,number][]=[
 [-53,-53,-24,-52],[-25,-18,23,-17],[24,16,57,14],
 [-51,30,-25,29],[-15,57,15,57],[42,-52,55,-22]
];
const MAX_TRACERS=8;
function radialMask(inner='#ffffff',outer='#ffffff'){
 const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
 const ctx=canvas.getContext('2d')!;
 const gradient=ctx.createRadialGradient(32,32,2,32,32,32);
 gradient.addColorStop(0,inner);gradient.addColorStop(.30,inner);
 gradient.addColorStop(1,outer);
 ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;return tex;
}
function makeFlame(){
 // A jagged tapered silhouette, not a translucent geometric cone.
 const outline=new THREE.Shape();
 outline.moveTo(-.31,0);outline.lineTo(-.39,.24);
 outline.lineTo(-.19,.40);outline.lineTo(-.29,.53);
 outline.lineTo(-.06,.64);outline.lineTo(-.12,.80);
 outline.lineTo(.055,1.1);outline.lineTo(.15,.76);
 outline.lineTo(.24,.65);outline.lineTo(.15,.46);
 outline.lineTo(.34,.32);outline.lineTo(.27,.18);
 outline.lineTo(.31,0);outline.closePath();
 return new THREE.ShapeGeometry(outline);
}
function tracerMask(){
 const c=document.createElement('canvas');c.width=64;c.height=8;
 const context=c.getContext('2d')!;
 const g=context.createLinearGradient(0,0,64,0);
 g.addColorStop(0,'rgba(255,185,60,0)');
 g.addColorStop(.52,'rgba(255,188,70,.5)');
 g.addColorStop(.85,'rgba(255,234,145,.95)');
 g.addColorStop(1,'rgba(255,254,219,1)');
 context.fillStyle=g;context.fillRect(0,0,64,8);
 const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;
 tex.minFilter=THREE.LinearFilter;tex.magFilter=THREE.LinearFilter;
 return tex;
}
/** Environmental battle events: one origin per burst; not gameplay projectiles. */
export function tracerPose(shot:Projectile,dt:number) {
 shot.elapsed+=dt;
 const progress=Math.min(1,shot.elapsed/shot.flight);
 const tip=shot.from.clone().lerp(shot.to,progress);
 const span=shot.from.distanceTo(shot.to);
 const tail=shot.from.clone().lerp(shot.to,Math.max(0,progress-3.5/Math.max(1,span)));
 const fade=Math.min(1,Math.max(0,(shot.flight+.16-shot.elapsed)/.16));
 return {tail,tip,fade,done:shot.elapsed>=shot.flight+.16};
}
export function validBattleLine(path:BattlePath,colliders:WorldEngine['colliders']){
 const direction=path.destination.clone().sub(path.origin);
 const length=direction.length();if(length<3)return false;
 return wallDistance(new THREE.Ray(path.origin,direction.divideScalar(length)),colliders)>length-.2;
}
/** Optional, bounded-cost atmosphere isolated from player combat/HubSide world. */
export class WarzoneAtmosphere {
 private readonly root=new THREE.Group();
 private sites:Site[]=[];
 private readonly shell=new THREE.CylinderGeometry(.38,.39,.85,10,1,true);
 private readonly base=new THREE.CircleGeometry(.38,12);
 private readonly ring=new THREE.TorusGeometry(.385,.053,5,12);
 private readonly coal=new THREE.CircleGeometry(.33,12);
 private readonly scrapGeo=new THREE.BoxGeometry(.45,.14,.20);
 private readonly flameGeo=makeFlame();
 private readonly metal=new THREE.MeshStandardMaterial({color:0x42372f,metalness:.18,roughness:.94,side:THREE.DoubleSide});
 private readonly rimMat=new THREE.MeshStandardMaterial({color:0x281f1b,metalness:.22,roughness:.96});
 private readonly coalMat=new THREE.MeshBasicMaterial({color:0xa8320a,toneMapped:false,side:THREE.DoubleSide});
 private readonly flames=[
  new THREE.MeshBasicMaterial({color:0xe64911,side:THREE.DoubleSide,depthTest:true,depthWrite:true,toneMapped:false}),
  new THREE.MeshBasicMaterial({color:0xff9a20,side:THREE.DoubleSide,depthTest:true,depthWrite:true,toneMapped:false}),
  new THREE.MeshBasicMaterial({color:0xffce57,side:THREE.DoubleSide,depthTest:true,depthWrite:true,toneMapped:false})
 ];
 private readonly smokeTexture=radialMask('rgba(58,54,51,.7)','rgba(58,54,51,0)');
 private readonly glowTexture=radialMask('rgba(255,117,24,.55)','rgba(255,91,12,0)');
 private readonly flashTexture=radialMask('rgba(255,252,189,.98)','rgba(255,97,9,0)');
 private readonly tracerTexture=tracerMask();
 private readonly smokePositions=new Float32Array(8*11*3);
 private readonly smokeGeom=new THREE.BufferGeometry();
 private readonly smokeMat=new THREE.PointsMaterial({color:0xb4aca2,map:this.smokeTexture,transparent:true,
   opacity:.30,alphaTest:.01,depthWrite:false,depthTest:true,size:2.0,sizeAttenuation:true});
 private readonly smoke:THREE.Points;
 private readonly glowGeo=new THREE.PlaneGeometry(4.8,4.8);
 private readonly glowMat=new THREE.MeshBasicMaterial({color:0xffa44d,map:this.glowTexture,transparent:true,
   opacity:.4,depthWrite:false,depthTest:true,polygonOffset:true,polygonOffsetFactor:-1});
 private readonly scorchMat=new THREE.MeshBasicMaterial({color:0x2a1714,map:this.glowTexture,transparent:true,
   opacity:.20,depthWrite:false,depthTest:true,side:THREE.DoubleSide});
 private readonly fireLights=[new THREE.PointLight(0xff7434,0,14),new THREE.PointLight(0xff7434,0,14)];
 private readonly trailPositions=new Float32Array(MAX_TRACERS*4*3);
 private readonly trailColours=new Float32Array(MAX_TRACERS*4*3);
 private readonly trailGeom=new THREE.BufferGeometry();
 private readonly trailMat=new THREE.MeshBasicMaterial({map:this.tracerTexture,vertexColors:true,
   color:0xffffff,transparent:true,blending:THREE.AdditiveBlending,
   depthTest:true,depthWrite:false,fog:false,toneMapped:false,side:THREE.DoubleSide});
 private readonly trails:THREE.Mesh;
 private readonly muzzle=new THREE.Sprite(new THREE.SpriteMaterial({map:this.flashTexture,color:0xfff4aa,
   depthTest:true,depthWrite:false,transparent:true,fog:false,toneMapped:false}));
 private readonly explosion=new THREE.Sprite(new THREE.SpriteMaterial({map:this.flashTexture,color:0xff8b3e,
   depthTest:true,depthWrite:false,transparent:true,fog:false,toneMapped:false}));
 private readonly explosionLight=new THREE.PointLight(0xff7934,0,32);
 private projectiles:Projectile[]=[];
 private burst:Burst|null=null;
 private clock=0;
 private nextBattle=12;
 private nextFirePop=2;
 private flashAge=0;
 private explosionAge=0;
 private destroyed=false;
 constructor(private world:WorldEngine,private play:(name:'warShot'|'warBoom'|'firePop',pos:THREE.Vector3)=>void) {
  this.root.name='dead-city-warzone-atmosphere';world.scene.add(this.root);
  for(let i=0;i<SITES.length;i++){
   const [x,z]=SITES[i];
   if(!freeAt(x,z,world.colliders,1.3))continue;
   const group=new THREE.Group();
   group.position.set(x,getGroundHeight(world,x,z),z);
   const scorch=new THREE.Mesh(this.glowGeo,this.scorchMat);
   scorch.rotation.x=-Math.PI/2;scorch.position.y=.018;group.add(scorch);
   const glow=new THREE.Mesh(this.glowGeo,this.glowMat);
   glow.rotation.x=-Math.PI/2;glow.position.y=.029;glow.renderOrder=0;group.add(glow);
   const barrel=new THREE.Mesh(this.shell,this.metal);
   barrel.position.y=.46;group.add(barrel);
   const bottom=new THREE.Mesh(this.base,this.rimMat);
   bottom.rotation.x=-Math.PI/2;bottom.position.y=.039;group.add(bottom);
   const mouth=new THREE.Mesh(this.coal,this.coalMat);
   mouth.rotation.x=-Math.PI/2;mouth.position.y=.832;group.add(mouth);
   const torus=new THREE.Mesh(this.ring,this.rimMat);torus.rotation.x=Math.PI/2;torus.position.y=.86;group.add(torus);
   for(let j=0;j<3;j++){
    const scrap=new THREE.Mesh(this.scrapGeo,this.metal);
    const angle=j*2.4+i*.47;
    scrap.position.set(Math.cos(angle)*(1.05+.15*j),.1,Math.sin(angle)*(1.05+.15*j));
    scrap.rotation.y=angle;group.add(scrap);
   }
   const flames:THREE.Mesh[]=[];
   for(let j=0;j<3;j++){
    const flame=new THREE.Mesh(this.flameGeo,this.flames[j]);
    flame.position.set((j-1)*.12,.89,0);flame.rotation.y=j*Math.PI/3;
    flame.scale.set(1-j*.2,1.05-j*.16,1);
    flames.push(flame);group.add(flame);
   }
   this.root.add(group);
   this.sites.push({group,flames,glow,position:group.position,phase:i*1.93});
  }
  this.smokeGeom.setAttribute('position',new THREE.BufferAttribute(this.smokePositions,3).setUsage(THREE.DynamicDrawUsage));
  this.smoke=new THREE.Points(this.smokeGeom,this.smokeMat);this.smoke.frustumCulled=false;this.root.add(this.smoke);
  this.trailGeom.setAttribute('position',new THREE.BufferAttribute(this.trailPositions,3).setUsage(THREE.DynamicDrawUsage));
  this.trailGeom.setAttribute('color',new THREE.BufferAttribute(this.trailColours,3).setUsage(THREE.DynamicDrawUsage));
  const uvs=new Float32Array(MAX_TRACERS*8),indices:number[]=[];
  for(let i=0;i<MAX_TRACERS;i++){
   const j=i*8;uvs.set([0,0,0,1,1,0,1,1],j);
   const p=i*4;indices.push(p,p+1,p+2,p+2,p+1,p+3);
  }
  this.trailGeom.setAttribute('uv',new THREE.BufferAttribute(uvs,2));this.trailGeom.setIndex(indices);
  this.trails=new THREE.Mesh(this.trailGeom,this.trailMat);
  this.trails.frustumCulled=false;this.trails.visible=false;this.trails.renderOrder=4;
  this.root.add(this.trails);
  this.muzzle.visible=false;this.explosion.visible=false;
  this.explosionLight.visible=false;this.explosionLight.castShadow=false;
  this.root.add(this.muzzle,this.explosion,this.explosionLight);
  for(const light of this.fireLights){light.castShadow=false;light.visible=false;this.root.add(light);}
 }
 private pickBattle():BattlePath|null {
  const start=Math.floor(Math.random()*BATTLES.length);
  for(let i=0;i<BATTLES.length;i++){
   const row=BATTLES[(start+i)%BATTLES.length];
   const roofHeight=(x:number,z:number)=>{
    let h=0;
    for(const c of this.world.colliders)
      if(x>c.minX-.5&&x<c.maxX+.5&&z>c.minZ-.5&&z<c.maxZ+.5&&c.maxY>h)h=c.maxY;
    return THREE.MathUtils.clamp(h+.9,9,21);
   };
   const path={origin:new THREE.Vector3(row[0],roofHeight(row[0],row[1]),row[1]),
    destination:new THREE.Vector3(row[2],roofHeight(row[2],row[3]),row[3])};
   if(validBattleLine(path,this.world.colliders))return path;
  }
  return null;
 }
 reset(){
  this.burst=null;this.projectiles.length=0;this.nextBattle=this.clock+12;
  this.flashAge=0;this.explosionAge=0;
  this.muzzle.visible=false;this.explosion.visible=false;this.explosionLight.visible=false;
  this.trails.visible=false;for(const l of this.fireLights){l.visible=false;l.intensity=0;}
 }
 update(dt:number,player:THREE.Vector3,camera?:THREE.Camera){
  if(this.destroyed)return;
  const t=getTuning();this.clock+=dt;
  if(t.warEventsEnabled<.5){
   this.burst=null;this.projectiles.length=0;this.flashAge=0;this.explosionAge=0;
   this.muzzle.visible=false;this.explosion.visible=false;this.explosionLight.visible=false;
  }
  const count=Math.min(this.sites.length,Math.round(t.warFireCount));
  const nearest:{site:Site;distance:number}[]=[];
  for(let i=0;i<this.sites.length;i++){
   const site=this.sites[i],distSq=site.position.distanceToSquared(player);
   const show=i<count&&distSq<105*105;
   site.group.visible=show;
   if(!show)continue;
   const pulse=.85+.1*Math.sin(this.clock*9+site.phase)+.05*Math.cos(this.clock*14+site.phase);
   for(let j=0;j<site.flames.length;j++){
    const flame=site.flames[j];
    flame.rotation.z=Math.sin(this.clock*(3.3+j*.6)+site.phase)*.13;
    flame.scale.set((1-j*.2)*t.warFlameScale,(1.05-j*.16)*t.warFlameScale*pulse,1);
   }
   site.glow.scale.setScalar(t.warFlameScale*pulse);
   if(distSq<35*35)nearest.push({site,distance:distSq});
  }
  // CityAtmosphere owns Map2's instanced street bulbs and pool lighting.
  const flicker=this.world.scene.userData.deadCityFlickerTick as
    ((elapsed:number,strength:number)=>void)|undefined;
  this.world.scene.userData.deadCityFlickerStrength=t.warStreetFlicker;
  flicker?.(performance.now()/1000,t.warStreetFlicker);
  nearest.sort((a,b)=>a.distance-b.distance);
  for(let i=0;i<this.fireLights.length;i++){
   const light=this.fireLights[i],near=nearest[i];
   light.visible=!!near&&t.warFireLight>0;
   light.intensity=light.visible?t.warFireLight*(.88+.12*Math.sin(this.clock*11+i*4)):0;
   if(near)light.position.copy(near.site.position).add(new THREE.Vector3(0,1.45,0));
  }
  if(nearest.length&&this.clock>this.nextFirePop&&t.warFireSoundVolume>0){
   this.nextFirePop=this.clock+1.5+Math.random()*3;
   this.play('firePop',nearest[0].site.position.clone().add(new THREE.Vector3(0,1,0)));
  }
  let n=0;
  for(let i=0;i<8;i++)for(let j=0;j<11;j++){
   const s=this.sites[i],k=n++*3;
   if(!s||i>=count||s.position.distanceToSquared(player)>60*60){
    this.smokePositions[k]=0;this.smokePositions[k+1]=-10000;this.smokePositions[k+2]=0;continue;
   }
   const life=(this.clock*.25+j/11+i*.19)%1;
   const scatter=life*.78;
   this.smokePositions[k]=s.position.x+Math.sin(i*3.2+j*2.9)*scatter;
   this.smokePositions[k+1]=s.position.y+1.6+life*4.2;
   this.smokePositions[k+2]=s.position.z+Math.cos(j*3.4+i*1.7)*scatter;
  }
  (this.smokeGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
  this.smoke.visible=count>0&&t.warSmokeOpacity>.01;
  this.smokeMat.opacity=t.warSmokeOpacity;
  if(t.warEventsEnabled>.5&&this.clock>=this.nextBattle&&!this.burst){
   const path=this.pickBattle();
   this.nextBattle=this.clock+Math.max(5,t.warBattleInterval)*(.80+Math.random()*.5);
   if(path)this.burst={path,remaining:3+Math.floor(Math.random()*4),nextShot:this.clock,
     impactAt:0,explode:Math.random()<.24};
  }
  if(this.burst&&this.clock>=this.burst.nextShot&&this.burst.remaining>0){
   const battle=this.burst;battle.remaining--;
   battle.nextShot=this.clock+.12+Math.random()*.06;
   const target=battle.path.destination.clone().add(new THREE.Vector3(
     (Math.random()-.5)*1.1,(Math.random()-.5)*.6,(Math.random()-.5)*1.1));
   const flight=.22+.16*Math.random();
   this.projectiles.push({from:battle.path.origin.clone(),to:target,elapsed:0,flight});
   this.muzzle.position.copy(battle.path.origin);this.flashAge=.09;this.muzzle.visible=true;
   this.play('warShot',battle.path.origin);
   if(battle.remaining===0)battle.impactAt=this.clock+flight;
  }
  if(this.burst&&this.burst.remaining===0&&this.clock>=this.burst.impactAt){
   if(this.burst.explode){
    const at=this.burst.path.destination;
    this.explosion.position.copy(at);this.explosionLight.position.copy(at);
    this.explosionAge=.58;this.explosion.visible=true;this.explosionLight.visible=true;
    this.play('warBoom',at);
   }
   this.burst=null;
  }
  if(this.flashAge>0){
   this.flashAge=Math.max(0,this.flashAge-dt);
   this.muzzle.visible=this.flashAge>0;
   (this.muzzle.material as THREE.SpriteMaterial).opacity=this.flashAge/.09;
   this.muzzle.scale.setScalar(2.3*this.flashAge/.09);
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
   const projectile=this.projectiles[i];
   if(!projectile){for(let j=0;j<4;j++)this.trailPositions[i*12+j*3+1]=-10000;continue;}
   const {tail,tip,fade}=tracerPose(projectile,dt);
   const along=tip.clone().sub(tail);
   const sight=tip.clone().sub(camera?.position??player);
   let sideways=along.clone().cross(sight).normalize();
   if(sideways.lengthSq()<.1)sideways.set(0,1,0);
   const width=THREE.MathUtils.clamp(sight.length()*.0028,.075,.25);
   sideways.multiplyScalar(width);
   const corners=[tail.clone().add(sideways),tail.clone().sub(sideways),
     tip.clone().add(sideways),tip.clone().sub(sideways)];
   for(let j=0;j<4;j++){
    corners[j].toArray(this.trailPositions,i*12+j*3);
    const brightness=t.warTracerBrightness*fade*(j<2?.42:1);
    this.trailColours.set([brightness,brightness,brightness],i*12+j*3);
   }
  }
  (this.trailGeom.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true;
  (this.trailGeom.getAttribute('color') as THREE.BufferAttribute).needsUpdate=true;
  this.trails.visible=this.projectiles.length>0 && t.warTracerBrightness>.01;
 }
 dispose(){
  this.destroyed=true;
  this.world.scene.userData.deadCityFlickerTick &&
    (this.world.scene.userData.deadCityFlickerTick as (t:number,s:number)=>void)(this.clock,0);
  this.root.removeFromParent();
  for(const geometry of [this.shell,this.base,this.ring,this.coal,this.scrapGeo,this.flameGeo,
    this.glowGeo,this.smokeGeom,this.trailGeom])geometry.dispose();
  for(const material of [this.metal,this.rimMat,this.coalMat,...this.flames,this.smokeMat,
    this.glowMat,this.scorchMat,this.trailMat,
    this.muzzle.material as THREE.Material,this.explosion.material as THREE.Material])material.dispose();
  for(const texture of [this.smokeTexture,this.glowTexture,this.flashTexture,this.tracerTexture])texture.dispose();
 }
}
