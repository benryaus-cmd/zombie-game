import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { tracerPose, validBattleLine, chooseBurstGroups, battlePointsTowardMap } from '../src/zombie/WarzoneAtmosphere';

test('environmental tracer advances from rooftop source to destination',()=>{
 const projectile={from:new THREE.Vector3(0,12,0),to:new THREE.Vector3(40,10,0),elapsed:0,flight:.32};
 const first=tracerPose(projectile,.08),second=tracerPose(projectile,.08);
 assert.ok(second.tip.distanceTo(projectile.from)>first.tip.distanceTo(projectile.from)+5);
 assert.ok(second.tip.distanceTo(second.tail)<=3.51);
 assert.ok(!second.done);
 const end=tracerPose(projectile,.16);
 assert.ok(end.tip.distanceTo(projectile.to)<.000001);
 assert.ok(end.fade>0);
 assert.ok(tracerPose(projectile,.17).done,'trail ends after delayed fade');
});
test('environmental trajectory rejects a solid collider before impact',()=>{
 const c={minX:8,maxX:12,minZ:-2,maxZ:2,minY:0,maxY:15};
 assert.equal(validBattleLine({origin:new THREE.Vector3(0,12,0),destination:new THREE.Vector3(20,12,0)},[c]),false);
 assert.equal(validBattleLine({origin:new THREE.Vector3(0,17,0),destination:new THREE.Vector3(20,17,0)},[c]),true);
});

test('single volleys have 4-9 shots and double volleys have two 3-5 shot bursts',()=>{
 for(const r of [0,.2,.49,.7,.999]){
   const single=chooseBurstGroups(false,()=>r),double=chooseBurstGroups(true,()=>r);
   assert.equal(single.length,1);assert.ok(single[0]>=4&&single[0]<=9);
   assert.equal(double.length,2);assert.ok(double.every(n=>n>=3&&n<=5));
 }
});
test('distant shots aim inward, not across and away from the city',()=>{
 const center=new THREE.Vector3(0,0,0);
 const toward={origin:new THREE.Vector3(170,18,60),destination:new THREE.Vector3(28,11,8)};
 const away={origin:new THREE.Vector3(40,18,0),destination:new THREE.Vector3(100,12,0)};
 assert.equal(battlePointsTowardMap(toward,center),true);
 assert.equal(battlePointsTowardMap(away,center),false);
});
