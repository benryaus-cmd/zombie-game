import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
for (const name of ['Zombie_Basic','Zombie_Chubby']) test(name + ' prepared mesh covers real body regions without losing triangles', () => {
 const original = JSON.parse(fs.readFileSync('public/assets/zombie-kit/'+name+'.gltf','utf8'));
 const g = JSON.parse(fs.readFileSync('public/assets/zombie-kit/'+name+'-parts.gltf','utf8'));
 const regions = ['head','arm-l','arm-r','leg-l','leg-r','torso'];
 for (const r of regions) assert.ok(g.nodes.some((n:any)=>n.name?.startsWith('part-'+r+'-')), r);
 const count = (g:any) => g.nodes.filter((n:any)=>n.mesh!==undefined).flatMap((n:any)=>g.meshes[n.mesh].primitives).reduce((a:number,p:any)=>a+g.accessors[p.indices].count,0);
 assert.equal(count(g),count(original));
 assert.ok(g.buffers.every((b:any)=>b.uri.startsWith('data:')));
 assert.ok(g.animations.some((a:any)=>a.name==='Death'));
});
