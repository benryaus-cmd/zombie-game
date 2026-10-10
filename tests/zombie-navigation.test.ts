import test from 'node:test';
import assert from 'node:assert/strict';
import { freeAt, routeStreet, stepSeparated, reachableSpawnArea } from '../src/zombie/navigation';
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