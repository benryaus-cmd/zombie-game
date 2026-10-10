import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { tracerPose, validBattleLine } from '../src/zombie/WarzoneAtmosphere';

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
