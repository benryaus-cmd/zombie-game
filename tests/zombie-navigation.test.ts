import test from 'node:test';
import assert from 'node:assert/strict';
import { freeAt, routeStreet, planStreetPath, pathClear, stepSeparated, reachableSpawnArea } from '../src/zombie/navigation';
const wall={minX:2,maxX:5,minZ:-2,maxZ:2,minY:0,maxY:3};
test('navigation searches around a building and does not route inside it',()=>{
 const way=routeStreet({x:0,z:0},{x:10,z:0},[wall]);
 assert.equal(freeAt(way.x,way.z,[wall]),true);
 assert.ok(Math.hypot(way.x,way.z)>0.1);
});
test('separated horde agents do not step on occupied positions',()=>{
 const others=[{x:1,z:0},{x:1.2,z:.5}];
 const current={x:0,z:0},dst={x:8,z:0};
 const next=stepSeparated(current,dst,others,[],.15,.47,1.05);
 assert.ok(Number.isFinite(next.x)&&Number.isFinite(next.z));
 assert.ok(Math.hypot(next.x-current.x,next.z-current.z)<=.151);
 for(const o of others)assert.ok(Math.hypot(next.x-o.x,next.z-o.z)>.95);
});
test('overlapping zombies are permitted to move apart instead of freezing',()=>{
 const p=stepSeparated({x:0,z:0},{x:10,z:0},[{x:.3,z:0}],[],.1,.47,1);
 assert.ok(Math.hypot(p.x,p.z)>0);
});

test('zombies never spawn outside a continuous perimeter wall',()=>{
 const divide={minX:4.5,maxX:5.5,minZ:-45,maxZ:45,minY:0,maxY:5};
 const reachable=reachableSpawnArea({x:0,z:0},[divide],32);
 assert.equal(reachable({x:-17,z:8}),true,'same accessible side is valid');
 assert.equal(reachable({x:17,z:0}),false,'far side of an impassable wall cannot spawn');
 assert.equal(reachable({x:70,z:0}),false,'outside quarter perimeter cannot spawn');
 assert.equal(reachable({x:5,z:0}),false,'inside the wall cannot spawn');
});
test('navigation flood permits destinations through a legitimate wall opening',()=>{
 const walls=[
   {minX:5,maxX:6,minZ:-30,maxZ:-4,minY:0,maxY:4},
   {minX:5,maxX:6,minZ:4,maxZ:30,minY:0,maxY:4}
 ];
 const reachable=reachableSpawnArea({x:0,z:0},walls,32);
 assert.equal(reachable({x:18,z:0}),true,'a navigable gap connects both sides');
});
test('west-edge wall zombie completes a stable safe route instead of pacing side to side',()=>{
 const westWall={minX:-66,maxX:-42,minZ:-11.225,maxZ:-10.775,minY:0,maxY:3.8};
 const spawn={x:-51.848,z:-11.936},player={x:-64,z:0};
 const plan=planStreetPath(spawn,player,[westWall],.49);
 assert.ok(plan.length>=2,'should return a retained detour rather than moving-grid alternating step');
 let from=spawn;
 for(const to of plan){
   assert.equal(pathClear(from,to,[westWall],.49),true,'every waypoint transition must clear wall');
   from=to;
 }
 assert.ok(Math.hypot(from.x-player.x,from.z-player.z)<1,'zombie should reach the player');
 assert.ok(plan.some(p=>p.x<-66.49||p.x>-41.51),'path must get around a wall end');
});
test('stable navigation does not return an obstructed goal if no complete path exists',()=>{
 const blocker={minX:-15,maxX:15,minZ:-1,maxZ:1,minY:0,maxY:4};
 const route=planStreetPath({x:0,z:-3},{x:0,z:3},[blocker],.49);
 assert.ok(route.length>=1);
 let p={x:0,z:-3};
 for(const next of route){assert.ok(pathClear(p,next,[blocker],.49));p=next;}
});
