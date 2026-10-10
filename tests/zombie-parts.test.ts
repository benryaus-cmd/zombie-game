import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shareSkeletons, detachRegion, disposeDebris, updateDebris, positionDamagedZombie } from '../src/zombie/bodyParts';
test('prepared pieces share one bone texture per matching skeleton',()=> {
 const root=new THREE.Group(),bone=new THREE.Bone();root.add(bone);
 const a=new THREE.SkinnedMesh(),b=new THREE.SkinnedMesh();a.bind(new THREE.Skeleton([bone]));b.bind(new THREE.Skeleton([bone]));root.add(a,b);
 shareSkeletons(root);assert.equal(a.skeleton,b.skeleton);
});
test('detachment freezes selected real geometry and timed cleanup is bounded',()=> {
 const root=new THREE.Group(),bone=new THREE.Bone();root.add(bone);
 const g=new THREE.BoxGeometry(.2,.2,.2),count=g.getAttribute('position').count;
 g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));
 const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const source=new THREE.SkinnedMesh(g,new THREE.MeshBasicMaterial());source.name='part-head-test';source.bind(new THREE.Skeleton([bone]));root.add(source);
 root.position.set(2,0,4);root.updateMatrixWorld(true);
 assert.equal(detachRegion(root,'arm-l',new THREE.Vector3()),null);
 const piece=detachRegion(root,'head',new THREE.Vector3(0,0,1));assert.ok(piece);assert.equal(source.visible,false);assert.equal(piece.root.children.length,1);
 assert.equal(detachRegion(root,'head',new THREE.Vector3()),null);
 assert.equal(updateDebris(piece,6.1),false);disposeDebris(piece);assert.equal(piece.root.parent,null);
});

test('one-legged zombies anchor surviving foot to ground instead of floating', () => {
 const root=new THREE.Group(),visual=new THREE.Group();root.add(visual);
 const foot=new THREE.Group();foot.name='FootR';foot.position.set(.1,.7,0);visual.add(foot);
 const torso=new THREE.Group();torso.name='Torso';torso.position.y=1.3;visual.add(torso);
 root.position.y=2;visual.position.y=.2;
 positionDamagedZombie(root,visual,new Set(['leg-l']),.2,2,0,.18,9);
 root.updateMatrixWorld(true);
 const worldY=foot.getWorldPosition(new THREE.Vector3()).y;
 assert.ok(Math.abs(worldY-2.06)<.005,'surviving foot should touch floor');
 assert.ok(torso.getWorldPosition(new THREE.Vector3()).y>2.2,'torso stays above ground');
});
test('crawlers align torso above ground rather than sinking below terrain', () => {
 const root=new THREE.Group(),visual=new THREE.Group();root.add(visual);
 const torso=new THREE.Group();torso.name='Torso';torso.position.y=1.3;visual.add(torso);
 const head=new THREE.Group();head.name='Head';head.position.y=1.9;visual.add(head);
 positionDamagedZombie(root,visual,new Set(['leg-l','leg-r']),0,5,1,.2,8);
 root.updateMatrixWorld(true);
 assert.ok(Math.abs(torso.getWorldPosition(new THREE.Vector3()).y-5.48)<.005);
 assert.ok(head.getWorldPosition(new THREE.Vector3()).y>5.5);
});

test('crawling uses authored animation pose and keeps animated hands on floor', () => {
 const root=new THREE.Group(),visual=new THREE.Group();root.add(visual);
 const handL=new THREE.Group();handL.name='HandL';handL.position.set(-.3,.21,.5);visual.add(handL);
 const handR=new THREE.Group();handR.name='HandR';handR.position.set(.3,.18,.5);visual.add(handR);
 const torso=new THREE.Group();torso.name='Torso';torso.position.y=.72;visual.add(torso);
 positionDamagedZombie(root,visual,new Set(['leg-l','leg-r']),0,3,1,.2,8);
 root.updateMatrixWorld(true);
 assert.ok(Math.abs(handR.getWorldPosition(new THREE.Vector3()).y-3.08)<.005);
 assert.equal(visual.rotation.x,0,'never rotate authored crawling animation');
 assert.ok(torso.getWorldPosition(new THREE.Vector3()).y>3.4);
});
