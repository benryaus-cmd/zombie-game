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
  group.add(new THREE.Mesh(geometry,source.material));source.visible=false;
 }
 // Freeze at the impact pose, then simulate an outward impulse. No heavy physics dependency.
 return {root:group,velocity:impulse.clone().normalize().multiplyScalar(tuning.debrisForce).add(new THREE.Vector3(0,tuning.debrisLift,0)),
 age:0,spin:new THREE.Vector3(3+Math.random()*4,2+Math.random()*3,4+Math.random()*3),floor:root.position.y,rest:0};
}
export function disposeDebris(piece:Debris) {piece.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});piece.root.removeFromParent();}
export function updateDebris(piece:Debris,dt:number):boolean {
 const tuning=getTuning();
 piece.age+=dt;
 if(piece.age>tuning.debrisTime)return false;
 if(piece.rest>0 && piece.velocity.lengthSq()<.09) { piece.rest+=dt; return true; }
 piece.velocity.y-=tuning.debrisGravity*dt;
 piece.root.position.addScaledVector(piece.velocity,dt);
 piece.root.rotation.x+=piece.spin.x*dt; piece.root.rotation.y+=piece.spin.y*dt;
 if(piece.root.position.y<piece.floor+.11) {
  piece.root.position.y=piece.floor+.11;
  piece.velocity.y=Math.abs(piece.velocity.y)*tuning.debrisBounce;
  piece.velocity.x*=.73;piece.velocity.z*=.73;piece.spin.multiplyScalar(.65);
  piece.rest+=dt;
 }
 // Gently dissolve during the last quarter-second, then dispose all buffers after ~2s.
 if (piece.age > tuning.debrisTime - .25) {
   const alpha=Math.max(.001,(tuning.debrisTime-piece.age)/.25);
   piece.root.scale.setScalar(alpha);
 }
 return true;
}
