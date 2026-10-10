import type { Collider } from './combat';
export type Flat = { x:number; z:number };

/** 2D, capped-cost street navigation. Search is only used for blocked agents,
 * not every frame. Collision checks use nearby building rectangles only. */
export function freeAt(x:number,z:number,buildings:readonly Collider[],radius=.47):boolean {
  for(const b of buildings) {
    if(b.maxY < .42 || b.minY > 2.1) continue;
    if(x > b.minX-radius && x < b.maxX+radius && z > b.minZ-radius && z < b.maxZ+radius)return false;
  }
  return true;
}
export function nearbyBuildings(x:number,z:number,colliders:readonly Collider[],extent=29) {
  return colliders.filter(b=>b.maxX>x-extent&&b.minX<x+extent&&b.maxZ>z-extent&&b.minZ<z+extent&&b.maxY>.42&&b.minY<2.1);
}
export function routeStreet(start:Flat,goal:Flat,colliders:readonly Collider[],radius=.52):Flat {
  const close=nearbyBuildings(start.x,start.z,colliders,24);
  // Try direct route first; a ray point check avoids the old one-rectangle
  // shortest-path algorithm looping at building intersections.
  const deltaX=goal.x-start.x,deltaZ=goal.z-start.z,dist=Math.hypot(deltaX,deltaZ);
  if(dist<.01)return goal;
  const maxDirect=Math.min(dist,15), probes=Math.max(2,Math.ceil(maxDirect/.8));
  let clear=true;
  for(let i=1;i<=probes;i++){
    const ratio=(i/probes)*maxDirect/dist;
    if(!freeAt(start.x+deltaX*ratio,start.z+deltaZ*ratio,close,radius)){clear=false;break;}
  }
  if(clear)return goal;
  // Short bounded A* around the zombie. The 2m grid needs at most 400 nodes,
  // and an expansion budget keeps dense hordes inexpensive.
  const cell=1.65, side=29, mid=(side-1)/2;
  const clamp=(n:number)=>Math.max(0,Math.min(side-1,Math.round(n)));
  const key=(ix:number,iz:number)=>iz*side+ix;
  const world=(ix:number,iz:number):Flat=>({x:start.x+(ix-mid)*cell,z:start.z+(iz-mid)*cell});
  const goalX=clamp(mid+deltaX/cell),goalZ=clamp(mid+deltaZ/cell);
  const wanted=key(goalX,goalZ),startIndex=key(mid,mid);
  const g=new Float32Array(side*side);g.fill(Infinity);g[startIndex]=0;
  const parent=new Int16Array(side*side);parent.fill(-1);
  const done=new Uint8Array(side*side),open=[startIndex];
  let best=startIndex,bestDist=Infinity;
  const toward=(x:number,z:number)=>Math.hypot(x-goalX,z-goalZ);
  const delta=[[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[-1,1],[1,-1],[1,1]];
  for(let iterations=0;open.length&&iterations<250;iterations++){
    let selected=0,score=Infinity;
    for(let i=0;i<open.length;i++){
      const index=open[i],x=index%side,z=Math.floor(index/side);
      const f=g[index]+toward(x,z)*1.2;
      if(f<score){score=f;selected=i;}
    }
    const index=open.splice(selected,1)[0];if(done[index])continue;
    done[index]=1;
    const x=index%side,z=Math.floor(index/side);
    const d=toward(x,z);
    if(d<bestDist){bestDist=d;best=index;}
    if(index===wanted)break;
    for(const [dx,dz] of delta){
      const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=side||nz>=side)continue;
      const p=world(nx,nz),next=key(nx,nz);
      if(done[next]||!freeAt(p.x,p.z,close,radius))continue;
      // No diagonal shortcut through corners.
      if(dx&&dz){
        const one=world(nx,z),two=world(x,nz);
        if(!freeAt(one.x,one.z,close,radius)||!freeAt(two.x,two.z,close,radius))continue;
      }
      const newCost=g[index]+(dx&&dz?1.414:1);
      if(newCost>=g[next])continue;
      g[next]=newCost;parent[next]=index;
      open.push(next);
    }
  }
  if(best===startIndex)return goal;
  let current=best;let count=0;
  while(parent[current]>=0&&parent[current]!==startIndex&&count++<side*side)current=parent[current];
  return world(current%side,Math.floor(current/side));
}

/** Agent separation respects buildings and avoids horde dogpiling, while 
 * keeping every agent's speed bounded by dt. */
export function stepSeparated(current:Flat,waypoint:Flat,others:readonly Flat[],
 buildings:readonly Collider[],step:number,radius=.46,spacing=1.0):Flat {
  if(step<=0)return current;
  let ax=waypoint.x-current.x,az=waypoint.z-current.z;
  const distance=Math.hypot(ax,az);if(distance>.001){ax/=distance;az/=distance;}else{ax=0;az=0;}
  let rx=0,rz=0;
  for(const other of others){
    const dx=current.x-other.x,dz=current.z-other.z,d=Math.hypot(dx,dz);
    if(d<.001||d>=spacing*2.1)continue;
    const force=(spacing*2.1-d)/(spacing*2.1);
    rx+=(dx/d)*force*1.85;rz+=(dz/d)*force*1.85;
  }
  ax+=rx;az+=rz;
  const norm=Math.hypot(ax,az);if(norm<.001)return current;
  ax/=norm;az/=norm;
  const angles=[0,.34,-.34,.7,-.7,1.1,-1.1,1.57,-1.57,2.2,-2.2,3.14];
  for(const angle of angles){
    const cos=Math.cos(angle),sin=Math.sin(angle),vx=ax*cos-az*sin,vz=ax*sin+az*cos;
    const x=current.x+vx*step,z=current.z+vz*step;
    if(!freeAt(x,z,buildings,radius))continue;
    let separated=true;
    for(const other of others){
      const previous=Math.hypot(current.x-other.x,current.z-other.z);
      const updated=Math.hypot(x-other.x,z-other.z);
      // Agents already overlapping must be able to escape, not freeze in place.
      if(updated<spacing-.03 && updated<previous+.0002){separated=false;break;}
    }
    if(separated)return {x,z};
  }
  return current;
}

/** Validate actual WALKABLE connectivity, not merely "not inside a wall".
 * A candidate on the far side of a perimeter wall is not a valid spawn.
 * 1.1m sampling plus clearance on each segment prevents corner tunnelling.
 * Cache the flood map once per spawning attempt, then test multiple candidates. */
export function reachableSpawnArea(player:Flat, colliders:readonly Collider[], radius=32) {
 const step=1.1,side=Math.ceil(radius*2/step)+1,center=Math.floor(side/2);
 const nearby=colliders.filter(c=>c.maxX>player.x-radius-2&&c.minX<player.x+radius+2&&c.maxZ>player.z-radius-2&&c.minZ<player.z+radius+2);
 const key=(x:number,z:number)=>z*side+x;
 const points=(x:number,z:number):Flat=>({x:player.x+(x-center)*step,z:player.z+(z-center)*step});
 const open=new Uint8Array(side*side),seen=new Uint8Array(side*side);
 const start=key(center,center),queue=[start];seen[start]=1;
 // Precompute blocked cells once; no per-frame city raycasters.
 for(let z=0;z<side;z++)for(let x=0;x<side;x++){
   const p=points(x,z);
   // Map2's established playable quarter ends near its ±68m perimeter.
   open[key(x,z)]=Math.abs(p.x)<68.5 && Math.abs(p.z)<68.5 && freeAt(p.x,p.z,nearby,.67)?1:0;
 }
 // Search starts at player, even if a fixture's overhanging collider overlaps origin.
 open[start]=1;
 for(let head=0;head<queue.length;head++) {
   const current=queue[head],x=current%side,z=Math.floor(current/side);
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
     const nx=x+dx,nz=z+dz;
     if(nx<0||nz<0||nx>=side||nz>=side)continue;
     const next=key(nx,nz);
     if(seen[next]||!open[next])continue;
     const a=points(x,z),b=points(nx,nz);
     if(!freeAt((a.x+b.x)*.5,(a.z+b.z)*.5,nearby,.67))continue;
     seen[next]=1;queue.push(next);
   }
 }
 return (candidate:Flat):boolean=>{
   if(Math.abs(candidate.x)>=68.5||Math.abs(candidate.z)>=68.5)return false;
   if(!freeAt(candidate.x,candidate.z,nearby,.7))return false;
   const x=Math.round((candidate.x-player.x)/step)+center;
   const z=Math.round((candidate.z-player.z)/step)+center;
   if(x<0||z<0||x>=side||z>=side)return false;
   // Also sample between the candidate and flood cell centre.
   const cell=points(x,z);
   return !!seen[key(x,z)] &&
     freeAt((candidate.x+cell.x)/2,(candidate.z+cell.z)/2,nearby,.7);
 };
}
