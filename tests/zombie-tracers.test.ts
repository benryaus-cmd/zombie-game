import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { tracerToReticle } from '../src/zombie/shotTrails';
test('high shoulder camera sends visible round to exactly the centre reticle ray',()=>{
 const camera=new THREE.Vector3(.85,3.5,-4);
 const muzzle=new THREE.Vector3(.4,1.45,-1.7);
 const cameraDir=new THREE.Vector3(-.03,-.16,-1).normalize();
 const ray=new THREE.Ray(camera,cameraDir);
 const aimDistance=22;
 const shot=tracerToReticle(muzzle,ray,aimDistance);
 const endpoint=muzzle.clone().add(shot.direction);
 const crosshair=ray.at(aimDistance,new THREE.Vector3());
 assert.ok(endpoint.distanceTo(crosshair)<1e-6,'tracer converges on crosshair rather than parallel camera direction');
 assert.ok(Math.abs(shot.distance-shot.direction.length())<1e-8);
 assert.ok(shot.direction.y!==cameraDir.y);
});
