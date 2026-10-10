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
/** Segment safety checks are against real colliders, NOT the nav grid.
 * Use the same clearance for routing and stepSeparated. */
export function pathClear(a:Flat,b:Flat,colliders:readonly Collider[],radius=.49) {
 const dist=Math.hypot(b.x-a.x,b.z-a.z);
 for(let n=0;n<=Math.ceil(dist/.55);n++) {
  const t=n/Math.max(1,Math.ceil(dist/.55));
  if(!freeAt(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,colliders,radius))return false;
 }
 return true;
}
/** Stable WORLD-ALIGNED street route, preserving a complete detour until reached.
 * The old 1.65m grid followed the moving enemy and flipped east/west at wall edges.
 * Bounding-box A* with a binary heap keeps the expanded search affordable. */
export function planStreetPath(start:Flat,goal:Flat,colliders:readonly Collider[],radius=.49):Flat[] {
 if(pathClear(start,goal,colliders,radius))return [{x:goal.x,z:goal.z}];
 const cell=1.15,margin=18;
 const xmin=Math.ceil(Math.max(-67.5,Math.min(start.x,goal.x)-margin)/cell);
 const xmax=Math.floor(Math.min(67.5,Math.max(start.x,goal.x)+margin)/cell);
 const zmin=Math.ceil(Math.max(-67.5,Math.min(start.z,goal.z)-margin)/cell);
 const zmax=Math.floor(Math.min(67.5,Math.max(start.z,goal.z)+margin)/cell);
 const width=xmax-xmin+1,height=zmax-zmin+1;
 if(width<=0||height<=0)return [];
 const total=width*height;
 const index=(x:number,z:number)=>(z-zmin)*width+(x-xmin);
 const coords=(id:number):Flat=>({x:(xmin+id%width)*cell,z:(zmin+Math.floor(id/width))*cell});
 const gridX=(x:number)=>Math.max(xmin,Math.min(xmax,Math.round(x/cell)));
 const gridZ=(z:number)=>Math.max(zmin,Math.min(zmax,Math.round(z/cell)));
 const source=index(gridX(start.x),gridZ(start.z));
 const target=index(gridX(goal.x),gridZ(goal.z));
 const mapColliders=colliders.filter(c=>c.maxY>.42&&c.minY<2.1&&
   c.maxX>xmin*cell-2&&c.minX<xmax*cell+2&&c.maxZ>zmin*cell-2&&c.minZ<zmax*cell+2);
 const clear=new Int8Array(total); // 0 unknown, 1 free, -1 obstructed
 const canEnter=(id:number)=>{
  if(clear[id]===0){const p=coords(id);clear[id]=freeAt(p.x,p.z,mapColliders,radius)?1:-1;}
  return clear[id]===1;
 };
 const g=new Float32Array(total);g.fill(Infinity);g[source]=0;
 const parent=new Int32Array(total);parent.fill(-1);
 const closed=new Uint8Array(total);
 type Node={id:number;score:number};
 const heap:Node[]=[];
 const push=(entry:Node)=>{let i=heap.length;heap.push(entry);while(i>0){
   const p=(i-1)>>1;if(heap[p].score<=entry.score)break;heap[i]=heap[p];i=p;
  }heap[i]=entry;};
 const pop=():Node=>{
   const first=heap[0],last=heap.pop()!;
   if(heap.length){let i=0;while(i*2+1<heap.length){
     let child=i*2+1;if(child+1<heap.length&&heap[child+1].score<heap[child].score)child++;
     if(heap[child].score>=last.score)break;
     heap[i]=heap[child];i=child;
   }heap[i]=last;}
   return first;
 };
 const heuristic=(id:number)=>{const p=coords(id);return Math.hypot(p.x-goal.x,p.z-goal.z);};
 push({id:source,score:heuristic(source)});
 const steps:[number,number,number][]=[
  [1,0,1],[-1,0,1],[0,1,1],[0,-1,1],
  [1,1,Math.SQRT2],[-1,1,Math.SQRT2],[1,-1,Math.SQRT2],[-1,-1,Math.SQRT2]
 ];
 let reached=-1,closest=-1,best=Infinity;
 for(let expanded=0;heap.length&&expanded<7000;){
  const {id}=pop();if(closed[id])continue;closed[id]=1;expanded++;
  const x=xmin+id%width,z=zmin+Math.floor(id/width);
  const h=heuristic(id);
  if(h<best){best=h;closest=id;}
  if(id===target){reached=id;break;}
  for(const [dx,dz,cost] of steps){
   const nx=x+dx,nz=z+dz;
   if(nx<xmin||nx>xmax||nz<zmin||nz>zmax)continue;
   const next=index(nx,nz);
   if(closed[next]||!canEnter(next))continue;
   if(dx&&dz&&(!canEnter(index(x+dx,z))||!canEnter(index(x,z+dz))))continue;
   const trial=g[id]+cost*cell;
   if(trial+1e-5>=g[next])continue;
   g[next]=trial;parent[next]=id;push({id:next,score:trial+heuristic(next)});
  }
 }
 if(reached<0)reached=closest;
 if(reached<0||reached===source)return [];
 const points:Flat[]=[];
 let current=reached;
 for(let iterations=0;current!==source&&current>=0&&iterations<total;iterations++){
   points.push(coords(current));current=parent[current];
 }
 if(current!==source)return [];
 points.reverse();
 // Retain turns (not a new moving-grid waypoint on every repath). Lookahead
 // only skips cells when the COMPLETE diagonal is collision-clear.
 const simplified:Flat[]=[];let anchor=start,idx=0;
 while(idx<points.length){
   let far=idx;
   for(let j=idx+1;j<points.length;j++){
     if(!pathClear(anchor,points[j],mapColliders,radius))break;
     far=j;
   }
   const next=points[far];simplified.push(next);anchor=next;idx=far+1;
 }
 if(pathClear(anchor,goal,mapColliders,radius))simplified.push({x:goal.x,z:goal.z});
 return simplified;
}
/** Backward compatible first waypoint for older tests and optional callers. */
export function routeStreet(start:Flat,goal:Flat,colliders:readonly Collider[],radius=.49):Flat {
 return planStreetPath(start,goal,colliders,radius)[0] ?? start;
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
