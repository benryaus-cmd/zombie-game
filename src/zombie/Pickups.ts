import * as THREE from 'three';
import type { WorldEngine } from '@/game/worldTypes';
import { getGroundHeight } from '@/game/worldMovement';
import { freeAt, nearbyBuildings } from './navigation';
import { getTuning } from './tuning';
export type PickupType = 'rifle'|'shotgun'|'pistol'|'health';
export interface PickupPoint {x:number;z:number;kind:PickupType;}
interface Item extends PickupPoint {group:THREE.Group;spawned:number;phase:number;}
/** Tiny shared geometry pickup system, automatically collected and recycled. */
export class SupplyDrops {
 private items:Item[]=[];
 private clock=0;
 private group=new THREE.Group();
 private readonly box=new THREE.BoxGeometry(.56,.31,.4);
 private readonly crossHorizontal=new THREE.BoxGeometry(.29,.07,.035);
 private readonly crossVertical=new THREE.BoxGeometry(.07,.28,.035);
 private readonly medicalRed=new THREE.MeshBasicMaterial({color:0xd43a3a});
 private readonly materials={
  rifle:new THREE.MeshBasicMaterial({color:0xffcb58}),
  shotgun:new THREE.MeshBasicMaterial({color:0xff8b48}),
  pistol:new THREE.MeshBasicMaterial({color:0xe0bc62}),
  health:new THREE.MeshBasicMaterial({color:0xf2f5ef}),
 };
 private readonly line:THREE.Line;
 private readonly lineGeometry=new THREE.BufferGeometry();
 private readonly lineMaterial=new THREE.LineBasicMaterial({color:0xffd569,transparent:true,opacity:.12,depthWrite:false,depthTest:false});
 constructor(private world:WorldEngine,private give:(type:PickupType,amount:number)=>void) {
  const attr=new THREE.BufferAttribute(new Float32Array(6),3).setUsage(THREE.DynamicDrawUsage);
  this.lineGeometry.setAttribute('position',attr);
  this.line=new THREE.Line(this.lineGeometry,this.lineMaterial);
  this.line.frustumCulled=false;this.line.renderOrder=12;
  world.scene.add(this.group,this.line);
  for(let i=0;i<12;i++)this.spawn();
 }
 get positions():PickupPoint[] {return this.items.map(({x,z,kind})=>({x,z,kind}));}
 private removeItem(item:Item) {
   item.group.traverse(o=>{
     if(!(o instanceof THREE.Mesh))return;
     if(![this.box,this.crossHorizontal,this.crossVertical].includes(o.geometry as THREE.BoxGeometry))o.geometry.dispose();
     for(const material of Array.isArray(o.material)?o.material:[o.material]) {
       if(material!==this.medicalRed && !Object.values(this.materials).includes(material as THREE.MeshBasicMaterial))material.dispose();
     }
   });
   item.group.removeFromParent();
 }
 private spawn() {
  const player=this.world.playerPosition,building=nearbyBuildings(player.x,player.z,this.world.colliders,58);
  let x=0,z=0,valid=false;
  for(let tries=0;tries<80;tries++){
    const a=Math.random()*Math.PI*2,r=9+Math.random()*40;
    x=player.x+Math.cos(a)*r;z=player.z+Math.sin(a)*r;
    if(!freeAt(x,z,building,.8)||this.items.some(p=>Math.hypot(p.x-x,p.z-z)<5))continue;
    valid=true;break;
  }
  if(!valid)return;
  const rnd=Math.random(),kind:PickupType=rnd<.40?'rifle':rnd<.7?'shotgun':rnd<.84?'health':'pistol';
  const group=new THREE.Group(),cube=new THREE.Mesh(this.box,this.materials[kind]);
  group.add(cube);
  if(kind==='health'){
    // White supply case with a red medical cross; distinct from the yellow ammo crates.
    const crossH=new THREE.Mesh(this.crossHorizontal,this.medicalRed);
    const crossV=new THREE.Mesh(this.crossVertical,this.medicalRed);
    crossH.position.z=crossV.position.z=.222;
    group.add(crossH,crossV);
  }
  const stripe=new THREE.Mesh(new THREE.BoxGeometry(.5,.07,.44),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.65}));
  stripe.position.y=.11;group.add(stripe);
  const marker=new THREE.Mesh(new THREE.TorusGeometry(.39,.025,4,12),
    new THREE.MeshBasicMaterial({color:kind==='health'?0xffffff:0xffce5c,transparent:true,opacity:.5}));
  marker.rotation.x=Math.PI/2;marker.position.y=-.16;group.add(marker);
  group.position.set(x,getGroundHeight(this.world,x,z)+.62,z);
  this.group.add(group);
  this.items.push({x,z,kind,group,spawned:this.clock,phase:Math.random()*6.28});
 }
 update(dt:number) {
  this.clock+=dt;
  const px=this.world.playerPosition.x,pz=this.world.playerPosition.z;
  let nearest:Item|undefined,dmin=Infinity;
  for(let i=this.items.length-1;i>=0;i--){
    const item=this.items[i],d=Math.hypot(item.x-px,item.z-pz);
    if(d<1.7){
      this.give(item.kind,item.kind==='rifle'?36:item.kind==='shotgun'?12:item.kind==='pistol'?30:25);
      this.removeItem(item);this.items.splice(i,1);continue;
    }
    if(d>100 && this.clock-item.spawned>20){
      this.removeItem(item);this.items.splice(i,1);continue;
    }
    item.group.position.y=getGroundHeight(this.world,item.x,item.z)+.63+Math.sin(this.clock*2.2+item.phase)*.14;
    item.group.rotation.y+=dt*.65;
    if(d<dmin){dmin=d;nearest=item;}
  }
  if(this.items.length<getTuning().pickupCap && this.items.length<22 && this.clock%1<dt)this.spawnOne();
  const arr=this.lineGeometry.getAttribute('position') as THREE.BufferAttribute;
  this.line.visible=!!nearest;
  if(nearest) {
    const floor=getGroundHeight(this.world,px,pz);
    arr.setXYZ(0,px,floor+.11,pz);arr.setXYZ(1,nearest.x,getGroundHeight(this.world,nearest.x,nearest.z)+.26,nearest.z);
    arr.needsUpdate=true;
    this.lineMaterial.opacity=getTuning().pickupGuideOpacity*(.65+.35*Math.sin(this.clock*3));
  }
 }
 private spawnOne(){
  // A failed spawn attempt is rare; avoid spinning forever when a dense city surrounds the player.
  this.spawn();
 }
 clear() {for(const item of this.items)this.removeItem(item);this.items=[];for(let i=0;i<12;i++)this.spawn();}
 dispose() {
  for(const item of this.items)this.removeItem(item);
  this.items=[];this.group.removeFromParent();this.line.removeFromParent();
  this.box.dispose();this.crossHorizontal.dispose();this.crossVertical.dispose();this.medicalRed.dispose();for(const m of Object.values(this.materials))m.dispose();
  this.lineGeometry.dispose();this.lineMaterial.dispose();
 }
}
