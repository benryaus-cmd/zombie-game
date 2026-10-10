/** Dead City temporary developer tuning surface. Delete this file and its panel import when finished testing. */
export const TUNING = {
  // Developer test convenience
  safeWhileTuning: ['No player damage while editor open (1=yes)','Developer',1,0,1,1],
  // Touch and player
  moveSpeed: ['Movement speed','Movement',7,1,20,.25],
  jumpPower: ['Jump force','Movement',7.2,1,18,.2],
  swipeX: ['Swipe horizontal','Movement',0.009,.001,.025,.0005],
  swipeY: ['Swipe vertical','Movement',.004,.001,.025,.0005],
  lookStickSpeed: ['Look speed','Movement',3.9,.2,9,.1],
  // Camera framing
  cameraFOV: ['Camera field of view','Camera',86,35,115,1],
  cameraPortraitDistance: ['Portrait camera distance','Camera',4.4,1,12,.2],
  cameraLandscapeDistance: ['Landscape camera distance','Camera',3.3,1,12,.2],
  cameraShoulder: ['Camera shoulder offset','Camera',.85,-3,3,.05],
  cameraHeight: ['Camera height offset','Camera',1.48,-2,4,.05],
  aimDistance: ['Aim target distance','Camera',12,2,50,1],
  aimPitchDistance: ['Pitch target scale','Camera',15.3,1,40,.5],
  pitchMinimum: ['Maximum look down (rad)','Camera',-.68,-1.5,0,.02],
  pitchMaximum: ['Maximum look up (rad)','Camera',.68,0,1.5,.02],
  // Weapons
  pistolDamage: ['Pistol base damage','Weapons',34,1,180,1],
  rifleDamage: ['Rifle base damage','Weapons',27,1,180,1],
  shotgunDamage: ['Shotgun pellet damage','Weapons',22,1,120,1],
  pistolDelay: ['Pistol shot delay (s)','Weapons',.32,.06,2,.01],
  rifleDelay: ['Rifle shot delay (s)','Weapons',.11,.04,1,.01],
  shotgunDelay: ['Shotgun shot delay (s)','Weapons',.85,.09,2,.01],
  pistolSpread: ['Pistol spread','Weapons',.005,0,.1,.001],
  rifleSpread: ['Rifle spread','Weapons',.01,0,.1,.001],
  shotgunSpread: ['Shotgun spread','Weapons',.048,0,.18,.002],
  shotgunPellets: ['Shotgun pellets','Weapons',9,1,24,1],
  reloadPistol: ['Pistol reload (s)','Weapons',1.2,.1,6,.1],
  reloadRifle: ['Rifle reload (s)','Weapons',1.7,.1,6,.1],
  reloadShotgun: ['Shotgun reload (s)','Weapons',2,.1,6,.1],
  // Feedback
  hapticPistol: ['Pistol vibration (ms)','Effects',10,0,60,1],
  hapticRifle: ['Rifle vibration (ms)','Effects',7,0,60,1],
  hapticShotgun: ['Shotgun vibration (ms)','Effects',17,0,100,1],
  kickPistol: ['Camera kick pistol','Effects',.082,0,.5,.005],
  kickRifle: ['Camera kick rifle','Effects',.043,0,.5,.005],
  kickShotgun: ['Camera kick shotgun','Effects',.15,0,.7,.005],
  shakeX: ['Camera shake X','Effects',.23,0,3,.05],
  shakeY: ['Camera shake Y','Effects',.28,0,3,.05],
  shakeZ: ['Camera shake Z','Effects',.0,0,3,.05],
  shakeDecay: ['Camera shake decay','Effects',.65,.05,5,.05],
  gunRecoil: ['Gun arm kick scale','Effects',2,0,4,.1],
  flashScale: ['Muzzle flash size','Effects',2.5,.1,6,.1],
  flashTime: ['Flash duration (s)','Effects',0.02,.01,.4,.01],
  tracerTime: ['Tracer duration (s)','Effects',0.02,.02,.8,.01],
  tracerOpacity: ['Tracer brightness','Effects',1,.05,1,.05],
  tracerLength: ['Tracer segment length','Effects',30,.3,30,.5],
  bloodAmount: ['Blood burst quantity','Effects',2,0,6,.1],
  bloodSize: ['Blood particle size','Effects',.17,.04,.7,.01],
  bloodLifetime: ['Ground stain time (s)','Effects',22,1,90,1],
  corpseTime: ['Corpse cleanup (s)','Effects',3,.3,15,.1],
  debrisTime: ['Flying limb cleanup (s)','Effects',2,.25,15,.25],
  debrisForce: ['Limb explosion force','Effects',5,0,20,.25],
  debrisLift: ['Limb upward velocity','Effects',2.8,0,15,.25],
  debrisGravity: ['Limb gravity','Effects',9.8,1,25,.2],
  debrisBounce: ['Limb bounce','Effects',.28,0,.9,.02],
  maxDebris: ['Max floating limbs','Effects',24,2,75,1],
  // Zombies & waves
  baseZombieHP: ['Basic zombie health','Zombies',68,1,400,1],
  heavyZombieHP: ['Heavy zombie health','Zombies',150,1,700,1],
  zombieSpeed: ['Zombie base speed','Zombies',1.55,.1,7,.05],
  speedPerWave: ['Speed increase / wave','Zombies',.16,0,1,.01],
  hopSpeed: ['One-leg move multiplier','Zombies',0.9,.05,1.5,.05],
  crawlSpeed: ['No-legs crawl multiplier','Zombies',1,.02,1,.01],
  hopHeight: ['One-leg hop height','Zombies',.18,0,.8,.02],
  hopFrequency: ['Hop frequency','Zombies',9,1,25,.5],
  attackDamage: ['Zombie attack damage','Zombies',11,0,80,1],
  attackInterval: ['Attack interval (s)','Zombies',1.12,.1,6,.02],
  zombieCap: ['Maximum active zombies','Zombies',18,1,50,1],
  spawnInterval: ['Spawn gap (s)','Zombies',.85,.1,5,.05],
  waveBase: ['Wave starting enemies','Zombies',4,1,20,1],
  waveGrowth: ['Additional per wave','Zombies',3,0,15,1],
  betweenWaves: ['Break between waves (s)','Zombies',4,.5,15,.5],
  // Sound mix (all backed by local CC0 files)
  masterVolume: ['Master volume','Audio',.8,0,1,.05],
  weaponVolume: ['Weapon volume','Audio',1,0,2,.05],
  zombieVolume: ['Zombie voice volume','Audio',.8,0,2,.05],
  uiVolume: ['Reload/click volume','Audio',.7,0,2,.05],
  zombieAudibleDistance: ['Zombie audio range (m)','Audio',20,2,150,1],
  zombieRefDistance: ['Near zombie distance (m)','Audio',4,.5,30,.5],
  zombieRolloff: ['Zombie distance rolloff','Audio',1.25,.1,5,.1],
  zombieVoiceLimit: ['Maximum active zombie voices','Audio',6,1,24,1],
  zombieMinGap: ['Minimum vocal gap (s)','Audio',.25,0,3,.05],
  zombieGroanInterval: ['Average groan interval (s)','Audio',9,1,45,1],
  zombiePitchVariation: ['Random zombie pitch variance','Audio',.14,0,.6,.02],
  gunPitchVariation: ['Random gun pitch variance','Audio',0.3,0,.3,.01],
  // Dismemberment & sound rewards
  stumpBleedSeconds: ['Stump bleeding duration (s)','Effects',2,0,10,.25],
  stumpBleedInterval: ['Stump blood pulse interval (s)','Effects',.2,.06,1,.02],
  stumpBleedStrength: ['Stump blood spray size','Effects',1.4,0,8,.2],
  comboVolume: ['Multiplier stinger volume','Audio',.55,0,2,.05],
  // Scoring
  killPoints: ['Base points per kill','Score',100,1,2000,10],
  comboWindow: ['Quick-kill window (s)','Score',4,.3,15,.25],
  maxMultiplier: ['Max score multiplier','Score',8,1,30,1],
  headshotBonus: ['Headshot point bonus','Score',50,0,1000,10],
  severBonus: ['Sever point bonus','Score',25,0,1000,5],
} as const satisfies Record<string, readonly [string,string,number,number,number,number]>;
export type TuneKey = keyof typeof TUNING;
export type TuneValues = Record<TuneKey, number>;
const KEY = 'dead-city-debug-values-v1';
const keys = Object.keys(TUNING) as TuneKey[];
export const DEFAULT_TUNING = Object.fromEntries(keys.map(k => [k, TUNING[k][2]])) as TuneValues;
export function validateTune(key: TuneKey, n: number) {
  const [, , initial,min,max] = TUNING[key];
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : initial;
}
function restore(): TuneValues {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && typeof saved === 'object') return Object.fromEntries(keys.map(k => [k, validateTune(k,Number(saved[k] ?? DEFAULT_TUNING[k]))])) as TuneValues;
  } catch { /* Defaults */ }
  return { ...DEFAULT_TUNING };
}
let current = restore();
const listeners = new Set<() => void>();
export const getTuning = () => current;
export function setTuning(key: TuneKey, value: number) {
  current = { ...current, [key]: validateTune(key,value) };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* Session still works */ }
  listeners.forEach(cb => cb());
}
export function resetTuning(key?: TuneKey) {
  if (key) return setTuning(key,DEFAULT_TUNING[key]);
  current = { ...DEFAULT_TUNING };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* Session still works */ }
  listeners.forEach(cb => cb());
}
export const subscribeTuning = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; };
export function tuningJSON() { return JSON.stringify({ version:'dead-city-debug-values-v1', settings:current },null,2); }
