import * as THREE from 'three';
export type Weapon = 'pistol' | 'rifle' | 'shotgun';
export type Region = 'head' | 'torso' | 'arm-l' | 'arm-r' | 'leg-l' | 'leg-r';
export interface Collider { minX:number; maxX:number; minY:number; maxY:number; minZ:number; maxZ:number }
export interface HitSphere { region:Region; center:THREE.Vector3; radius:number }
export const WEAPONS = {
 pistol: { rounds:12, delay:.32, reload:1.2, damage:34, pellets:1, spread:0, range:90 },
 rifle: { rounds:30, delay:.11, reload:1.7, damage:27, pellets:1, spread:.006, range:90 },
 shotgun: { rounds:6, delay:.85, reload:2, damage:22, pellets:9, spread:.048, range:35 },
};
export const DISMEMBERMENT = { limbDistance:14, limbDamage:15, maxDebris:24, lifetime:6 };
export function damageFor(weapon:Weapon,region:Region) { return WEAPONS[weapon].damage * (region==='head'?3:region==='torso'?1:.7); }
export function severable(weapon:Weapon,region:Region,distance:number) {
 return region==='head' || (weapon==='shotgun' && region!=='torso' && distance<DISMEMBERMENT.limbDistance);
}
export function nearestHit(ray:THREE.Ray,spheres:HitSphere[],range:number) {
 let result:{region:Region;distance:number;point:THREE.Vector3}|null=null;
 for (const s of spheres) {
  const point=ray.intersectSphere(new THREE.Sphere(s.center,s.radius),new THREE.Vector3());
  if (!point) continue;
  const distance=point.distanceTo(ray.origin);
  if (distance<=range && (!result || distance<result.distance)) result={region:s.region,distance,point};
 }
 return result;
}
export function wallDistance(ray:THREE.Ray,colliders:Collider[]) {
 let distance=Infinity; const point=new THREE.Vector3(), box=new THREE.Box3();
 for(const c of colliders) {
  box.min.set(c.minX,c.minY,c.minZ);box.max.set(c.maxX,c.maxY,c.maxZ);
  if(ray.intersectBox(box,point))distance=Math.min(distance,point.distanceTo(ray.origin));
 }
 return distance;
}
/** Replan around the first obstructing rectangle, with a margin for the body. */
export function routeAround(from:THREE.Vector2,to:THREE.Vector2,colliders:Collider[],radius:number):THREE.Vector2 {
 const direction=new THREE.Vector3(to.x-from.x,0,to.y-from.y);const length=direction.length();
 if(length<.01)return to.clone();
 const ray=new THREE.Ray(new THREE.Vector3(from.x,1,from.y),direction.divideScalar(length));
 let first:Collider|undefined,dist=length;const box=new THREE.Box3(),hit=new THREE.Vector3();
 for(const c of colliders) {
  if(c.maxY<.4 || c.minY>2)continue;
  box.min.set(c.minX-radius,0,c.minZ-radius);box.max.set(c.maxX+radius,3,c.maxZ+radius);
  if(ray.intersectBox(box,hit) && hit.distanceTo(ray.origin)<dist) {first=c;dist=hit.distanceTo(ray.origin);}
 }
 if(!first)return to.clone();
 const r=radius+.12,c=first;
 const corners=[new THREE.Vector2(c.minX-r,c.minZ-r),new THREE.Vector2(c.maxX+r,c.minZ-r),new THREE.Vector2(c.maxX+r,c.maxZ+r),new THREE.Vector2(c.minX-r,c.maxZ+r)];
 const clear=(a:THREE.Vector2,b:THREE.Vector2)=> {
  const d=new THREE.Vector3(b.x-a.x,0,b.y-a.y),len=d.length();if(len<.001)return true;
  const ray=new THREE.Ray(new THREE.Vector3(a.x,1,a.y),d.divideScalar(len));
  const box=new THREE.Box3(new THREE.Vector3(c.minX+1e-4-radius,0,c.minZ+1e-4-radius),new THREE.Vector3(c.maxX-1e-4+radius,3,c.maxZ-1e-4+radius));
  const p=ray.intersectBox(box,new THREE.Vector3());return !p || p.distanceTo(ray.origin)>len;
 };
 // Six-node shortest path, including the four corners of the actual obstruction.
 const nodes=[from,...corners,to],cost=[0,Infinity,Infinity,Infinity,Infinity,Infinity],parent=[-1,-1,-1,-1,-1,-1],done=new Set<number>();
 for(let n=0;n<nodes.length;n++) {
  let i=-1;for(let j=0;j<nodes.length;j++)if(!done.has(j)&&(i<0||cost[j]<cost[i]))i=j;
  if(i<0||!Number.isFinite(cost[i]))break;done.add(i);
  for(let j=1;j<nodes.length;j++)if(!done.has(j)&&clear(nodes[i],nodes[j])) {
   const candidate=cost[i]+nodes[i].distanceTo(nodes[j]);if(candidate<cost[j]){cost[j]=candidate;parent[j]=i;}
  }
 }
 let index=5;if(parent[index]<0)return from.clone();while(parent[index]>0)index=parent[index];return nodes[index].clone();
}
