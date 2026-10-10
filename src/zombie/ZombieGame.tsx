import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import MovementJoystick from '@/components/MovementJoystick';
import { loadModel, release, type Model } from '@/game/assetPreview';
import { createWorld } from '@/game/createWorld';
import { disposeWorld } from '@/game/disposeWorld';
import { advanceWorld, jumpWorld, getGroundHeight } from '@/game/worldMovement';
import { advanceWeather, applySkyLighting } from '@/game/skyEffects';
import type { LiveSettings, LookInput, MovementInput, WorldEngine } from '@/game/worldTypes';
import { aimAngles, dragDelta, readOrientation, isTap, isSecondTap, type ScreenTap, ORIENTATION_KEY, type Orientation } from './controls';
import './zombie.css';

import { ArmedSurvivor } from './survivor';
import { WEAPONS, DISMEMBERMENT, damageFor, severable, nearestHit, wallDistance, type Weapon, type Region } from './combat';
import { shareSkeletons, bodySpheres, detachRegion, updateDebris, disposeDebris, positionDamagedZombie, type Debris } from './bodyParts';
import { ZombieAudio } from './audio';
import { BloodEffects } from './bloodEffects';
import { ShotTrails, tracerToReticle } from './shotTrails';
import { routeStreet, nearbyBuildings, stepSeparated } from './navigation';
import type { Collider } from './combat';
import { SupplyDrops, type PickupType } from './Pickups';
import Radar, { type RadarFrame } from './Radar';
import { MetalRadio, useMetalRadio } from './MetalRadio';
import { getTuning } from './tuning';
import { awardKill, comboRemaining, newScore, type ScoreState } from './score';
import DebugPanel from './DebugPanel';
import DebugFPS from './DebugFPS';
type Hud = {
  health: number; wave: number; kills: number; alive: number; queued: number;
  ammo: number; reserve: number; weapon: Weapon; reloading: boolean;
  countdown: number; over: boolean; ready: boolean; notice: string;
  portal: boolean; hit: boolean; hurt: boolean; score:number; multiplier:number; combo:number; callout:string; pickupMessage:string;
};
type Enemy = {
  root: THREE.Group; mixer: THREE.AnimationMixer | null; action: THREE.AnimationAction | null;
  model: Model | null; missing: Set<Region>; anim: string; reactUntil: number; waypoint: THREE.Vector2 | null; routeAt: number;
  x: number; z: number; hp: number; speed: number; hitAt: number; deadAt: number; baseVisualY:number; nextVocalAt:number; bleedUntil:number; nextBleedAt:number; blockers:Collider[]; stuckFor:number; lastRouteX:number; lastRouteZ:number;
};
const INITIAL_HUD: Hud = { health: 100, wave: 0, kills: 0, alive: 0, queued: 0, ammo: 12, reserve: 96, weapon: 'pistol', reloading: false, countdown: 0, over: false, ready: false, notice: 'LOADING THE CITY...', portal: false, hit: false, hurt: false, score:0, multiplier:1, combo:0, callout:'', pickupMessage:'' };
const HUBSIDE_URL = 'https://preview--55efd0b1-9368-4172-9456-53db458ef667.aippy.live';
const ASSET_BASE = import.meta.env.BASE_URL + 'assets/zombie-kit/';
const REMOTE_ASSET_BASE = 'https://raw.githubusercontent.com/benryaus-cmd/zombie-game/513a481f60e5f6756d4c06233952587509e5ab8e/public/assets/zombie-kit/';
async function loadZombieAsset(name: string, signal: AbortSignal): Promise<Model> {
  try { return await loadModel(ASSET_BASE + name, signal); }
  catch (error) {
    signal.throwIfAborted();
    console.warn('Bundled zombie asset unavailable, using GitHub-hosted pack:', name, error);
    return loadModel(REMOTE_ASSET_BASE + name, signal);
  }
}

function blocked(world: WorldEngine, x: number, z: number, radius = .45): boolean {
  const foot = getGroundHeight(world, x, z);
  return world.colliders.some(box => x + radius > box.minX && x - radius < box.maxX &&
    z + radius > box.minZ && z - radius < box.maxZ && foot < box.maxY && foot + 1.7 > box.minY);
}
function fitModel(scene: THREE.Group, height: number): void {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3()).y;
  if (!Number.isFinite(size) || size < .001) return;
  scene.scale.multiplyScalar(height / size);
  const result = new THREE.Box3().setFromObject(scene);
  scene.position.sub(new THREE.Vector3((result.min.x + result.max.x) / 2, result.min.y, (result.min.z + result.max.z) / 2));
}
function createFallbackZombie(): THREE.Group {
  const root = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: 0x719b62 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x34383c });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(.75, .85, .42), green); torso.position.y = 1.07; root.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(.48, .52, .48), green); head.position.y = 1.72; root.add(head);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(.23, .78, .23), green);
    arm.position.set(s * .55, .95, .25); arm.rotation.x = -.55; root.add(arm);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.27, .7, .28), dark);
    leg.position.set(s * .23, .36, 0); root.add(leg);
  }
  return root;
}
function createPortal(world: WorldEngine): THREE.Group {
  const portal = new THREE.Group();
  portal.name = 'zombie-hubside-return';
  portal.position.set(7, getGroundHeight(world, 7, 5), 5);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.35, .13, 9, 28),
    new THREE.MeshBasicMaterial({ color: '#58d0ed', toneMapped: false }));
  ring.position.y = 2; portal.add(ring);
  const center = new THREE.Mesh(new THREE.CircleGeometry(1.18, 30),
    new THREE.MeshBasicMaterial({ color: '#15688a', transparent: true, opacity: .42, side: THREE.DoubleSide, depthWrite: false }));
  center.position.y = 2; portal.add(center);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, .18, 20),
    new THREE.MeshStandardMaterial({ color: '#163643', roughness: .65 }));
  plinth.position.y = .05; portal.add(plinth);
  world.scene.add(portal);
  return portal;
}
class ZombieEngine {
  private world: WorldEngine;
  private avatar: ArmedSurvivor | null = null;
  private sources: Model[] = [];
  private variants: Model[] = [];
  private debris: Debris[] = [];
  private blood: BloodEffects;
  private trails: ShotTrails;
  private audio = new ZombieAudio();
  private routeBudget=2;
  private supplies: SupplyDrops;
  private pickupMessage = '';
  private pickupUntil = 0;
  private scoreState:ScoreState=newScore();
  private callout='';
  private calloutUntil=0;
  private lastCallout=-100;
  private cameraKick = 0;
  private hurtUntil = 0;
  private hapticsEnabled = true;
  private developerPanelOpen = false;
  private scenery: THREE.Group[] = [];
  private hitUntil = 0;
  private portal: THREE.Group;
  private aborter = new AbortController();
  private frame = 0;
  private lastFrame = performance.now();
  private elapsed = 0;
  private lastHud = 0;
  private controls: LiveSettings = {
    paintMode: false, eraseMode: false, color: '#ffffff', opacity: 1,
    movement: { x: 0, y: 0 }, lookInput: { x: 0, y: 0 },
    brushSize: 1, moveSpeed: 7, jumpPower: 7.2, lookSensitivity: 2.6,
    fogDensity: .06, layerIndex: 0, layerVisibility: [true],
  };
  private keys = new Set<string>();
  private enemies: Enemy[] = [];
  private model: Model | null = null;

  private health = 100;
  private wave = 0;
  private kills = 0;
  private queued = 0;
  private spawnTimer = 0;
  private countdown = 1.3;
  private ammo: Record<Weapon, number> = { pistol: 12, rifle: 12, shotgun: 3 };
  private reserve: Record<Weapon, number> = { pistol: 96, rifle: 6, shotgun: 3 };
  private weapon: Weapon = 'pistol';
  private reloadTimer = 0;
  private firing = false;
  private nextShot = 0;
  private muzzleUntil = 0;
  private ready = false;
  private over = false;
  private paused = true;
  private disposed = false;
  private notice = 'LOADING QUATERNIUS ASSETS...';
  private portalNear = false;

  constructor(private container: HTMLDivElement, private onHud: (state: Hud) => void) {
    this.world = createWorld(container, .06, 'map2');
    this.blood = new BloodEffects(this.world.scene);
    this.trails = new ShotTrails(this.world.scene);
    this.supplies = new SupplyDrops(this.world, (kind,amount)=>this.giveSupply(kind,amount));
    this.world.cameraMode = 'third';
    this.world.playerPitch = -.08;
    this.world.botsEnabled = false;
    this.world.bunnyGroup.visible = false;
    applySkyLighting(this.world, 'night');
    this.world.updateChunks(this.world.playerPosition.x, this.world.playerPosition.z);
    // The inherited worldMovement calls the expensive chunk/LOD updater each
    // animation frame, including while jumping. Keep streaming responsive
    // without rebuilding geometry/LOD every airborne frame.
    const originalUpdate=this.world.updateChunks.bind(this.world);
    let lastChunkX=this.world.playerPosition.x,lastChunkZ=this.world.playerPosition.z;
    let lastChunkAt=performance.now();
    this.world.updateChunks=(x,z)=>{
      const now=performance.now(),moved=Math.hypot(x-lastChunkX,z-lastChunkZ);
      if(moved<1.6 && now-lastChunkAt<480)return;
      lastChunkX=x;lastChunkZ=z;lastChunkAt=now;
      originalUpdate(x,z);
    };
    if (import.meta.env.DEV) (window as unknown as { __deadCity: ZombieEngine }).__deadCity = this;
    this.portal = createPortal(this.world);
    advanceWorld(this.world, 0, this.controls, this.keys);
    this.setAimCamera();
    this.resize();
    void this.loadAssets();
    this.frame = requestAnimationFrame(this.tick);
  }

  radarSnapshot():RadarFrame {
    return {px:this.world.playerPosition.x,pz:this.world.playerPosition.z,yaw:this.world.playerYaw,
      zombies:this.enemies.filter(e=>e.deadAt<=0).map(e=>({x:e.x,z:e.z})),
      supplies:this.supplies.positions,buildings:this.world.colliders};
  }
  private giveSupply(kind:PickupType,amount:number) {
    if(kind==='health')this.health=Math.min(100,this.health+amount);
    else this.reserve[kind]+=amount;
    this.pickupMessage=(kind==='health'?'HEALTH +':kind.toUpperCase()+' AMMO +')+amount;
    this.pickupUntil=this.elapsed+1.65;
    this.audio.play('reload');
    this.emitHud();
  }
  private async loadAssets() {
    try {
      const load = async (name: string) => {
        const model = await loadZombieAsset(name, this.aborter.signal);
        if (this.disposed || this.aborter.signal.aborted) { release(model.scene); throw new Error('Asset load cancelled'); }
        this.sources.push(model); return model;
      };
      const [basic, chubby, survivor, ribcage] = await Promise.all([
        load('Zombie_Basic-parts.gltf'),
        load('Zombie_Chubby-parts.gltf'),
        load('Characters_Matt.gltf'),
        load('Zombie_Ribcage.gltf'),
      ]);
      if (this.disposed) { this.sources.forEach(m => release(m.scene)); return; }
      this.model = basic; this.variants = [basic, chubby];
      this.avatar = new ArmedSurvivor(survivor, this.world.playerAvatar);
      for (const [x,z] of [[-5,8],[10,-6],[-12,-10]]) {
        if (blocked(this.world,x,z,.7)) continue;
        const corpse = new THREE.Group(), visual = cloneSkinned(ribcage.scene) as THREE.Group;
        fitModel(visual,1.1); visual.rotation.x = -Math.PI/2; corpse.add(visual);
        corpse.position.set(x,getGroundHeight(this.world,x,z)+.2,z); this.world.scene.add(corpse); this.scenery.push(corpse);
      }
    } catch (error) {
      if (this.disposed) return;
      this.aborter.abort(); this.sources.forEach(m=>release(m.scene)); this.sources=[];
      console.error('Quaternius zombie asset load failed', error);
      this.notice = 'ASSET LOAD FAILED · RELOAD TO RETRY'; this.emitHud(); return;
    }
    if (this.disposed) return;
    this.ready = true;
    this.equip(this.weapon);
    if (this.model) this.notice = 'SURVIVE THE WAVES';
    this.emitHud();
  }

  resize = () => {
    if (this.disposed) return;
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    this.world.camera.aspect = width / height;
    this.world.camera.fov=getTuning().cameraFOV;
    this.world.camera.updateProjectionMatrix();
    this.world.renderer.setSize(width, height);
  };

  move = (input: MovementInput) => { this.controls.movement = input; };
  look = (input: LookInput) => { this.controls.lookInput = input; };
  setHaptics(enabled: boolean) { this.hapticsEnabled = enabled; }
  previewAudio(event:'pistol'|'rifle'|'shotgun'|'idle'|'reload') {
    this.audio.unlock();
    this.audio.play(event,event==='idle'?this.world.playerPosition.clone().add(new THREE.Vector3(3,0,-2)):undefined,'preview-'+event);
  }
  setDeveloperPanelOpen(open: boolean) { this.developerPanelOpen = open; }
  dragLook(dx: number, dy: number) {
    if (this.paused || this.over) return;
    this.world.playerYaw -= dx * getTuning().swipeX;
    this.world.playerPitch = THREE.MathUtils.clamp(this.world.playerPitch - dy * getTuning().swipeY, getTuning().pitchMinimum, getTuning().pitchMaximum);
  }
  key(code: string, down: boolean) {
    if (down) this.keys.add(code); else this.keys.delete(code);
    if (down && code === 'Space') this.jump();
    if (down && code === 'KeyR') this.reload();
    if (down && code === 'Digit1') this.equip('pistol');
    if (down && code === 'Digit2') this.equip('rifle');
    if (down && code === 'Digit3') this.equip('shotgun');
  }
  jump = () => { if (!this.paused && !this.over) jumpWorld(this.world, this.controls.jumpPower); };
  fire = (down: boolean) => { this.firing = down; if (down) this.shoot(); };
  cycleWeapon() {
    const list: Weapon[] = ['pistol', 'rifle', 'shotgun'];
    this.equip(list[(list.indexOf(this.weapon) + 1) % list.length]);
  }
  setPaused(value: boolean) { this.paused = value; this.clearInputs();if(!value)this.audio.unlock(); this.emitHud(); }

  clearInputs() { this.firing = false; this.keys.clear(); this.move({ x: 0, y: 0 }); this.look({ x: 0, y: 0 }); }

  equip(weapon: Weapon) {
    this.weapon = weapon; this.reloadTimer = 0; this.firing = false;
    this.avatar?.equip(weapon);
    if(this.ready&&!this.paused)this.audio.play(this.weapon==='pistol'?'reload':this.weapon==='rifle'?'reloadRifle':'reloadShotgun');
    this.emitHud();
  }
  reload() {
    if (this.paused || this.over || this.reloadTimer > 0) return;
    if (this.ammo[this.weapon] === WEAPONS[this.weapon].rounds || this.reserve[this.weapon] <= 0) return;
    this.reloadTimer = this.weapon==='pistol'?getTuning().reloadPistol:this.weapon==='rifle'?getTuning().reloadRifle:getTuning().reloadShotgun;
    this.audio.play(this.weapon==='pistol'?'reload':this.weapon==='rifle'?'reloadRifle':'reloadShotgun');
    this.emitHud();
  }
  private shoot() {
    if (this.paused || this.over || !this.ready || this.reloadTimer > 0) return;
    const now = this.elapsed;
    if (now < this.nextShot) return;
    if (this.ammo[this.weapon] <= 0) { this.audio.play('empty');this.reload(); return; }
    const t=getTuning();
    const delay=this.weapon==='pistol'?t.pistolDelay:this.weapon==='rifle'?t.rifleDelay:t.shotgunDelay;
    this.nextShot = now + delay;
    this.muzzleUntil = now + t.flashTime;
    this.ammo[this.weapon]--;
    this.avatar?.shot();
    this.audio.play(this.weapon);
    this.cameraKick = Math.min(.9, this.cameraKick + (this.weapon === 'shotgun' ? t.kickShotgun : this.weapon === 'pistol' ? t.kickPistol : t.kickRifle));
    if (this.hapticsEnabled && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try { navigator.vibrate(Math.round(this.weapon === 'shotgun' ? t.hapticShotgun : this.weapon === 'pistol' ? t.hapticPistol : t.hapticRifle)); } catch { /* WebView may not support vibration. */ }
    }
    const camera = this.world.camera, config = WEAPONS[this.weapon];
    const spread = this.weapon==='pistol'?t.pistolSpread:this.weapon==='rifle'?t.rifleSpread:t.shotgunSpread;
    const pelletCount = this.weapon === 'shotgun' ? Math.round(t.shotgunPellets) : 1;
    const shotDamage = this.weapon==='pistol'?t.pistolDamage:this.weapon==='rifle'?t.rifleDamage:t.shotgunDamage;
    const base = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    const muzzle = this.avatar?.muzzlePosition() ?? camera.position.clone();
    const spheres = this.enemies.filter(e => e.deadAt <= 0).map(enemy => ({ enemy, spheres: bodySpheres(enemy.root, enemy.missing) }));
    for (let pellet = 0; pellet < pelletCount; pellet++) {
      // The centre pellet remains exact; others sample an even cone around it.
      const angle = pellet * 2.39996, scatter = pellet===0 ? 0 : spread * Math.sqrt(pellet / pelletCount);
      const direction = base.clone().addScaledVector(right, Math.cos(angle)*scatter).addScaledVector(up, Math.sin(angle)*scatter).normalize();
      const ray = new THREE.Ray(camera.position.clone(), direction);
      const wall = wallDistance(ray, this.world.colliders);
      let target: {enemy:Enemy; region:Region; distance:number; point:THREE.Vector3} | null = null;
      for (const entry of spheres) {
        if (entry.enemy.deadAt > 0) continue;
        const hit = nearestHit(ray, entry.spheres.filter(s=>!entry.enemy.missing.has(s.region)), Math.min(config.range, wall));
        if (hit && (!target || hit.distance < target.distance)) target = { enemy: entry.enemy, ...hit };
      }
      // Hitscan aims down the CAMERA reticle. A visible round leaves the real muzzle
      // and converges onto that camera-ray impact point, even with a high camera.
      const aimDistance=Math.min(config.range, wall, target?.distance ?? Infinity);
      if (pellet===0 || (this.weapon==='shotgun' && pellet%3===0)) {
        const tracer=tracerToReticle(muzzle,ray,aimDistance);
        this.trails.shot(muzzle,tracer.direction,tracer.distance);
      }
      if (!target) {
        if(pellet===0 && Number.isFinite(wall) && wall<config.range)
          this.audio.play('impact',ray.at(wall,new THREE.Vector3()),'impact-world');
        continue;
      }
      const muzzleRay = new THREE.Ray(muzzle, target.point.clone().sub(muzzle).normalize());
      if (wallDistance(muzzleRay, this.world.colliders) + .03 < muzzle.distanceTo(target.point)) continue;
      const enemy = target.enemy, region = target.region;
      this.audio.play('hurt', new THREE.Vector3(enemy.x,enemy.root.position.y+1,enemy.z),'hurt-'+enemy.root.id);
      const damage = shotDamage * (region === 'head' ? 3 : region === 'torso' ? 1 : .7);
      enemy.hp -= damage; enemy.reactUntil = now + .32; this.hitUntil = now + .16;
      this.blood.burst(target.point, direction, this.weapon === 'shotgun' ? 12 : 7,
        getGroundHeight(this.world,enemy.x,enemy.z), enemy.hp <= 0);
      if (!enemy.missing.has(region) && severable(this.weapon,region,target.distance) &&
          (region === 'head' || enemy.hp <= 0 || damage >= DISMEMBERMENT.limbDamage)) {
        const piece = detachRegion(enemy.root,region,direction);
        if (piece) {
          this.world.scene.add(piece.root); this.debris.push(piece); enemy.missing.add(region);
           enemy.bleedUntil=now+t.stumpBleedSeconds;enemy.nextBleedAt=now+.05;
          this.blood.burst(target.point, direction, 22, getGroundHeight(this.world,enemy.x,enemy.z), true);
          if (region === 'head') enemy.hp = 0;
          while (this.debris.length > getTuning().maxDebris) disposeDebris(this.debris.shift()!);
        }
      }
      if (enemy.hp <= 0) this.kill(enemy);
    }
    if (this.ammo[this.weapon] <= 0) this.reload();
    this.emitHud();
  }
  private kill(enemy: Enemy) {
    if (enemy.deadAt > 0) return;
    enemy.deadAt = Math.max(.000001,this.elapsed);
    this.kills++;
    this.audio.play(enemy.missing.has('head')?'critical':'death',new THREE.Vector3(enemy.x,enemy.root.position.y+1,enemy.z),'death-'+enemy.root.id);
    const awarded=awardKill(this.scoreState,this.elapsed,enemy.missing.has('head'),enemy.missing.size>0);
    this.scoreState=awarded.next;
    if (this.elapsed-this.lastCallout>1.8 && (this.scoreState.comboCount>=2 || enemy.missing.size>0 || Math.random()<.35)) {
      this.callout=awarded.callout + (this.scoreState.multiplier>1?'  ×'+this.scoreState.multiplier:'');
      this.calloutUntil=this.elapsed+1.55;this.lastCallout=this.elapsed;
      if(this.scoreState.multiplier>=2)
        this.audio.play(this.scoreState.multiplier>=5?'comboBig':this.scoreState.multiplier>=3?'comboUp':'comboHit');
    }
    this.blood.burst(new THREE.Vector3(enemy.x, enemy.root.position.y + 1.05, enemy.z),
      new THREE.Vector3(Math.random() - .5, .45, Math.random() - .5).normalize(),
      this.weapon === 'shotgun' ? 20 : 12, getGroundHeight(this.world, enemy.x, enemy.z), true);
    if (enemy.mixer && enemy.model) {
      const death = enemy.model.animations.find(c => /death/i.test(c.name));
      if (death) {
        enemy.action?.fadeOut(.12);
        const action = enemy.mixer.clipAction(death);
        action.reset(); action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
        action.fadeIn(.12).play();
      }
    }
  }
  private spawn() {
    const px = this.world.playerPosition.x, pz = this.world.playerPosition.z;
    let x = 0, z = 0, found = false;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, radius = 15 + Math.random() * 12;
      const sx = px + Math.cos(a) * radius, sz = pz + Math.sin(a) * radius;
      if (!blocked(this.world, sx, sz, .7) && this.enemies.every(other=>other.deadAt>0||Math.hypot(other.x-sx,other.z-sz)>getTuning().zombieSpacing+1)) { x = sx; z = sz; found = true; break; }
    }
    if (!found) return;
    const model = this.variants[this.wave >= 2 && Math.random() < .25 ? 1 : 0] ?? this.model;
    const visual = model ? cloneSkinned(model.scene) as THREE.Group : createFallbackZombie();
    const body = new THREE.Group();
    shareSkeletons(visual);
    fitModel(visual, 1.85);
    body.add(visual);
    body.position.set(x, getGroundHeight(this.world, x, z), z);
    this.world.scene.add(body);
    let mixer: THREE.AnimationMixer | null = null;
    let action: THREE.AnimationAction | null = null;
    if (model) {
      mixer = new THREE.AnimationMixer(visual);
      const clip = model.animations.find(c => c.name === 'Run_Arms') ?? model.animations.find(c => c.name === 'Walk');
      if (clip) { action = mixer.clipAction(clip); action.play(); }
    }
    this.enemies.push({ root: body, model, mixer, action, anim: 'Run_Arms', missing: new Set(), reactUntil: 0, waypoint: null, routeAt: 0, x, z, hp: model === this.variants[1] ? getTuning().heavyZombieHP : getTuning().baseZombieHP + Math.min(60,this.wave*4),
      speed: getTuning().zombieSpeed + this.wave * getTuning().speedPerWave + Math.random() * .35, hitAt: 0, deadAt: 0, baseVisualY:visual.position.y, nextVocalAt:this.elapsed+2+Math.random()*6, bleedUntil:0, nextBleedAt:0, blockers:[],stuckFor:0,lastRouteX:x,lastRouteZ:z });
    this.audio.play('alert',new THREE.Vector3(x,body.position.y+1,z),'alert-'+body.id);
    this.queued--;
  }
  private spurtStumps(enemy: Enemy, now: number, floor: number) {
    const t=getTuning();
    if (!enemy.missing.size || now>=enemy.bleedUntil || now<enemy.nextBleedAt) return;
    enemy.nextBleedAt=now+Math.max(.06,t.stumpBleedInterval);
    const parts:{region:Region,bone:string}[]=[
      {region:'arm-l',bone:'UpperArmL'},{region:'arm-r',bone:'UpperArmR'},
      {region:'leg-l',bone:'UpperLegL'},{region:'leg-r',bone:'UpperLegR'}];
    enemy.root.updateMatrixWorld(true);
    for (const {region,bone} of parts) if (enemy.missing.has(region)) {
      const joint=enemy.root.getObjectByName(bone);
      if(!joint)continue;
      const point=joint.getWorldPosition(new THREE.Vector3());
      const outward=new THREE.Vector3(Math.random()-.5,.1+Math.random()*.35,Math.random()-.5).normalize();
      this.blood.burst(point,outward,t.stumpBleedStrength,floor);
    }
  }
  private updateEnemy(enemy: Enemy, delta: number, now: number) {
    const t=getTuning();
    const legsLost=Number(enemy.missing.has('leg-l'))+Number(enemy.missing.has('leg-r'));
    const crawling=legsLost===2;
    const hopping=legsLost===1;
    // Leg states intentionally kept separate: one leg hops, two legs crawl.
    if (!enemy.deadAt && enemy.mixer && enemy.model) {
      const distance = Math.hypot(enemy.x-this.world.playerPosition.x,enemy.z-this.world.playerPosition.z);
      // Use the REAL authored crawl clip (no forced pitch/rotation overlay).
      const crawlClip=enemy.model.animations.find(c=>/crawl/i.test(c.name));
      const wanted = crawling && crawlClip ? crawlClip.name :
        now < enemy.reactUntil ? 'HitReact' : distance < 1.4 ? 'Idle_Attack' :
        hopping ? 'Walk' : 'Run_Arms';
      if (enemy.anim !== wanted) {
        const clip = enemy.model.animations.find(c=>c.name === wanted);
        if (clip) { const next=enemy.mixer.clipAction(clip);next.reset().play();if(enemy.action)next.crossFadeFrom(enemy.action,.1,false);enemy.action=next;enemy.anim=wanted; }
      }
    }
    enemy.mixer?.update(delta);
    if(enemy.deadAt<=0 && now>=enemy.nextVocalAt){
      this.audio.play(crawling?'crawl':'idle',new THREE.Vector3(enemy.x,enemy.root.position.y+.8,enemy.z),'idle-'+enemy.root.id);
      enemy.nextVocalAt=now + Math.max(1,getTuning().zombieGroanInterval)*(.5+Math.random());
    }
    if (enemy.deadAt > 0) {
      // Freshly killed, dismembered corpses still bleed briefly until despawn.
      this.spurtStumps(enemy,now,getGroundHeight(this.world,enemy.x,enemy.z));
      if (now - enemy.deadAt > getTuning().corpseTime) {
        enemy.mixer?.stopAllAction();
        this.removeEnemy(enemy);
        return false;
      }
      return true;
    }
    const px = this.world.playerPosition.x, pz = this.world.playerPosition.z;
    const dx = px - enemy.x, dz = pz - enemy.z, length = Math.hypot(dx, dz);
    enemy.root.rotation.y = Math.atan2(dx, dz);
    if (length > 1.15) {
      const stale=now>=enemy.routeAt || !enemy.waypoint ||
        enemy.waypoint.distanceTo(new THREE.Vector2(enemy.x,enemy.z))<.65 ||
        enemy.stuckFor>.35;
      if(stale && this.routeBudget>0){
        this.routeBudget--;
        // Refresh only every ~0.9s, not every animation frame. Bounded local
        // search navigates buildings; neighbour separation prevents a dogpile.
        enemy.blockers=nearbyBuildings(enemy.x,enemy.z,this.world.colliders,30);
        const way=routeStreet({x:enemy.x,z:enemy.z},{x:px,z:pz},enemy.blockers,.49);
        enemy.waypoint=new THREE.Vector2(way.x,way.z);
        enemy.routeAt=now+t.navInterval+Math.random()*.22;
        enemy.stuckFor=0;
      }
      const speed=enemy.speed*(crawling?t.crawlSpeed:hopping?t.hopSpeed:now<enemy.reactUntil?.25:1);
      const neighbours=this.enemies.filter(other=>other!==enemy&&other.deadAt<=0).map(other=>({x:other.x,z:other.z}));
      const newPos=stepSeparated({x:enemy.x,z:enemy.z},{x:enemy.waypoint?.x ?? px,z:enemy.waypoint?.y ?? pz},
        neighbours,enemy.blockers,Math.min(.12,delta*speed),.47,t.zombieSpacing);
      const travelled=Math.hypot(newPos.x-enemy.x,newPos.z-enemy.z);
      enemy.stuckFor=travelled<.006?enemy.stuckFor+delta:0;
      if(travelled>0){enemy.x=newPos.x;enemy.z=newPos.z;}
    } else if (now - enemy.hitAt > t.attackInterval && Math.abs(this.world.playerPosition.y - enemy.root.position.y - 1.72) < 1.1 &&
      wallDistance(new THREE.Ray(new THREE.Vector3(enemy.x,enemy.root.position.y+1,enemy.z),new THREE.Vector3(dx,0,dz).normalize()),this.world.colliders) > length) {
      enemy.hitAt = now;
      this.audio.play('attack',new THREE.Vector3(enemy.x,enemy.root.position.y+.8,enemy.z),'attack-'+enemy.root.id);
      if (this.developerPanelOpen && t.safeWhileTuning >= .5) return true;
      this.health = Math.max(0, this.health - t.attackDamage);
      this.hurtUntil = now + .52;
      this.cameraKick = Math.max(this.cameraKick, .17);
      if (this.health <= 0) { this.over = true; this.firing = false; this.notice = 'YOU WERE OVERRUN'; }
      this.emitHud();
    }
    // Ground alignment follows the actual surviving foot for hoppers, torso for crawlers.
    // Do not add bobbing to the whole zombie root (that caused the old floating bugs).
    const floor=getGroundHeight(this.world,enemy.x,enemy.z);
    enemy.root.position.set(enemy.x,floor,enemy.z);
    const visual=enemy.root.children[0] as THREE.Group | undefined;
    if(visual)positionDamagedZombie(enemy.root,visual,enemy.missing,enemy.baseVisualY,
      floor,now,t.hopHeight,t.hopFrequency);
    this.spurtStumps(enemy,now,floor);
    return true;
  }

  private tick = (time: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    const dt = Math.min((time - this.lastFrame) / 1000, .05);
    this.lastFrame = time;
    if (!this.paused && !this.over && this.ready) {
      this.routeBudget=2;
      if(this.world.camera.fov!==getTuning().cameraFOV) {this.world.camera.fov=getTuning().cameraFOV;this.world.camera.updateProjectionMatrix();}
      const aim = aimAngles(this.world.playerYaw, this.world.playerPitch, (this.controls.lookInput?.x || 0)*getTuning().lookStickSpeed/2.9, this.controls.lookInput?.y || 0, dt);
      this.world.playerYaw = aim.yaw; this.world.playerPitch = aim.pitch;
      this.controls.moveSpeed=getTuning().moveSpeed; this.controls.jumpPower=getTuning().jumpPower;
      advanceWorld(this.world, dt, this.controls, this.keys);
      advanceWeather(this.world, dt);
      this.setAimCamera();
      this.elapsed += dt;
      const now = this.elapsed;
      const aimTarget=this.world.camera.position.clone().addScaledVector(this.world.camera.getWorldDirection(new THREE.Vector3()),40);
      this.avatar?.animate(dt,Math.hypot(this.controls.movement.x,this.controls.movement.y)>.08 || ['KeyW','KeyA','KeyS','KeyD'].some(k=>this.keys.has(k)),Math.abs(this.world.velocityY)>.1,aimTarget,this.reloadTimer>0);
      if (this.reloadTimer > 0) {
        this.reloadTimer -= dt;
        if (this.reloadTimer <= 0) {
          const needed = WEAPONS[this.weapon].rounds - this.ammo[this.weapon];
          const amount = Math.min(needed, this.reserve[this.weapon]);
          this.ammo[this.weapon] += amount; this.reserve[this.weapon] -= amount;
          this.reloadTimer = 0;
        }
      }
      if (this.firing) this.shoot();
      for (let i=this.debris.length-1;i>=0;i--) if(!updateDebris(this.debris[i],dt)) { disposeDebris(this.debris[i]);this.debris.splice(i,1); }
      this.blood.update(dt);
      this.trails.update(dt);
      this.audio.update(this.world.playerPosition,this.world.camera.getWorldDirection(new THREE.Vector3()));
      this.supplies.update(dt);
      this.enemies = this.enemies.filter(e => this.updateEnemy(e, dt, now));
      const alive = this.enemies.filter(e => e.deadAt <= 0).length;
      if (this.queued > 0 && alive < getTuning().zombieCap) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) { this.spawn(); this.spawnTimer = Math.max(.1, getTuning().spawnInterval - this.wave * .04); }
      }
      if (this.queued <= 0 && alive === 0) {
        this.countdown -= dt;
        if (this.countdown <= 0) {
          this.wave++;
          this.queued = Math.min(100,Math.round(getTuning().waveBase + this.wave*getTuning().waveGrowth));
          this.countdown = getTuning().betweenWaves;
          this.spawnTimer = .1;
          this.notice = 'WAVE ' + this.wave;
        }
      }
      this.portalNear = Math.hypot(this.world.playerPosition.x - this.portal.position.x,
        this.world.playerPosition.z - this.portal.position.z) < 2.4;
    }
    // Positional screen shake: keep aim direction/crosshair stable.
    if (!this.paused && this.cameraKick > 0) {
      this.cameraKick = Math.max(0, this.cameraKick - dt * getTuning().shakeDecay);
      const right = new THREE.Vector3(1,0,0).applyQuaternion(this.world.camera.quaternion);
      this.world.camera.position.addScaledVector(right, Math.sin(time * .075) * this.cameraKick * getTuning().shakeX);
      this.world.camera.position.y += Math.cos(time * .095) * this.cameraKick * getTuning().shakeY;
      this.world.camera.position.z+=Math.sin(time*.08)*this.cameraKick*getTuning().shakeZ;
    }
    this.world.renderer.render(this.world.scene, this.world.camera);
    if (time - this.lastHud > 180) { this.lastHud = time; this.emitHud(); }
  };
  private setAimCamera() {
    const world = this.world, yaw = world.playerYaw;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    world.camera.position.copy(world.playerPosition).addScaledVector(forward, -(this.world.camera.aspect < 1 ? getTuning().cameraPortraitDistance : getTuning().cameraLandscapeDistance)).addScaledVector(right, getTuning().cameraShoulder);
    world.camera.position.y += getTuning().cameraHeight;
    const aim = world.playerPosition.clone().addScaledVector(forward, getTuning().aimDistance);
    aim.y += getTuning().cameraHeight + Math.tan(world.playerPitch) * getTuning().aimPitchDistance;
    const ideal=world.camera.position.clone();
    const anchor=world.playerPosition.clone().add(new THREE.Vector3(0,.35,0)), toCamera=ideal.clone().sub(anchor);
    const clearance=wallDistance(new THREE.Ray(anchor,toCamera.clone().normalize()),world.colliders);
    if(clearance<toCamera.length())world.camera.position.copy(anchor).addScaledVector(toCamera.normalize(),Math.max(.25,clearance-.18));
    world.camera.lookAt(aim);
    world.skyDome.position.copy(world.camera.position);
  }
  reset() {
    for (const enemy of this.enemies) this.removeEnemy(enemy);
    this.debris.forEach(disposeDebris); this.debris=[];
    this.blood.clear();this.trails.clear();this.pickupMessage='';this.pickupUntil=0;this.scoreState=newScore();this.callout='';this.calloutUntil=0;this.lastCallout=-100; this.cameraKick = 0; this.hurtUntil = 0;
    this.enemies = [];
    this.health = 100; this.wave = 0; this.kills = 0; this.queued = 0;
    this.countdown = 1.3; this.spawnTimer = 0; this.over = false; this.paused = false;
    this.ammo = { pistol: 12, rifle: Math.min(30,Math.ceil(getTuning().rifleStartingRounds*.67)), shotgun: Math.min(6,Math.ceil(getTuning().shotgunStartingRounds*.5)) };
    this.reserve = { pistol: 96, rifle: Math.max(0,getTuning().rifleStartingRounds-this.ammo.rifle), shotgun: Math.max(0,getTuning().shotgunStartingRounds-this.ammo.shotgun) };
    this.elapsed = 0; this.hitUntil = 0; this.clearInputs(); this.nextShot = 0; this.muzzleUntil = 0; this.portalNear = false; this.world.playerYaw = 0; this.world.playerPitch = -.08;
    this.reloadTimer = 0; this.weapon = 'pistol'; this.notice = 'SURVIVE THE WAVES';
    this.world.playerPosition.set(0, 1.72, 5);
    this.supplies.clear();
    this.world.velocityY = 0;
    this.equip('pistol');
    this.emitHud();
  }
  private removeEnemy(enemy:Enemy) {
    enemy.mixer?.stopAllAction(); enemy.mixer?.uncacheRoot(enemy.root.children[0]);
    enemy.root.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.dispose();});enemy.root.removeFromParent();
  }
  private emitHud() {
    if (this.disposed) return;
    this.onHud({ health: this.health, wave: this.wave, kills: this.kills,
      alive: this.enemies.filter(e => e.deadAt <= 0).length, queued: this.queued,
      ammo: this.ammo[this.weapon], reserve: this.reserve[this.weapon], weapon: this.weapon,
      reloading: this.reloadTimer > 0, countdown: this.countdown,
      over: this.over, ready: this.ready, notice: this.notice, portal: this.portalNear, hit: this.elapsed < this.hitUntil, hurt: this.elapsed < this.hurtUntil,
      score:this.scoreState.score, multiplier:comboRemaining(this.scoreState,this.elapsed)>0?this.scoreState.multiplier:1,
      combo:this.scoreState.comboCount, callout:this.elapsed<this.calloutUntil?this.callout:'',pickupMessage:this.elapsed<this.pickupUntil?this.pickupMessage:'' });
  }
  dispose() {
    this.disposed = true; this.aborter.abort(); cancelAnimationFrame(this.frame);
    for (const enemy of this.enemies) this.removeEnemy(enemy);
    this.debris.forEach(disposeDebris); this.debris=[];
    this.blood.dispose();
    this.trails.dispose();
    this.audio.dispose();
    this.supplies.dispose();
    this.avatar?.dispose();
    this.scenery.forEach(root=>{root.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.dispose();});root.removeFromParent();});
    this.sources.forEach(m=>release(m.scene));
    release(this.portal);
    disposeWorld(this.world);
  }
}

export default function ZombieGame() {
  const mount = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; start: ScreenTap; moved: boolean; firing: boolean } | null>(null);
  const lastTap = useRef<ScreenTap | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [orientation, setOrientation] = useState<Orientation>(() => { try { return readOrientation(localStorage.getItem(ORIENTATION_KEY)); } catch { return 'portrait'; } });
  const [rotated, setRotated] = useState(false);
  const engine = useRef<ZombieEngine | null>(null);
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [menu, setMenu] = useState(false);
  const [debugOpen,setDebugOpen] = useState(false);
  const radio=useMetalRadio();
  const [radioActive,setRadioActive]=useState(false);
  const radioWasRunning=useRef(false);
  const readRadar=useCallback(()=>engine.current?.radarSnapshot()??null,[]);
  const onMove = useCallback((v: MovementInput) => engine.current?.move(v), []);
  const [haptics, setHaptics] = useState(() => { try { return localStorage.getItem('dead-city-haptics') !== 'off'; } catch { return true; } });
  useEffect(() => {
    engine.current?.setHaptics(haptics);
    try { localStorage.setItem('dead-city-haptics', haptics ? 'on' : 'off'); } catch { /* Preference optional. */ }
  }, [haptics]);
  useEffect(() => {
    if (!mount.current) return;
    const current = new ZombieEngine(mount.current, setHud);
    engine.current = current;
    const observer = new ResizeObserver(current.resize);
    observer.observe(mount.current);
    const down = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      current.key(e.code, true);
    };
    const up = (e: KeyboardEvent) => current.key(e.code, false);
    current.setHaptics(haptics);
    const blur = () => { lastTap.current = null; drag.current = null; current.clearInputs(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', current.resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', current.resize);
      engine.current = null; current.dispose();
    };
  }, []);
  useEffect(() => {
    try { localStorage.setItem(ORIENTATION_KEY, orientation); } catch { /* Storage is optional. */ }
    const parent = root.current?.parentElement;
    if (!parent) return;
    const resize = () => {
      root.current?.style.setProperty('--view-width', parent.clientWidth + 'px');
      root.current?.style.setProperty('--view-height', parent.clientHeight + 'px');
      setRotated(orientation === 'landscape' && parent.clientHeight > parent.clientWidth);
    };
    resize(); const observer = new ResizeObserver(resize); observer.observe(parent);
    return () => observer.disconnect();
  }, [orientation]);
  const start = () => {
    if (hud.over) engine.current?.reset();
    engine.current?.setPaused(false);
    radio.play();
    setStarted(true); setPaused(false); setMenu(false);

  };
  const pause = () => { engine.current?.setDeveloperPanelOpen(false); engine.current?.setPaused(true); setPaused(true); setMenu(true); setDebugOpen(false); };
  const openDebug = () => {engine.current?.setDeveloperPanelOpen(true);engine.current?.setPaused(false);radio.play();setStarted(true);setMenu(false);setPaused(false);setDebugOpen(true);};
  const resume = () => { engine.current?.setPaused(false); radio.play();setPaused(false); setMenu(false); };
  const openRadio = () => {
    radioWasRunning.current=started&&!paused&&!hud.over;
    if(radioWasRunning.current){engine.current?.setPaused(true);setPaused(true);}
    radio.setOpened(true);setRadioActive(true);
  };
  const closeRadio = () => {
    radio.setOpened(false);setRadioActive(false);
    if(radioWasRunning.current){engine.current?.setPaused(false);setPaused(false);}
    radioWasRunning.current=false;
  };
  const releaseGesture = (event: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (current.firing) engine.current?.fire(false);
    if (!cancelled && !current.firing && !current.moved) {
      const end: ScreenTap = { x: event.clientX, y: event.clientY, at: event.timeStamp };
      lastTap.current = isTap(current.start, end) ? end : null;
    } else lastTap.current = null;
    drag.current = null;
  };
  return <div ref={root} className={`zombie-root ${rotated ? 'game-portrait zombie-rotated' : ''}`} data-orientation={orientation}>
    <div ref={mount} className="world-mount" aria-label="3D zombie survival city"
      onPointerDown={event => {
        if (!started || paused || hud.over || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        const next: ScreenTap = { x: event.clientX, y: event.clientY, at: event.timeStamp };
        const firing = event.pointerType === 'mouse' || isSecondTap(lastTap.current, next);
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: next, moved: false, firing };
        if (firing) { lastTap.current = null; engine.current?.fire(true); }
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        const delta = dragDelta(event.clientX - current.x, event.clientY - current.y, rotated);
        engine.current?.dragLook(delta.x, delta.y);
        drag.current = { ...current, x: event.clientX, y: event.clientY,
          moved: current.moved || Math.hypot(event.clientX - current.start.x, event.clientY - current.start.y) > 23 };
      }}
      onPointerUp={event => releaseGesture(event)}
      onPointerCancel={event => releaseGesture(event, true)}
      onLostPointerCapture={event => releaseGesture(event, true)}
    />
    <DebugFPS />
    <div className="zombie-hud">
      {started && !hud.over && <Radar read={readRadar} />}
      <MetalRadio radio={radio} onOpen={openRadio} onClose={closeRadio} />
      {started && hud.hurt && !paused && <div className="zombie-damage-flash" aria-hidden="true" />}
      <header className="zombie-top">
        <div className="zombie-brand"><strong>DEAD CITY</strong><span>HUBSIDE SURVIVAL</span></div>
        <div className="zombie-health"><span>HEALTH {hud.health}%</span><div><i style={{ width: hud.health + '%' }} /></div></div>
        <div className="zombie-wave"><strong>WAVE {hud.wave}</strong><small>{hud.alive + hud.queued} REMAINING</small></div>
        <div className="zombie-kills">KILLS <strong>{hud.kills}</strong></div>
        <div className="zombie-score">SCORE <strong>{hud.score.toLocaleString()}</strong>
          {hud.multiplier>1 && <small>×{hud.multiplier} COMBO</small>}</div>
        <button className="zombie-menu-button" onClick={pause} aria-label="Pause game">☰</button>
      </header>
      {started && !paused && !hud.over && hud.pickupMessage && <div className="dc-pickup-pop">{hud.pickupMessage}</div>}
      {started && !paused && !hud.over && <div className="zombie-cross">
        {hud.callout && <div className="zombie-callout" key={hud.callout}>{hud.callout}</div>}</div>}
      {started && !paused && !hud.over && <div className={`zombie-reticle ${hud.hit ? 'hit' : ''}`} aria-hidden="true">+</div>}
      {started && !paused && !hud.over && <>
        <div className="zombie-controls"><MovementJoystick onMove={onMove} /></div>
        <button className="zombie-jump" onPointerDown={e => { e.preventDefault(); engine.current?.jump(); }}>JUMP</button>
        <div className="zombie-ammo">
          <button className="zombie-weapon-cycle" onPointerDown={event => {
            // Activate on the pointer itself, so weapon switching works even while a separate finger holds MOVE.
            event.preventDefault();event.stopPropagation();engine.current?.cycleWeapon();
          }} aria-label={`Change weapon. Currently ${hud.weapon}`}>
            <strong>{hud.weapon.toUpperCase()} ↻</strong>
            <span>{hud.reloading ? 'RELOADING…' : `${hud.ammo} / ${hud.reserve}`}</span>
            <small>TAP TO SWITCH</small>
          </button>
          <button className="zombie-reload" onClick={() => engine.current?.reload()} aria-label="Reload weapon">RELOAD</button>
        </div>
        {hud.queued === 0 && hud.alive === 0 && <div className="zombie-next-wave">NEXT WAVE IN {Math.max(0, Math.ceil(hud.countdown))}</div>}
        {hud.portal && <button className="zombie-portal-link" onClick={() => window.open(HUBSIDE_URL, '_blank', 'noopener,noreferrer')}>ENTER PORTAL · HUBSIDE ↗</button>}
      </>}
      {(!started || menu || hud.over) && !radioActive && <div className="zombie-overlay">
        <div className="zombie-panel">
          <span className="zombie-eyebrow">HUBSIDE WORLDS</span>
          <h1>{hud.over ? 'GAME OVER' : 'DEAD CITY'}</h1>
          <p>{hud.over ? 'You survived ' + hud.wave + ' waves and eliminated ' + hud.kills + ' zombies.' : 'The streets are overrun. Keep moving, aim and shoot, and survive the waves.'}</p>
          <p className="zombie-hint">{hud.ready ? 'MOVE: LEFT STICK / WASD · SWIPE TO AIM · DOUBLE TAP TO FIRE · HOLD SECOND TAP FOR AUTO FIRE' : hud.notice}</p>
          <button className="zombie-test-button" onClick={openDebug}>LIVE TEST VALUES / FPS</button>
          <div className="zombie-orientation" role="group" aria-label="Game orientation">
            {(['portrait', 'landscape'] as const).map(value => <button key={value} aria-pressed={orientation === value} onClick={() => setOrientation(value)}>{value.toUpperCase()}</button>)}
            <button aria-pressed={haptics} onClick={() => setHaptics(v => !v)}>HAPTICS {haptics ? 'ON' : 'OFF'}</button>
          </div>
          <button className="zombie-start" onClick={hud.over || !started ? start : resume} disabled={!hud.ready}>{hud.over ? 'TRY AGAIN' : started ? 'RESUME' : 'START SURVIVING'}</button>
          {started && !hud.over && <button className="zombie-secondary" onClick={() => { engine.current?.reset(); setMenu(false); setPaused(false); }}>RESTART</button>}
          <button className="zombie-secondary" onClick={() => window.open(HUBSIDE_URL, '_blank', 'noopener,noreferrer')}>GO TO HUBSIDE ↗</button>
        </div>
      </div>}
    </div>
    {debugOpen && <DebugPanel orientation={orientation} haptics={haptics} onTestAudio={event=>engine.current?.previewAudio(event)} onClose={() => { engine.current?.setDeveloperPanelOpen(false);setDebugOpen(false); }} />}
  </div>;
}
