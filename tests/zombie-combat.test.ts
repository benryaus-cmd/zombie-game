import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { nearestHit, wallDistance, damageFor, severable, routeAround } from '../src/zombie/combat';
const sphere = (z:number,region:any='head') => ({region,center:new THREE.Vector3(0,0,z),radius:.2});
const ray=new THREE.Ray(new THREE.Vector3(),new THREE.Vector3(0,0,-1));
test('nearest body region wins; miss and range are respected',()=> {
 assert.equal(nearestHit(ray,[sphere(-3),sphere(-2,'torso')],10)?.region,'torso');
 assert.equal(nearestHit(ray,[sphere(-11)],10),null);
 assert.equal(nearestHit(ray,[{...sphere(-3),center:new THREE.Vector3(1,0,-3)}],10),null);
});
test('wall occlusion has real distance; no wall is infinity',()=> {
 assert.equal(wallDistance(ray,[]),Infinity);
 assert.equal(wallDistance(ray,[{minX:-1,maxX:1,minY:-1,maxY:1,minZ:-2,maxZ:-1}]),1);
});
test('powerful shots sever only actual supported hits',()=> {
 assert.ok(damageFor('pistol','head') > damageFor('pistol','torso'));
 assert.equal(severable('shotgun','arm-l',4),true);assert.equal(severable('pistol','arm-l',4),false);
 assert.equal(severable('shotgun','torso',4),false);assert.equal(severable('shotgun','leg-r',40),false);
});
test('navigation returns a building corner instead of driving into its centre',()=> {
 const p=routeAround(new THREE.Vector2(0,3),new THREE.Vector2(0,-3),[{minX:-1,maxX:1,minY:0,maxY:3,minZ:-1,maxZ:1}],.5);
 assert.ok(Math.abs(p.x)>1);assert.ok(p.y>1);
});
