import test from 'node:test';
import assert from 'node:assert/strict';
import { lampFlickerMultiplier } from '../src/game/cityAtmosphere';
import { DEFAULT_TUNING } from '../src/zombie/tuning';

const config={strength:1,idle:.09,rate:1.3,chance:.68,duration:.9,peak:1.75,invert:0};

test('streetlights stay OFF-first by default, with ON-first inversion switch',()=>{
 assert.equal(lampFlickerMultiplier(11,-4,0,{...config,strength:0,invert:0}),.09);
 assert.equal(lampFlickerMultiplier(11,-4,0,{...config,strength:0,invert:1}),1.75);
});
test('inverting the mode flips the baseline and intermittent light pulses',()=>{
 let offDefault=0,onDefault=0,simultaneous=0;
 for(let i=0;i<600;i++){
  const time=i*.1;
  const off=lampFlickerMultiplier(11,-4,time,config);
  const on=lampFlickerMultiplier(11,-4,time,{...config,invert:1});
  assert.ok(off>=.09-.000001&&off<=1.75+.000001);
  assert.ok(on>=.09-.000001&&on<=1.75+.000001);
  if(off===.09)offDefault++;
  if(on===1.75)onDefault++;
  if(off>.09 && on<1.75)simultaneous++;
 }
 assert.ok(offDefault>100 && onDefault>100,'both modes preserve the baseline');
 assert.ok(simultaneous>10,'a pulse lights OFF-first lamps while dimming ON-first lamps');
});
test('streetlight flicker with chance zero stays at chosen steady mode',()=>{
 for(let invert=0;invert<=1;invert++){
  const first=lampFlickerMultiplier(14,16,12.34,{...config,invert,chance:0});
  assert.equal(first,invert?config.peak:config.idle);
 }
});

test('8m player-to-lamp flash radius prevents ALL distant lamp flickering',()=>{
 const nearby={x:11+7.99,z:-4};
 const beyond={x:11+8.01,z:-4};
 const options={...config,flashDistance:8,peak:1.5,idle:0,chance:1,strength:3};
 for(const invert of [0,1]){
   const setting={...options,invert};
   const baseline=invert?setting.peak:setting.idle;
   let nearPulses=0;
   for(let i=0;i<600;i++){
     const time=i*.07;
     const far=lampFlickerMultiplier(11,-4,time,setting,beyond);
     const near=lampFlickerMultiplier(11,-4,time,setting,nearby);
     assert.equal(far,baseline,'a lamp beyond 8m never flickers, regardless of time');
     if(near!==baseline)nearPulses++;
   }
   assert.ok(nearPulses>10,'lamps inside 8m retain the flicker effect');
 }
});
test('flash radius zero disables flashing but not steady lighting',()=>{
 const setting={...config,flashDistance:0,chance:1,strength:3};
 for(const invert of [0,1]){
   assert.equal(lampFlickerMultiplier(5,5,123,{...setting,invert},{x:6,z:5}),invert?setting.peak:setting.idle);
 }
});

test('final 11 October lighting/rain/pickup defaults match the owner tuning',()=>{
 const wanted={
  pickupGuideOpacity:0,
  warLampInvert:1,warStreetFlicker:1,warLampIdle:0,
  warLampChance:.38,warLampRate:1.3,warLampDuration:.9,
  warLampPeak:1.2,warLampRange:.5,warLampWarmth:.1,
  warLampFlashDistance:9,rainCount:230,rainOpacity:.48,
  rainSpeed:1.1,rainLength:.8,rainWind:.4,rainRadius:7,rainBrightness:.6
 };
 assert.equal(Object.keys(DEFAULT_TUNING).length,131);
 for(const [key,value] of Object.entries(wanted))
   assert.equal(DEFAULT_TUNING[key as keyof typeof DEFAULT_TUNING],value,key);
});
test('final lighting: ON-first lamps only flicker OFF within 9m',()=>{
 const actual={
  strength:DEFAULT_TUNING.warStreetFlicker,
  idle:DEFAULT_TUNING.warLampIdle,
  chance:DEFAULT_TUNING.warLampChance,
  rate:DEFAULT_TUNING.warLampRate,
  duration:DEFAULT_TUNING.warLampDuration,
  peak:DEFAULT_TUNING.warLampPeak,
  invert:DEFAULT_TUNING.warLampInvert,
  flashDistance:DEFAULT_TUNING.warLampFlashDistance
 };
 const lamp={x:11,z:-4},near={x:11+8.99,z:-4},far={x:11+9.01,z:-4};
 let dips=0;
 for(let i=0;i<1500;i++){
   const time=i*.08;
   assert.equal(lampFlickerMultiplier(lamp.x,lamp.z,time,actual,far),1.2);
   const local=lampFlickerMultiplier(lamp.x,lamp.z,time,actual,near);
   assert.ok(local>=0 && local<=1.2);
   if(local<1.2)dips++;
 }
 assert.ok(dips>20,'nearby lamp must noticeably flicker OFF');
});
