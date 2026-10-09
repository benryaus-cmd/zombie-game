import test from 'node:test';
import assert from 'node:assert/strict';
import { awardKill,newScore,comboRemaining } from '../src/zombie/score';
import { setTuning,resetTuning } from '../src/zombie/tuning';
test('quick kills build multiplier and timeout resets it',()=>{
 resetTuning();
 let score=newScore();
 const first=awardKill(score,1,false,false,0);score=first.next;
 assert.equal(score.multiplier,1);assert.equal(score.score,100);
 const second=awardKill(score,2,false,false,0);score=second.next;
 assert.equal(score.multiplier,2);assert.equal(score.score,300);
 assert.ok(comboRemaining(score,3)>0);
 const expired=awardKill(score,9,false,false,0);
 assert.equal(expired.next.multiplier,1);
 assert.equal(expired.next.comboCount,1);
});
test('headshots and severed parts award extras; new settings apply',()=>{
 resetTuning();setTuning('killPoints',150);
 const got=awardKill(newScore(),0,true,true,0);
 assert.equal(got.points,225);
 resetTuning();
});