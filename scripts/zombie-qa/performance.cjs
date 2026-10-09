const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');const {spawn}=require('child_process');const fs=require('fs');const output=process.env.QA_OUTPUT || '/tmp/dead-city-qa';fs.mkdirSync(output,{recursive:true});const assert=require('assert/strict');
(async()=>{const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});await new Promise(r=>setTimeout(r,1500));const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true});await p.goto('http://127.0.0.1:8080');await p.waitForFunction(()=>window.__deadCity?.ready,{timeout:45000});await p.getByRole('button',{name:'START SURVIVING'}).click();
const results=await p.evaluate(async()=>{
 const e=window.__deadCity;e.reset();e.setPaused(true);e.wave=2;const output=[];
 for(const count of [0,6,12,18,0,18,0]) {
  for(const z of e.enemies)e.removeEnemy(z);e.enemies=[];e.queued=count;for(let i=0;i<count;i++)e.spawn();
  e.enemies.forEach((z,i)=>{z.x=(i%6-2.5)*1.2;z.z=-Math.floor(i/6)*2-4;z.root.position.set(z.x,0,z.z);});
  const frame=[];for(let i=0;i<12;i++){const start=performance.now();await new Promise(r=>requestAnimationFrame(r));frame.push(performance.now()-start);}
  const info=e.world.renderer.info;output.push({enemies:e.enemies.length,drawCalls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,meanFrameMs:frame.reduce((a,b)=>a+b,0)/frame.length,maxFrameMs:Math.max(...frame)});
 }
 return output;
});console.log(JSON.stringify(results,null,2));assert.equal(results[4].textures,results[6].textures,'no skeleton textures remain after cleanup');assert.equal(results[4].geometries,results[6].geometries,'shared geometry count returns to baseline');fs.writeFileSync(output+'/performance-results.json',JSON.stringify(results,null,2));
}finally{await b.close();server.kill();}})().catch(e=>{console.error(e);process.exit(1)});
