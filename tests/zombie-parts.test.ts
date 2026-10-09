import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shareSkeletons, detachRegion, disposeDebris, updateDebris } from '../src/zombie/bodyParts';
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
