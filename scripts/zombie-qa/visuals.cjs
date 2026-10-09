const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {spawn}=require('child_process');const fs=require('fs');const output=process.env.QA_OUTPUT || '/tmp/dead-city-qa';fs.mkdirSync(output,{recursive:true});
(async()=>{const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});
await new Promise(r=>setTimeout(r,1500));const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,200))});
await p.goto('http://127.0.0.1:8080');await p.getByRole('button',{name:'START SURVIVING'}).waitFor();await p.waitForFunction(()=>window.__deadCity?.ready,{timeout:45000});await p.getByRole('button',{name:'START SURVIVING'}).click();await p.waitForTimeout(2500);
await p.evaluate(()=>{const e=window.__deadCity;e.wave=1;e.queued=4;e.countdown=4;for(let i=0;i<4;i++)e.spawn();const coords=[[-1,-3],[1,-4],[2,-7],[-2,-6]];e.enemies.forEach((z,i)=>{z.x=coords[i][0];z.z=coords[i][1];z.root.position.set(z.x,0,z.z);});e.emitHud();});
await p.waitForTimeout(500);await p.screenshot({path:output+'/portrait-gameplay.png'});
for(const w of ['PISTOL','RIFLE','SHOTGUN']) {
 await p.getByRole('button',{name:w,exact:true}).click();await p.waitForTimeout(250);
 await p.evaluate(()=>{const e=window.__deadCity;e.setPaused(true);const pos=e.world.playerPosition.clone();e.world.camera.position.copy(pos).add({x:3,y:.1,z:1});e.world.camera.lookAt(pos.x,pos.y-.4,pos.z-.4);});
 await p.waitForTimeout(200);await p.screenshot({path:output+'/grip-'+w.toLowerCase()+'.png'});
 await p.evaluate(()=>window.__deadCity.setPaused(false));await p.waitForTimeout(150);
}
await p.getByRole('button',{name:'Pause game'}).click();await p.getByRole('button',{name:'LANDSCAPE',exact:true}).click();await p.getByRole('button',{name:'RESUME',exact:true}).click();await p.waitForTimeout(300);await p.screenshot({path:output+'/forced-landscape.png'});
await p.setViewportSize({width:844,height:390});await p.waitForTimeout(300);await p.screenshot({path:output+'/landscape.png'});
console.log('ERRORS',JSON.stringify(errors));
fs.writeFileSync(output+'/initial-results.json',JSON.stringify({errors},null,2));
}finally{await b.close();server.kill();}})().catch(e=>{console.error(e);process.exit(1)});
