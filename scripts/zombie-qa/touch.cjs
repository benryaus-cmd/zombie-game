const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');const {spawn}=require('child_process');const assert=require('assert/strict');const fs=require('fs');const output=process.env.QA_OUTPUT || '/tmp/dead-city-qa';fs.mkdirSync(output,{recursive:true});
(async()=>{const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1'],{cwd:process.cwd(),stdio:'ignore'});await new Promise(r=>setTimeout(r,1500));const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true});await p.goto('http://127.0.0.1:8080');await p.waitForFunction(()=>window.__deadCity?.ready,{timeout:45000});await p.getByRole('button',{name:'START SURVIVING'}).click();const cdp=await p.context().newCDPSession(p);let points=[];const send=async(type)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});const results=[];
for(const mode of ['portrait','forced','landscape','short']) {
 if(mode==='forced'){await p.getByRole('button',{name:'Pause game'}).click();await p.getByRole('button',{name:'LANDSCAPE',exact:true}).click();await p.getByRole('button',{name:'RESUME',exact:true}).click();}
 if(mode==='landscape')await p.setViewportSize({width:844,height:390});
 if(mode==='short'){await p.setViewportSize({width:384,height:606});await p.getByRole('button',{name:'Pause game'}).click();await p.getByRole('button',{name:'PORTRAIT',exact:true}).click();await p.getByRole('button',{name:'RESUME',exact:true}).click();}
 await p.waitForTimeout(350);await p.evaluate(()=>{const e=window.__deadCity;e.equip('rifle');e.ammo.rifle=30;e.world.playerYaw=0;e.world.playerPitch=0;e.health=100;});
 const rect=async(sel)=>{const r=await p.locator(sel).boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2}};
 const move=await rect('.joystick:not(.look-joystick)'),look=await rect('.look-joystick'),fire=await rect('.zombie-fire');const rot=mode==='forced';
 points=[{id:1,x:move.x+(rot?-20:0),y:move.y+(rot?0:-20)}];await send('touchStart');
 points.push({id:2,x:look.x+(rot?0:25),y:look.y+(rot?-25:0)});await send('touchStart');
 points.push({id:3,...fire});await send('touchStart');await p.waitForTimeout(400);
 const first=await p.evaluate(()=>({yaw:window.__deadCity.world.playerYaw,pitch:window.__deadCity.world.playerPitch,movement:window.__deadCity.controls.movement,look:window.__deadCity.controls.lookInput,firing:window.__deadCity.firing,ammo:window.__deadCity.ammo.rifle}));
 assert(first.look.x>.5,mode+' stick right normalized');assert(first.yaw<0,mode+' right turns right');assert(first.movement.y>.3,mode+' movement up');assert(first.firing&&first.ammo<30,mode+' three finger firing');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:points.filter(p=>p.id===1)});points=points.filter(p=>p.id!==1);await p.waitForTimeout(300);const after=await p.evaluate(()=>({firing:window.__deadCity.firing,ammo:window.__deadCity.ammo.rifle}));assert(after.firing,mode+' lifting movement keeps firing');assert(after.ammo<first.ammo,mode+' ammo continues after movement release');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:points.filter(p=>p.id===2)});points=points.filter(p=>p.id!==2);assert(await p.evaluate(()=>window.__deadCity.firing),mode+' lifting look keeps firing');points=[];await send('touchEnd');assert(!await p.evaluate(()=>window.__deadCity.firing),mode+' fire release stops');
 // Up and down look must map through rotation too.
 for(const sign of [1,-1]) {await p.evaluate(()=>window.__deadCity.world.playerPitch=0);points=[{id:4,x:look.x+(rot?-25*sign:0),y:look.y+(rot?0:-25*sign)}];await send('touchStart');await p.waitForTimeout(200);const pitch=await p.evaluate(()=>window.__deadCity.world.playerPitch);assert(pitch*sign>0,mode+' pitch '+sign);points=[];await send('touchEnd');}
 const boxes=await p.locator('.zombie-fire,.zombie-ammo,.look-joystick,.joystick:not(.look-joystick),.zombie-jump').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return [r.left,r.top,r.right,r.bottom]}));const size=p.viewportSize();for(const box of boxes)assert(box[0]>=-1&&box[1]>=-1&&box[2]<=size.width+1&&box[3]<=size.height+1,mode+' controls fit');
 results.push({mode,first,after});console.log('PASS',mode);await p.screenshot({path:output+'/touch-'+mode+'.png'});
}
await p.reload();await p.waitForFunction(()=>window.__deadCity?.ready);assert.equal(await p.locator('.zombie-root').getAttribute('data-orientation'),'portrait');console.log('PASS saved orientation');
fs.writeFileSync(output+'/touch-results.json',JSON.stringify(results,null,2));
}finally{await b.close();server.kill();}})().catch(e=>{console.error(e);process.exit(1)});
