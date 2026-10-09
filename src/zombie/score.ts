import { getTuning } from './tuning';
export const CALLOUTS = ['BRUTAL!', 'EAT LEAD, ZOMBIE!', 'DEAD WON’T DIE!', 'GET SOME!', 'SPLAT!', 'NO MERCY!', 'STAY DOWN!', 'HEADS UP!', 'UNDEAD? NOT ANYMORE!'];
export interface ScoreState { score:number; multiplier:number; comboCount:number; lastKill:number }
export const newScore=():ScoreState=>({score:0,multiplier:1,comboCount:0,lastKill:-Infinity});
export function awardKill(state:ScoreState,now:number,headshot:boolean,severed:boolean,random:number=Math.random()) {
 const t=getTuning(), consecutive=now-state.lastKill<=t.comboWindow;
 const comboCount=consecutive?state.comboCount+1:1;
 const multiplier=Math.min(t.maxMultiplier,Math.max(1,comboCount));
 const points=Math.round(t.killPoints*multiplier+(headshot?t.headshotBonus:0)+(severed?t.severBonus:0));
 const next:ScoreState={score:state.score+points,multiplier,comboCount,lastKill:now};
 const callout=(headshot&&severed?'HEADS UP!':CALLOUTS[Math.min(CALLOUTS.length-1,Math.floor(random*CALLOUTS.length))]);
 return {next,points,callout};
}
export const comboRemaining=(state:ScoreState,now:number)=>Math.max(0,getTuning().comboWindow-(now-state.lastKill));
