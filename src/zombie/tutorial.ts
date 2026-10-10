/** Standalone Dead City in-world tutorial; no replacement game or separate scene. */
export type TutorialAction = 'move'|'look'|'jump'|'shoot'|'switch'|'reload'|'pickup'|'ready';
export type TutorialMetrics = {
  x:number; z:number; lookPixels:number; jumps:number; shots:number;
  switches:number; reloads:number; pickups:number;
};
export type TutorialStep = {
  id:TutorialAction; title:string; instruction:string; hint:string; focus:string;
};
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {id:'move',title:'MOVE THROUGH THE CITY',
    instruction:'Use the left MOVE joystick to walk a few steps.',
    hint:'Desktop: W A S D. Keep moving to avoid the horde.',focus:'LEFT STICK'},
  {id:'look',title:'LOOK & AIM',
    instruction:'Swipe across OPEN SPACE to turn and aim with the white crosshair.',
    hint:'Do not swipe on buttons. Desktop: drag across the city.',focus:'OPEN SCREEN'},
  {id:'jump',title:'JUMP',
    instruction:'Tap JUMP while moving to clear obstacles.',
    hint:'Desktop: Spacebar.',focus:'JUMP BUTTON'},
  {id:'shoot',title:'FIRE YOUR WEAPON',
    instruction:'DOUBLE TAP open space to shoot. HOLD the SECOND tap for rapid fire. Fire 2 shots.',
    hint:'There is no FIRE button. Desktop: click and hold.',focus:'DOUBLE TAP + HOLD'},
  {id:'switch',title:'SWITCH WEAPONS',
    instruction:'Tap the weapon/ammo box at bottom-right to cycle PISTOL → RIFLE → SHOTGUN.',
    hint:'Different guns deal different damage and use separate ammo.',focus:'WEAPON BOX'},
  {id:'reload',title:'RELOAD',
    instruction:'Tap RELOAD to refill your current magazine from spare ammo.',
    hint:'Grab ammo crates around the map when supplies run low. Desktop: R.',focus:'RELOAD BUTTON'},
  {id:'pickup',title:'FIND SUPPLIES',
    instruction:'Follow the faint guide line to a pickup. Walk over it to collect automatically.',
    hint:'Minimap: yellow = ammo, white cross = health, green = zombies, blue = HubSide portal.',focus:'MAP + PICKUPS'},
  {id:'ready',title:'SURVIVE THE WAVES',
    instruction:'You are ready. Keep moving, aim for heads, collect supplies and survive each wave.',
    hint:'Quick kills build a score multiplier. ☰ pauses; ♫ METAL adjusts music.',focus:'START WAVES'},
];
export function tutorialComplete(step:TutorialAction,baseline:TutorialMetrics,now:TutorialMetrics){
  switch(step){
    case 'move':return Math.hypot(now.x-baseline.x,now.z-baseline.z)>=2;
    case 'look':return now.lookPixels-baseline.lookPixels>=65;
    case 'jump':return now.jumps>baseline.jumps;
    case 'shoot':return now.shots-baseline.shots>=2;
    case 'switch':return now.switches>baseline.switches;
    case 'reload':return now.reloads>baseline.reloads;
    case 'pickup':return now.pickups>baseline.pickups;
    case 'ready':return true;
  }
}
