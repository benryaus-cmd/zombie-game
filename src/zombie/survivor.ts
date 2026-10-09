import * as THREE from 'three';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { Model } from '@/game/assetPreview';
import type { Weapon } from './combat';
import { getTuning } from './tuning';
// Exact barrel basis obtained by comparing embedded vertices with standalone pack guns.
const BARREL_DIRECTION=new THREE.Vector3(.8660,.2376,.4380).normalize();
const WEAPON_NAMES=['Axe','Guitar','Knife','Pistol','Rifle','Shotgun','SMG','Spear','WoodenBat_Barbed','WoodenBat_Saw'];
export class ArmedSurvivor {
 readonly root:THREE.Group;
 readonly mixer:THREE.AnimationMixer;
 private actions=new Map<string,THREE.AnimationAction>();
 private action='';
 private gun:THREE.Object3D|null=null;
 private flash:THREE.Mesh;
 private muzzle=new THREE.Object3D();
 private recoil=0;
 private reloadElapsed=0;
 private flashAge=0;
 private torso:THREE.Object3D|undefined;
 constructor(model:Model,avatar:THREE.Group) {
  this.root=clone(model.scene) as THREE.Group;this.root.name='armed-survivor';
  // The authored trigger socket is Middle1.L. Mirror the complete rig so it is
  // right-handed, keeping its existing grip, skin and gun animation together.
  const body=this.root.getObjectByName('Matt')!;this.root.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(body), height=bounds.getSize(new THREE.Vector3()).y;
  this.root.scale.set(-1.9/height,1.9/height,1.9/height);
  this.root.updateMatrixWorld(true);const fitted=new THREE.Box3().setFromObject(body);
  this.root.position.y-=fitted.min.y;
  for(const child of avatar.children)child.visible=false;
  avatar.add(this.root);
  this.mixer=new THREE.AnimationMixer(this.root);
  for(const clip of model.animations)this.actions.set(clip.name,this.mixer.clipAction(clip));
  this.torso=this.root.getObjectByName('Torso');
  this.flash=new THREE.Mesh(new THREE.ConeGeometry(.075,.24,6),new THREE.MeshBasicMaterial({color:'#ffe5a1',toneMapped:false}));
  this.flash.rotation.x=Math.PI/2;this.flash.position.z=.08;this.flash.visible=false;this.muzzle.add(this.flash);
  this.equip('pistol');this.animate(0,false,false,new THREE.Vector3(0,1.5,-10),false);
 }
 equip(weapon:Weapon) {
  this.muzzle.removeFromParent();
  for(const name of WEAPON_NAMES){const object=this.root.getObjectByName(name);if(object)object.visible=name.toLowerCase()===weapon;}
  this.gun=this.root.getObjectByName(weapon[0].toUpperCase()+weapon.slice(1))??null;
  if(this.gun instanceof THREE.Mesh) {
   
   // The survivor export bakes the standalone +Z barrel into this local basis.
   const barrel:Record<Weapon,THREE.Vector3> = { pistol:new THREE.Vector3(.716834,.287763,.425996), rifle:new THREE.Vector3(.788114,.316130,.613480), shotgun:new THREE.Vector3(.753908,.283416,.548362) };
   this.muzzle.position.copy(barrel[weapon]);
   this.muzzle.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),BARREL_DIRECTION);
   this.gun.scale.setScalar(weapon==='shotgun'?.65:.55);
   this.gun.add(this.muzzle);
  }
 }
 muzzlePosition() {this.root.updateMatrixWorld(true);return this.muzzle.getWorldPosition(new THREE.Vector3());}
 shot() {
   const force = this.gun?.name === 'Shotgun' ? 1.35 : this.gun?.name === 'Rifle' ? .58 : .9;
   this.recoil = Math.min(3, this.recoil + force*getTuning().gunRecoil);
   this.flashAge=getTuning().flashTime;
 }
 animate(dt:number,walking:boolean,airborne:boolean,target:THREE.Vector3,reloading:boolean) {
  const wanted=airborne?'Jump_Idle':walking?'Run_Gun':'Idle_Gun';
  const name=this.actions.has(wanted)?wanted:'Idle_Gun';
  if(this.action!==name){const next=this.actions.get(name),previous=this.actions.get(this.action);if(next){next.reset().play();if(previous)next.crossFadeFrom(previous,.15,false);}this.action=name;}
  this.mixer.update(dt);
   // Recoil pushes the aiming shoulder and weapon backward, then settles naturally.
   this.recoil = Math.max(0, this.recoil - dt * 7.5);
   this.reloadElapsed = reloading ? this.reloadElapsed + dt : 0;
  if(this.gun && this.torso) {
   this.root.updateMatrixWorld(true);
   const gunDirection=BARREL_DIRECTION.clone().transformDirection(this.gun.matrixWorld);
   const desired=target.clone().sub(this.muzzlePosition()).normalize();
   const delta=new THREE.Quaternion().setFromUnitVectors(gunDirection,desired);
   const parent=this.torso.parent!.matrixWorld;
   const local=new THREE.Quaternion().setFromRotationMatrix(parent.clone().invert().multiply(new THREE.Matrix4().makeRotationFromQuaternion(delta)).multiply(parent));
   this.torso.quaternion.premultiply(local);
   if (this.recoil > 0) {
     this.torso.rotateX(-this.recoil * .12);
     this.torso.rotateZ(this.recoil * .026);
     // Primary hand follows the authored firearm grip; its shoulder absorbs the shot.
     const shootingArm = this.root.getObjectByName('UpperArmL');
     if (shootingArm) shootingArm.rotateX(-this.recoil * .16);
    }
   if(reloading)this.torso.rotateX(Math.sin(this.reloadElapsed*5)*.12+.15);
   this.root.updateMatrixWorld(true);
   if(this.gun.name!=='Pistol')this.supportHand(this.gun.localToWorld(new THREE.Vector3(.413,.094,.166)));
  }
  this.flashAge=Math.max(0,this.flashAge-dt);
   this.flash.visible=this.flashAge>0;
   this.flash.scale.setScalar(getTuning().flashScale*(1+this.recoil*.8));
 }
 private supportHand(target:THREE.Vector3) {
  const upper=this.root.getObjectByName('UpperArmR'),lower=this.root.getObjectByName('LowerArmR'),hand=this.root.getObjectByName('Middle1R');
  if(!upper||!lower||!hand)return;
  const a=upper.getWorldPosition(new THREE.Vector3()),b=lower.getWorldPosition(new THREE.Vector3()),c=hand.getWorldPosition(new THREE.Vector3());
  const l1=a.distanceTo(b),l2=b.distanceTo(c),towards=target.clone().sub(a),d=Math.min(towards.length(),l1+l2-.001);towards.normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*Math.max(.001,d));
  const down=new THREE.Vector3(0,-1,0).addScaledVector(towards,towards.y).normalize();
  const elbow=a.clone().addScaledVector(towards,along).addScaledVector(down,Math.sqrt(Math.max(0,l1*l1-along*along)));
  const point=(bone:THREE.Object3D,child:THREE.Object3D,to:THREE.Vector3)=>{
   const start=bone.getWorldPosition(new THREE.Vector3()),before=child.getWorldPosition(new THREE.Vector3()).sub(start).normalize();
   const desired=to.clone().sub(start).normalize(),delta=new THREE.Quaternion().setFromUnitVectors(before,desired);
   const parent=bone.parent!.matrixWorld;bone.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(parent.clone().invert().multiply(new THREE.Matrix4().makeRotationFromQuaternion(delta)).multiply(parent)));this.root.updateMatrixWorld(true);
  };
  point(upper,lower,elbow);point(lower,hand,target);
 }
 dispose() {this.mixer.stopAllAction();this.mixer.uncacheRoot(this.root);this.flash.geometry.dispose();(this.flash.material as THREE.Material).dispose();this.root.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.dispose();});this.root.removeFromParent();}
}
