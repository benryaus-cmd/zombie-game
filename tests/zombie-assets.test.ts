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

test('23 CC0 audio assets are present and have valid RIFF/WAVE or OGG headers',()=>{
 const soundNames=[
   ...[0,1,2].map(i=>'pistol-'+i+'.wav'),
   ...[0,1,2].map(i=>'rifle-'+i+'.wav'),
   ...[0,1].map(i=>'shotgun-'+i+'.wav'),
   ...[1,3,4,5,6,7,8,9,10,11,12].map(i=>'zombie-'+i+'.wav'),
   'reload.ogg','reload-rifle.ogg','reload-shotgun.ogg',
   'empty-click.ogg','bullet-impact-0.ogg','bullet-impact-1.ogg'
 ];
 soundNames.push('combo-up.ogg','combo-hit.ogg','combo-big.ogg','war-stinger-0.ogg','war-stinger-1.ogg','war-stinger-2.ogg','war-explosion.wav','war-fire-crackle.ogg');
 assert.equal(soundNames.length,33);
 for(const name of soundNames){
   const bytes=fs.readFileSync('public/audio/sfx/'+name);
   assert.ok(bytes.length>100,name+' must not be empty');
   assert.equal(bytes.toString('ascii',0,4),name.endsWith('.ogg')?'OggS':'RIFF',name);
 }
});
