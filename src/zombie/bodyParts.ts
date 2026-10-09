import * as THREE from 'three';
import { type HitSphere, type Region } from './combat';
import { getTuning } from './tuning';
export function shareSkeletons(root:THREE.Group) {
 const skeletons:THREE.Skeleton[]=[];
 root.traverse(o=>{
  if(!(o instanceof THREE.SkinnedMesh))return;
  const shared=skeletons.find(s=>s.bones.length===o.skeleton.bones.length && s.bones.every((b,i)=>b===o.skeleton.bones[i] && s.boneInverses[i].equals(o.skeleton.boneInverses[i])));
  if(shared)o.skeleton=shared;else skeletons.push(o.skeleton);
 });
}
const REGIONS:Region[]=['head','torso','arm-l','arm-r','leg-l','leg-r'];
export function bodySpheres(root:THREE.Group,missing:Set<Region>):HitSphere[] {
 root.updateMatrixWorld(true);
 const results:HitSphere[]=[];
 const add=(region:Region,names:string[],radius:number)=> {
  if(missing.has(region))return;
  const bones=names.map(name=>root.getObjectByName(name.replace(/\./g,''))).filter((x):x is THREE.Object3D=>!!x);
  if(!bones.length)return;
  const positions=bones.map(b=>b.getWorldPosition(new THREE.Vector3()));
  for(let i=0;i<positions.length;i++) {
   results.push({region,center:positions[i],radius});
   if(i)results.push({region,center:positions[i].clone().lerp(positions[i-1],.5),radius});
  }
 };
 add('head',['Head'],.23);add('torso',['Abdomen','Torso','Neck'],.27);
 for(const side of ['L','R'] as const) {
  add(side==='L'?'arm-l':'arm-r',['UpperArm.'+side,'LowerArm.'+side,'Middle1.'+side],.13);
  add(side==='L'?'leg-l':'leg-r',['UpperLeg.'+side,'LowerLeg.'+side,'Foot.'+side],.16);
 }
 if(!results.length)for(const region of REGIONS)if(!missing.has(region)) {
  const offset=region==='head'?new THREE.Vector3(0,1.65,0):region==='torso'?new THREE.Vector3(0,1,0):new THREE.Vector3(region.endsWith('l')?-.4:.4,region.startsWith('arm')?1.1:.4,0);
  results.push({region,center:root.localToWorld(offset),radius:region==='torso'?.35:.2});
 }
 return results;
}
export interface Debris {root:THREE.Group;velocity:THREE.Vector3;age:number;spin:THREE.Vector3;floor:number;rest:number}
/** Freeze the prepared region's real skinned vertices at the impact pose. */
export function detachRegion(root:THREE.Group,region:Region,impulse:THREE.Vector3):Debris|null {
 root.updateMatrixWorld(true);
 const meshes:THREE.SkinnedMesh[]=[];
 root.traverse(o=>{if(o instanceof THREE.SkinnedMesh && o.visible && (o.name.startsWith('part-'+region+'-') || (region.startsWith('leg-') && o.name.startsWith('part-foot-'+region.slice(4)+'-'))))meshes.push(o);});
 if(!meshes.length)return null;
 const group=new THREE.Group();group.name='detached-'+region;
 const tuning=getTuning();
 const center=new THREE.Box3().setFromObject(meshes[0]).getCenter(new THREE.Vector3());group.position.copy(center);
 for(const source of meshes) {
  source.skeleton.update();const original=source.geometry;
  const geometry=new THREE.BufferGeometry(),positions=original.getAttribute('position');
  const values=new Float32Array(positions.count*3);const p=new THREE.Vector3();
  for(let i=0;i<positions.count;i++) {source.getVertexPosition(i,p);p.applyMatrix4(source.matrixWorld).sub(center);p.toArray(values,i*3);}
  geometry.setAttribute('position',new THREE.BufferAttribute(values,3));
  for(const name of ['uv','color'])if(original.getAttribute(name))geometry.setAttribute(name,original.getAttribute(name).clone());
  if(original.index)geometry.setIndex(original.index.clone());geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const material=Array.isArray(source.material)
    ? source.material.map(m=>m.clone())
    : source.material.clone();
  const all=Array.isArray(material)?material:[material];
  for(const m of all) {m.transparent=true;m.opacity=1;m.depthWrite=true;}
  group.add(new THREE.Mesh(geometry,material));source.visible=false;
 }
 // Freeze at the impact pose, then simulate an outward impulse. No heavy physics dependency.
 // Some source files also include unskinned footwear. Prevent a detached foot from staying on the walker.
 if(region.startsWith('leg-')) {
   const side=region.endsWith('-l')?'L':'R';
   root.traverse(o=>{
     if(!(o instanceof THREE.Mesh) || o instanceof THREE.SkinnedMesh || !o.visible)return;
     const label=o.name.toLowerCase(), letter=side.toLowerCase();
     if(/foot|shoe|ankle|toe/.test(label) &&
       (label.endsWith(letter) || label.includes('.'+letter) || label.includes('_'+letter)))o.visible=false;
   });
   // The prepared part segmentation can leave a few foot-weighted triangles on
   // the original torso mesh. Collapse the severed foot chain, never the support foot.
   for(const segment of ['Foot.','LowerLeg.']) {
     const limb=bone(root,segment+side,segment.replace('.','')+side);
     if(limb)limb.scale.setScalar(0.001);
   }
   root.updateMatrixWorld(true);
 }
 return {root:group,velocity:impulse.clone().normalize().multiplyScalar(tuning.debrisForce).add(new THREE.Vector3(0,tuning.debrisLift,0)),
 age:0,spin:new THREE.Vector3(3+Math.random()*4,2+Math.random()*3,4+Math.random()*3),floor:root.position.y,rest:0};
}
export function disposeDebris(piece:Debris) {
 piece.root.traverse(o=>{if(o instanceof THREE.Mesh) {
   o.geometry.dispose();
   for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.dispose();
 }});
 piece.root.removeFromParent();
}
export function updateDebris(piece:Debris,dt:number):boolean {
 const tuning=getTuning();
 piece.age+=dt;
 if(piece.age>tuning.debrisTime)return false;
 piece.velocity.y-=tuning.debrisGravity*dt;
 piece.root.position.addScaledVector(piece.velocity,dt);
 piece.root.rotation.x+=piece.spin.x*dt; piece.root.rotation.y+=piece.spin.y*dt;
 if(piece.root.position.y<piece.floor+.11) {
  piece.root.position.y=piece.floor+.11;
  piece.velocity.y=Math.abs(piece.velocity.y)*tuning.debrisBounce;
  piece.velocity.x*=.73;piece.velocity.z*=.73;piece.spin.multiplyScalar(.65);
  piece.rest+=dt;
 }
 // Fade out after actual ballistic movement, without changing the source model's materials.
 if(piece.age>tuning.debrisTime-.35) {
   const alpha=Math.max(0,(tuning.debrisTime-piece.age)/.35);
   piece.root.traverse(o=>{if(o instanceof THREE.Mesh) {
     for(const mat of Array.isArray(o.material)?o.material:[o.material])mat.opacity=alpha;
   }});
 }
 return true;
}

// Keep surviving anatomy above the terrain without expensive per-frame mesh bounds.
// bone names are sanitised by glTFLoader (Foot.L -> FootL).
function bone(root:THREE.Group,...names:string[]): THREE.Object3D|null {
 for(const name of names) {
  const found=root.getObjectByName(name)||root.getObjectByName(name.replace(/\./g,''));
  if(found)return found;
 }
 return null;
}
export function positionDamagedZombie(
 root:THREE.Group, visual:THREE.Group, missing:Set<Region>,
 originalY:number,floor:number,now:number,
 hopHeight:number,hopFrequency:number,
) {
 const left=missing.has('leg-l'),right=missing.has('leg-r');
 visual.rotation.x=left&&right ? -.56 : 0;
 visual.position.y=originalY;
 root.position.y=floor;
 root.updateMatrixWorld(true);
 if(left&&right) {
   // Ground-align on the torso, NOT the old pre-rotation feet; avoids buried heads.
   const torso=bone(visual,'Abdomen','Torso','Spine');
   if(torso){
     const y=torso.getWorldPosition(new THREE.Vector3()).y;
     visual.position.y+=floor+.54-y;
   }
   return;
 }
 if(left||right) {
   // One surviving planted foot determines the ground contact point.
   const standingFoot=right?bone(visual,'Foot.L','FootL'):bone(visual,'Foot.R','FootR');
   if(standingFoot) {
     const fy=standingFoot.getWorldPosition(new THREE.Vector3()).y;
     // Small, short hops, never a 0.2m permanent floating offset.
     const hop=Math.max(0,Math.sin(now*hopFrequency))*Math.min(.11,hopHeight);
     visual.position.y += (floor + .06 + hop) - fy;
   }
 }
}
