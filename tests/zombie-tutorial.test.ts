import test from 'node:test';
import assert from 'node:assert/strict';
import { TUTORIAL_STEPS, tutorialComplete, type TutorialMetrics } from '../src/zombie/tutorial';

const base:TutorialMetrics={x:0,z:5,lookPixels:0,jumps:0,shots:0,switches:0,reloads:0,pickups:0};
test('tutorial contains all actual Dead City input lessons, ending with a wave handoff',()=>{
 assert.deepEqual(TUTORIAL_STEPS.map(x=>x.id),['move','look','jump','shoot','switch','reload','pickup','ready']);
 assert.ok(TUTORIAL_STEPS.every(x=>x.title&&x.instruction&&x.hint&&x.focus));
 assert.match(TUTORIAL_STEPS.find(x=>x.id==='shoot')!.instruction,/DOUBLE TAP.*HOLD/);
 assert.match(TUTORIAL_STEPS.find(x=>x.id==='ready')!.instruction,/wave/i);
});
test('move step requires real walking, not just touching the joystick',()=>{
 assert.equal(tutorialComplete('move',base,{...base,x:1,z:6}),false);
 assert.equal(tutorialComplete('move',base,{...base,x:2.1}),true);
});
test('look and shooting require actual action progress',()=>{
 assert.equal(tutorialComplete('look',base,{...base,lookPixels:64}),false);
 assert.equal(tutorialComplete('look',base,{...base,lookPixels:66}),true);
 assert.equal(tutorialComplete('shoot',base,{...base,shots:1}),false);
 assert.equal(tutorialComplete('shoot',base,{...base,shots:2}),true);
});
test('jump, weapon switch, successful reload and pickup each have their own trigger',()=>{
 for(const key of ['jumps','switches','reloads','pickups'] as const){
   const id=({jumps:'jump',switches:'switch',reloads:'reload',pickups:'pickup'} as const)[key];
   assert.equal(tutorialComplete(id,base,base),false);
   assert.equal(tutorialComplete(id,base,{...base,[key]:1}),true);
 }
 assert.equal(tutorialComplete('ready',base,base),true);
});
