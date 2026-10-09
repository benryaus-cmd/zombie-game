const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {spawn}=require('child_process');const fs=require('fs');const output=process.env.QA_OUTPUT || '/tmp/dead-city-qa';fs.mkdirSync(output,{recursive:true});const assert=require('assert/strict');
(async()=>{const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});await new Promise(r=>setTimeout(r,1500));
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[],requests=[];p.on('pageerror',e=>errors.push(e.message));p.on('requestfailed',r=>requests.push(r.url()));
await p.goto('http://127.0.0.1:8080');await p.waitForFunction(()=>window.__deadCity?.ready,{timeout:45000});await p.getByRole('button',{name:'START SURVIVING'}).click();await p.waitForTimeout(500);
const results=await p.evaluate(async()=>{
 const e=window.__deadCity,THREE=await import('/node_modules/.vite/deps/three.js'),parts=await import('/src/zombie/bodyParts.ts');
 const check=(ok,name)=>{if(!ok)throw new Error(name);return name;};const pass=[];
 cancelAnimationFrame(e.frame);const render=e.world.renderer.render.bind(e.world.renderer);e.world.renderer.render=()=>{};
 let time=e.lastFrame;const step=(n=1)=>{for(let i=0;i<n;i++){time+=50;e.tick(time);cancelAnimationFrame(e.frame);}};
 e.reset();step(28);pass.push(check(e.wave===1&&e.queued+e.enemies.length===7,'wave one starts with seven enemies'));
 step(160);pass.push(check(e.enemies.length>0,'normal spawns produce full-body enemies'));
 const types=e.enemies.map(z=>z.root.children[0].getObjectByName('part-head-Zombie')?.type);pass.push(check(types.some(Boolean),'prepared full body is loaded'));
 let enemy=e.enemies[0];const spheres=parts.bodySpheres(enemy.root,enemy.missing);pass.push(check(new Set(spheres.map(s=>s.region)).size===6,'actual skeleton provides head torso arms and legs'));
 const originalColliders=e.world.colliders;e.world.colliders=[];
 // Test the same gun alignment and shot code used by the running game.
 enemy.x=0;enemy.z=-3;enemy.root.position.set(0,0,-3);enemy.mixer.update(.001);enemy.root.updateMatrixWorld(true);
 let head=parts.bodySpheres(enemy.root,enemy.missing).find(s=>s.region==='head');
 e.world.camera.lookAt(head.center);e.avatar.animate(0,false,false,head.center,false);e.equip('pistol');e.nextShot=0;const kills=e.kills;e.shoot();
 pass.push(check(enemy.deadAt>0&&e.kills===kills+1,'pistol headshot kills exactly once'));
 pass.push(check(enemy.missing.has('head')&&e.debris.length===1,'headshot detaches the actual prepared head'));
 const piece=e.debris[0];pass.push(check(piece.root.children.every(m=>m.geometry.getAttribute('position').count<3000),'detached geometry is compact'));
 e.kill(enemy);pass.push(check(e.kills===kills+1,'dead enemy cannot be counted twice'));
 const before=e.health;e.updateEnemy(enemy,.05,e.elapsed+.05);pass.push(check(e.health===before,'dead zombie cannot attack'));
 e.ammo.pistol=3;e.reload();step(25);pass.push(check(e.ammo.pistol===12&&e.reserve.pistol===87,'reload transfers exact rounds from reserve'));
 e.equip('rifle');e.ammo.rifle=27;e.reload();e.equip('shotgun');pass.push(check(e.reloadTimer===0&&e.weapon==='shotgun','weapon switch cancels reload'));
 // Shotgun close arm hit with isolated body region, all other enemies removed from hit selection.
 for(const z of e.enemies)e.removeEnemy(z);e.enemies=[];e.queued=1;e.spawn();enemy=e.enemies[0];enemy.x=0;enemy.z=-3;enemy.root.position.set(0,0,-3);enemy.mixer.update(.001);enemy.root.updateMatrixWorld(true);
 const arm=parts.bodySpheres(enemy.root,enemy.missing).find(s=>s.region==='arm-l');e.world.camera.lookAt(arm.center);e.avatar.animate(0,false,false,arm.center,false);e.nextShot=0;e.shoot();
 pass.push(check(enemy.missing.has('arm-l'),'close shotgun arm hit removes matching arm'));
 // A low leg shot switches to the actual packaged Crawl animation.
 for(const z of e.enemies)e.removeEnemy(z);e.enemies=[];e.queued=1;e.spawn();enemy=e.enemies[0];enemy.x=0;enemy.z=-3;enemy.root.position.set(0,0,-3);enemy.mixer.update(.001);enemy.root.updateMatrixWorld(true);
 const leg=parts.bodySpheres(enemy.root,enemy.missing).filter(s=>s.region==='leg-r').sort((a,b)=>a.center.y-b.center.y)[1];
 e.world.camera.lookAt(leg.center);e.avatar.animate(0,false,false,leg.center,false);e.nextShot=0;e.shoot();
 pass.push(check(enemy.missing.has('leg-r'),'close shotgun leg hit removes matching leg'));
 enemy.reactUntil=0;e.world.playerPosition.set(0,1.72,5);e.updateEnemy(enemy,.05,e.elapsed+.1);
 pass.push(check(enemy.anim==='Crawl' || enemy.deadAt>0,'leg loss uses packaged crawl or death'));
 // Exercise obstacle navigation with the same updateEnemy code and an actual collider.
 for(const z of e.enemies)e.removeEnemy(z);e.enemies=[];e.queued=1;e.spawn();enemy=e.enemies[0];enemy.x=0;enemy.z=3;enemy.root.position.set(0,0,3);e.world.playerPosition.set(0,1.72,-3);
 e.world.colliders=[{minX:-1,maxX:1,minY:0,maxY:3,minZ:-1,maxZ:1}];let inside=false;
 for(let i=0;i<220;i++){e.updateEnemy(enemy,.05,e.elapsed+i*.05);if(Math.abs(enemy.x)<1.44&&Math.abs(enemy.z)<1.44)inside=true;}
 pass.push(check(!inside&&Math.hypot(enemy.x,enemy.z+3)<1.3,'zombie routes around a building without tunnelling'));
 e.world.playerPosition.set(0,1.72,5);e.world.colliders=[];
 // Occlusion tested from camera and muzzle independently.
 for(const z of e.enemies)e.removeEnemy(z);e.enemies=[];e.queued=1;e.spawn();enemy=e.enemies[0];enemy.x=0;enemy.z=-3;enemy.root.position.set(0,0,-3);enemy.root.updateMatrixWorld(true);
 head=parts.bodySpheres(enemy.root,enemy.missing).find(s=>s.region==='head');e.world.camera.lookAt(head.center);e.avatar.animate(0,false,false,head.center,false);e.equip('pistol');
 e.world.colliders=[{minX:-4,maxX:4,minY:0,maxY:5,minZ:0,maxZ:1}];e.nextShot=0;const hp=enemy.hp;e.shoot();pass.push(check(enemy.hp===hp,'solid wall stops camera ray'));
 e.world.colliders=[];const muzzle=e.avatar.muzzlePosition();e.world.colliders=[{minX:muzzle.x-.1,maxX:muzzle.x+.1,minY:muzzle.y-.1,maxY:muzzle.y+.1,minZ:muzzle.z-.1,maxZ:muzzle.z+.1}];e.nextShot=0;e.shoot();pass.push(check(enemy.hp===hp,'blocked muzzle stops otherwise clear camera shot'));
 e.world.colliders=[];
 // Waves through the real engine using aim-at-head assisted shots, simulation without software rendering.
 e.reset();for(let wave=1;wave<=3;wave++) {
  step(90);
  for(let guard=0;guard<1000&&e.wave===wave;guard++) {
   step(8);const z=e.enemies.find(z=>!z.deadAt);if(!z)continue;
   const h=parts.bodySpheres(z.root,z.missing).find(s=>s.region==='head');if(!h)continue;
   e.world.camera.lookAt(h.center);e.avatar.animate(0,false,false,h.center,false);e.nextShot=0;if(!e.ammo.pistol){e.reload();step(25);}e.shoot();
  }
  pass.push(check(e.wave===wave+1,'combat clears wave '+wave+' and advances'));
 }
 e.move({x:1,y:1});e.look({x:1,y:1});e.keys.add('KeyW');e.fire(true);e.setPaused(true);const pos=e.world.playerPosition.clone(),health=e.health;step(20);
 pass.push(check(pos.distanceTo(e.world.playerPosition)===0&&e.health===health&&!e.firing&&e.controls.movement.x===0,'pause freezes combat and clears held controls'));
 e.setPaused(false);e.health=1;for(const z of e.enemies)e.removeEnemy(z);e.enemies=[];e.queued=1;e.spawn();enemy=e.enemies[0];enemy.x=e.world.playerPosition.x+.5;enemy.z=e.world.playerPosition.z;enemy.root.position.set(enemy.x,0,enemy.z);enemy.hitAt=-100;e.updateEnemy(enemy,.05,e.elapsed);
 pass.push(check(e.over&&e.health===0,'zombie attack causes player death'));
 e.reset();pass.push(check(!e.over&&e.health===100&&e.wave===0&&e.enemies.length===0&&e.debris.length===0&&e.ammo.pistol===12&&!e.firing,'restart resets health waves ammo enemies debris and inputs'));
 e.world.colliders=originalColliders;step(30);e.world.renderer.render=render;render(e.world.scene,e.world.camera);e.lastFrame=performance.now();e.frame=requestAnimationFrame(e.tick);
 return {pass,kills:e.kills,requests:e.world.renderer.info.memory,elapsed:e.elapsed};
});console.log(JSON.stringify(results,null,2));fs.writeFileSync(output+'/integration-results.json',JSON.stringify({results,errors,requests},null,2));
await p.screenshot({path:output+'/portrait-gameplay.png'});console.log('errors',errors,'failed requests',requests.length);
}finally{await b.close();server.kill();}})().catch(e=>{console.error(e);process.exit(1)});
