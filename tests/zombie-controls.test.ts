import test from 'node:test';
import assert from 'node:assert/strict';
import { aimAngles, dragDelta, readOrientation, releaseFirePointer, isTap, isSecondTap } from '../src/zombie/controls';
test('portrait default and stored landscape', () => {
 assert.equal(readOrientation(null), 'portrait'); assert.equal(readOrientation('junk'), 'portrait'); assert.equal(readOrientation('landscape'), 'landscape');
});
test('right look reduces yaw, up look increases pitch, drag matches stick', () => {
 assert.ok(aimAngles(0,0,1,0,.1).yaw < 0); assert.ok(aimAngles(0,0,0,1,.1).pitch > 0);
 assert.ok(aimAngles(0,0,0,-1,.1).pitch < 0);assert.equal(aimAngles(0,.68,0,1,10).pitch,.68);
 assert.deepEqual(dragDelta(20,-10,false),{x:20,y:-10});assert.deepEqual(dragDelta(20,-10,true),{x:10,y:20});
});
test('lifting movement/look finger does not release fire pointer', () => {
 assert.equal(releaseFirePointer(3,1),3);assert.equal(releaseFirePointer(3,2),3);assert.equal(releaseFirePointer(3,3),null);
});

test('second tap shoots, while a swipe or unrelated area does not', () => {
 const first={x:200,y:400,at:100};
 assert.equal(isTap(first,{x:205,y:404,at:215}),true);
 assert.equal(isTap(first,{x:260,y:400,at:200}),false);
 assert.equal(isTap(first,{x:200,y:400,at:500}),false);
 assert.equal(isSecondTap({x:205,y:404,at:215},{x:210,y:412,at:390}),true);
 assert.equal(isSecondTap({x:205,y:404,at:215},{x:210,y:412,at:615}),false);
 assert.equal(isSecondTap({x:205,y:404,at:215},{x:550,y:412,at:390}),false);
 assert.equal(isSecondTap(null,{x:210,y:412,at:390}),false);
});
