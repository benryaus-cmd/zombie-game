import test from 'node:test';
import assert from 'node:assert/strict';
import { freeAt, routeStreet, stepSeparated } from '../src/zombie/navigation';
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
