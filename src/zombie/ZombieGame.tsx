import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import MovementJoystick from '@/components/MovementJoystick';
import LookJoystick from '@/components/LookJoystick';
import { loadModel, release, type Model } from '@/game/assetPreview';
import { createWorld } from '@/game/createWorld';
import { disposeWorld } from '@/game/disposeWorld';
import { advanceWorld, jumpWorld, getGroundHeight } from '@/game/worldMovement';
import { advanceWeather, applySkyLighting } from '@/game/skyEffects';
import type { LiveSettings, LookInput, MovementInput, WorldEngine } from '@/game/worldTypes';
import { aimAngles, dragDelta, readOrientation, releaseFirePointer, ORIENTATION_KEY, type Orientation } from './controls';
import './zombie.css';

import { ArmedSurvivor } from './survivor';
import { WEAPONS, DISMEMBERMENT, damageFor, severable, nearestHit, wallDistance, routeAround, type Weapon, type Region } from './combat';
import { shareSkeletons, bodySpheres, detachRegion, updateDebris, disposeDebris, type Debris } from './bodyParts';
type Hud = {
  health: number; wave: number; kills: number; alive: number; queued: number;
  ammo: number; reserve: number; weapon: Weapon; reloading: boolean;
  countdown: number; over: boolean; ready: boolean; notice: string;
  portal: boolean; hit: boolean;
};
type Enemy = {
  root: THREE.Group; mixer: THREE.AnimationMixer | null; action: THREE.AnimationAction | null;
  model: Model | null; missing: Set<Region>; anim: string; reactUntil: number; waypoint: THREE.Vector2 | null; routeAt: number;
  x: number; z: number; hp: number; speed: number; hitAt: number; deadAt: number;
};
const INITIAL_HUD: Hud = { health: 100, wave: 0, kills: 0, alive: 0, queued: 0, ammo: 12, reserve: 96, weapon: 'pistol', reloading: false, countdown: 0, over: false, ready: false, notice: 'LOADING THE CITY...', portal: false, hit: false };
const HUBSIDE_URL = 'https://aippy.ai/@PinkYyyy/street-art-canvas-aV7b';
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
  private ammo: Record<Weapon, number> = { pistol: 12, rifle: 30, shotgun: 6 };
  private reserve: Record<Weapon, number> = { pistol: 96, rifle: 240, shotgun: 48 };
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
    this.world.cameraMode = 'third';
    this.world.playerPitch = -.08;
    this.world.botsEnabled = false;
    this.world.bunnyGroup.visible = false;
    applySkyLighting(this.world, 'night');
    this.world.updateChunks(this.world.playerPosition.x, this.world.playerPosition.z);
    if (import.meta.env.DEV) (window as unknown as { __deadCity: ZombieEngine }).__deadCity = this;
    this.portal = createPortal(this.world);
    advanceWorld(this.world, 0, this.controls, this.keys);
    this.setAimCamera();
    this.resize();
    void this.loadAssets();
    this.frame = requestAnimationFrame(this.tick);
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
    this.world.camera.updateProjectionMatrix();
    this.world.renderer.setSize(width, height);
  };

  move = (input: MovementInput) => { this.controls.movement = input; };
  look = (input: LookInput) => { this.controls.lookInput = input; };
  dragLook(dx: number, dy: number) {
    if (this.paused || this.over) return;
    this.world.playerYaw -= dx * .006;
    this.world.playerPitch = THREE.MathUtils.clamp(this.world.playerPitch - dy * .004, -.68, .68);
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
  setPaused(value: boolean) { this.paused = value; this.clearInputs(); this.emitHud(); }

  clearInputs() { this.firing = false; this.keys.clear(); this.move({ x: 0, y: 0 }); this.look({ x: 0, y: 0 }); }

  equip(weapon: Weapon) {
    this.weapon = weapon; this.reloadTimer = 0; this.firing = false;
    this.avatar?.equip(weapon);
    this.emitHud();
  }
  reload() {
    if (this.paused || this.over || this.reloadTimer > 0) return;
    if (this.ammo[this.weapon] === WEAPONS[this.weapon].rounds || this.reserve[this.weapon] <= 0) return;
    this.reloadTimer = WEAPONS[this.weapon].reload;
    this.emitHud();
  }
  private shoot() {
    if (this.paused || this.over || !this.ready || this.reloadTimer > 0) return;
    const now = this.elapsed;
    if (now < this.nextShot) return;
    if (this.ammo[this.weapon] <= 0) { this.reload(); return; }
    this.nextShot = now + WEAPONS[this.weapon].delay;
    this.muzzleUntil = now + .08;
    this.ammo[this.weapon]--;
    this.avatar?.shot();
    const camera = this.world.camera, config = WEAPONS[this.weapon];
    const base = camera.getWorldDirection(new THREE.Vector3());
    const right = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
    const muzzle = this.avatar?.muzzlePosition() ?? camera.position.clone();
    const spheres = this.enemies.filter(e => e.deadAt <= 0).map(enemy => ({ enemy, spheres: bodySpheres(enemy.root, enemy.missing) }));
    for (let pellet = 0; pellet < config.pellets; pellet++) {
      // The centre pellet remains exact; others sample an even cone around it.
      const angle = pellet * 2.39996, spread = config.spread * Math.sqrt(pellet / config.pellets);
      const direction = base.clone().addScaledVector(right, Math.cos(angle)*spread).addScaledVector(up, Math.sin(angle)*spread).normalize();
      const ray = new THREE.Ray(camera.position.clone(), direction);
      const wall = wallDistance(ray, this.world.colliders);
      let target: {enemy:Enemy; region:Region; distance:number; point:THREE.Vector3} | null = null;
      for (const entry of spheres) {
        if (entry.enemy.deadAt > 0) continue;
        const hit = nearestHit(ray, entry.spheres.filter(s=>!entry.enemy.missing.has(s.region)), Math.min(config.range, wall));
        if (hit && (!target || hit.distance < target.distance)) target = { enemy: entry.enemy, ...hit };
      }
      if (!target) continue;
      const muzzleRay = new THREE.Ray(muzzle, target.point.clone().sub(muzzle).normalize());
      if (wallDistance(muzzleRay, this.world.colliders) + .03 < muzzle.distanceTo(target.point)) continue;
      const enemy = target.enemy, region = target.region;
      const damage = damageFor(this.weapon, region);
      enemy.hp -= damage; enemy.reactUntil = now + .32; this.hitUntil = now + .16;
      if (!enemy.missing.has(region) && severable(this.weapon,region,target.distance) &&
          (region === 'head' || enemy.hp <= 0 || damage >= DISMEMBERMENT.limbDamage)) {
        const piece = detachRegion(enemy.root,region,direction);
        if (piece) {
          this.world.scene.add(piece.root); this.debris.push(piece); enemy.missing.add(region);
          if (region === 'head') enemy.hp = 0;
          while (this.debris.length > DISMEMBERMENT.maxDebris) disposeDebris(this.debris.shift()!);
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
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, radius = 15 + Math.random() * 12;
      const sx = px + Math.cos(a) * radius, sz = pz + Math.sin(a) * radius;
      if (!blocked(this.world, sx, sz, .7)) { x = sx; z = sz; found = true; break; }
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
    this.enemies.push({ root: body, model, mixer, action, anim: 'Run_Arms', missing: new Set(), reactUntil: 0, waypoint: null, routeAt: 0, x, z, hp: model === this.variants[1] ? 150 : 68 + Math.min(60,this.wave*4),
      speed: 1.55 + this.wave * .16 + Math.random() * .35, hitAt: 0, deadAt: 0 });
    this.queued--;
  }
  private updateEnemy(enemy: Enemy, delta: number, now: number) {
    const crippled = enemy.missing.has('leg-l') || enemy.missing.has('leg-r');
    if (!enemy.deadAt && enemy.mixer && enemy.model) {
      const distance = Math.hypot(enemy.x-this.world.playerPosition.x,enemy.z-this.world.playerPosition.z);
      const wanted = now < enemy.reactUntil ? 'HitReact' : distance < 1.4 ? 'Idle_Attack' : crippled ? 'Crawl' : 'Run_Arms';
      if (enemy.anim !== wanted) {
        const clip = enemy.model.animations.find(c=>c.name === wanted);
        if (clip) { const next=enemy.mixer.clipAction(clip);next.reset().play();if(enemy.action)next.crossFadeFrom(enemy.action,.1,false);enemy.action=next;enemy.anim=wanted; }
      }
    }
    enemy.mixer?.update(delta);
    if (enemy.deadAt > 0) {
      if (now - enemy.deadAt > 3) {
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
      if (now >= enemy.routeAt || !enemy.waypoint || enemy.waypoint.distanceTo(new THREE.Vector2(enemy.x,enemy.z)) < .2) {
        enemy.waypoint = routeAround(new THREE.Vector2(enemy.x,enemy.z),new THREE.Vector2(px,pz),this.world.colliders,.5);
        enemy.routeAt = now + .6;
      }
      const vx = enemy.waypoint.x-enemy.x, vz=enemy.waypoint.y-enemy.z, vl=Math.hypot(vx,vz);
      const step = Math.min(vl, delta * enemy.speed * (crippled ? .3 : now < enemy.reactUntil ? .25 : 1));
      const nx = enemy.x + vx / Math.max(.001,vl) * step, nz = enemy.z + vz / Math.max(.001,vl) * step;
      if (!blocked(this.world, nx, nz)) { enemy.x = nx; enemy.z = nz; }
      else if (!blocked(this.world, nx, enemy.z)) enemy.x = nx;
      else if (!blocked(this.world, enemy.x, nz)) enemy.z = nz;
      else {
        // Wall slide rather than tunnelling through a building.
        const side = (Math.sin(enemy.x * 7 + enemy.z * 4) > 0 ? 1 : -1) * step;
        if (!blocked(this.world, enemy.x - dz / length * side, enemy.z + dx / length * side)) {
          enemy.x -= dz / length * side; enemy.z += dx / length * side;
        }
      }
    } else if (now - enemy.hitAt > 1.12 && Math.abs(this.world.playerPosition.y - enemy.root.position.y - 1.72) < 1.1 &&
      wallDistance(new THREE.Ray(new THREE.Vector3(enemy.x,enemy.root.position.y+1,enemy.z),new THREE.Vector3(dx,0,dz).normalize()),this.world.colliders) > length) {
      enemy.hitAt = now;
      this.health = Math.max(0, this.health - 11);
      if (this.health <= 0) { this.over = true; this.firing = false; this.notice = 'YOU WERE OVERRUN'; }
      this.emitHud();
    }
    enemy.root.position.set(enemy.x, getGroundHeight(this.world, enemy.x, enemy.z), enemy.z);
    return true;
  }

  private tick = (time: number) => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.tick);
    const dt = Math.min((time - this.lastFrame) / 1000, .05);
    this.lastFrame = time;
    if (!this.paused && !this.over && this.ready) {
      const aim = aimAngles(this.world.playerYaw, this.world.playerPitch, this.controls.lookInput?.x || 0, this.controls.lookInput?.y || 0, dt);
      this.world.playerYaw = aim.yaw; this.world.playerPitch = aim.pitch;
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
      this.enemies = this.enemies.filter(e => this.updateEnemy(e, dt, now));
      const alive = this.enemies.filter(e => e.deadAt <= 0).length;
      if (this.queued > 0 && alive < 18) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) { this.spawn(); this.spawnTimer = Math.max(.28, .85 - this.wave * .04); }
      }
      if (this.queued <= 0 && alive === 0) {
        this.countdown -= dt;
        if (this.countdown <= 0) {
          this.wave++;
          this.queued = Math.min(36, 4 + this.wave * 3);
          this.countdown = 4;
          this.spawnTimer = .1;
          this.notice = 'WAVE ' + this.wave;
        }
      }
      this.portalNear = Math.hypot(this.world.playerPosition.x - this.portal.position.x,
        this.world.playerPosition.z - this.portal.position.z) < 2.4;
    }
    this.world.renderer.render(this.world.scene, this.world.camera);
    if (time - this.lastHud > 180) { this.lastHud = time; this.emitHud(); }
  };
  private setAimCamera() {
    const world = this.world, yaw = world.playerYaw;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    world.camera.position.copy(world.playerPosition).addScaledVector(forward, this.world.camera.aspect < 1 ? -4.4 : -3.3).addScaledVector(right, .85);
    world.camera.position.y += .48;
    const aim = world.playerPosition.clone().addScaledVector(forward, 12);
    aim.y += .48 + Math.tan(world.playerPitch) * 15.3;
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
    this.enemies = [];
    this.health = 100; this.wave = 0; this.kills = 0; this.queued = 0;
    this.countdown = 1.3; this.spawnTimer = 0; this.over = false; this.paused = false;
    this.ammo = { pistol: 12, rifle: 30, shotgun: 6 };
    this.reserve = { pistol: 96, rifle: 240, shotgun: 48 };
    this.elapsed = 0; this.hitUntil = 0; this.clearInputs(); this.nextShot = 0; this.muzzleUntil = 0; this.portalNear = false; this.world.playerYaw = 0; this.world.playerPitch = -.08;
    this.reloadTimer = 0; this.weapon = 'pistol'; this.notice = 'SURVIVE THE WAVES';
    this.world.playerPosition.set(0, 1.72, 5);
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
      over: this.over, ready: this.ready, notice: this.notice, portal: this.portalNear, hit: this.elapsed < this.hitUntil });
  }
  dispose() {
    this.disposed = true; this.aborter.abort(); cancelAnimationFrame(this.frame);
    for (const enemy of this.enemies) this.removeEnemy(enemy);
    this.debris.forEach(disposeDebris); this.debris=[];
    this.avatar?.dispose();
    this.scenery.forEach(root=>{root.traverse(o=>{if(o instanceof THREE.SkinnedMesh)o.skeleton.dispose();});root.removeFromParent();});
    this.sources.forEach(m=>release(m.scene));
    release(this.portal);
    disposeWorld(this.world);
  }
}

export default function ZombieGame() {
  const mount = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const firePointer = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const [orientation, setOrientation] = useState<Orientation>(() => { try { return readOrientation(localStorage.getItem(ORIENTATION_KEY)); } catch { return 'portrait'; } });
  const [rotated, setRotated] = useState(false);
  const engine = useRef<ZombieEngine | null>(null);
  const [hud, setHud] = useState<Hud>(INITIAL_HUD);
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [menu, setMenu] = useState(false);
  const onMove = useCallback((v: MovementInput) => engine.current?.move(v), []);
  const onLook = useCallback((v: LookInput) => engine.current?.look(v), []);
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
    const pointerUp = (event: PointerEvent) => {
      const next = releaseFirePointer(firePointer.current, event.pointerId);
      if (next !== firePointer.current) { firePointer.current = next; current.fire(false); }
    };
    const blur = () => { firePointer.current = null; drag.current = null; current.clearInputs(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', current.resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('pointerup', pointerUp); window.removeEventListener('pointercancel', pointerUp); window.removeEventListener('blur', blur);
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
    setStarted(true); setPaused(false); setMenu(false);

  };
  const pause = () => { engine.current?.setPaused(true); setPaused(true); setMenu(true); };
  const resume = () => { engine.current?.setPaused(false); setPaused(false); setMenu(false); };
  const stopFire = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (firePointer.current !== event.pointerId) return;
    firePointer.current = null; engine.current?.fire(false);
  };
  return <div ref={root} className={`zombie-root ${rotated ? 'game-portrait zombie-rotated' : ''}`} data-orientation={orientation}>
    <div ref={mount} className="world-mount" aria-label="3D zombie survival city"
      onPointerDown={event => {
        if (!started || paused || hud.over || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        if (event.pointerType === 'mouse') { firePointer.current = event.pointerId; engine.current?.fire(true); }
      }}
      onPointerMove={event => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        const delta = dragDelta(event.clientX - current.x, event.clientY - current.y, rotated);
        engine.current?.dragLook(delta.x, delta.y);
        drag.current = { ...current, x: event.clientX, y: event.clientY };
      }}
      onPointerUp={event => {
        if (drag.current?.id === event.pointerId) drag.current = null;
        if (firePointer.current === event.pointerId) { firePointer.current = null; engine.current?.fire(false); }
      }}
      onPointerCancel={event => { if (drag.current?.id === event.pointerId) drag.current = null; if (firePointer.current === event.pointerId) { firePointer.current = null; engine.current?.fire(false); } }}
      onLostPointerCapture={event => { if (drag.current?.id === event.pointerId) drag.current = null; if (firePointer.current === event.pointerId) { firePointer.current = null; engine.current?.fire(false); } }}
    />
    <div className="zombie-hud">
      <header className="zombie-top">
        <div className="zombie-brand"><strong>DEAD CITY</strong><span>HUBSIDE SURVIVAL</span></div>
        <div className="zombie-health"><span>HEALTH {hud.health}%</span><div><i style={{ width: hud.health + '%' }} /></div></div>
        <div className="zombie-wave"><strong>WAVE {hud.wave}</strong><small>{hud.alive + hud.queued} REMAINING</small></div>
        <div className="zombie-kills">KILLS <strong>{hud.kills}</strong></div>
        <button className="zombie-menu-button" onClick={pause} aria-label="Pause game">☰</button>
      </header>
      {started && !paused && !hud.over && <div className={`zombie-reticle ${hud.hit ? 'hit' : ''}`} aria-hidden="true">+</div>}
      {started && !paused && !hud.over && <>
        <div className="zombie-controls"><MovementJoystick onMove={onMove} /><LookJoystick onLook={onLook} /></div>
        <button className="zombie-fire" onPointerDown={e => { e.preventDefault(); if (firePointer.current !== null) return; firePointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); engine.current?.fire(true); }}
          onPointerUp={stopFire} onPointerCancel={stopFire} onLostPointerCapture={stopFire}>FIRE</button>
        <button className="zombie-jump" onPointerDown={e => { e.preventDefault(); engine.current?.jump(); }}>JUMP</button>
        <div className="zombie-ammo">
          <span>{hud.weapon.toUpperCase()}</span><b>{hud.reloading ? 'RELOADING' : hud.ammo + ' / ' + hud.reserve}</b>
          <button onClick={() => engine.current?.reload()}>RELOAD</button>
          <div className="zombie-weapons">
            {(['pistol', 'rifle', 'shotgun'] as const).map(w => <button key={w} className={hud.weapon === w ? 'active' : ''} onClick={() => engine.current?.equip(w)}>{w.toUpperCase()}</button>)}
          </div>
        </div>
        {hud.queued === 0 && hud.alive === 0 && <div className="zombie-next-wave">NEXT WAVE IN {Math.max(0, Math.ceil(hud.countdown))}</div>}
        {hud.portal && <button className="zombie-portal-link" onClick={() => window.open(HUBSIDE_URL, '_blank', 'noopener,noreferrer')}>ENTER PORTAL · HUBSIDE ↗</button>}
      </>}
      {(!started || menu || hud.over) && <div className="zombie-overlay">
        <div className="zombie-panel">
          <span className="zombie-eyebrow">HUBSIDE WORLDS</span>
          <h1>{hud.over ? 'GAME OVER' : 'DEAD CITY'}</h1>
          <p>{hud.over ? 'You survived ' + hud.wave + ' waves and eliminated ' + hud.kills + ' zombies.' : 'The streets are overrun. Keep moving, aim and shoot, and survive the waves.'}</p>
          <p className="zombie-hint">{hud.ready ? 'MOVE: WASD / LEFT STICK · AIM: MOUSE DRAG / RIGHT STICK · FIRE: CLICK / FIRE BUTTON' : hud.notice}</p>
          <div className="zombie-orientation" role="group" aria-label="Game orientation">
            {(['portrait', 'landscape'] as const).map(value => <button key={value} aria-pressed={orientation === value} onClick={() => setOrientation(value)}>{value.toUpperCase()}</button>)}
          </div>
          <button className="zombie-start" onClick={hud.over || !started ? start : resume} disabled={!hud.ready}>{hud.over ? 'TRY AGAIN' : started ? 'RESUME' : 'START SURVIVING'}</button>
          {started && !hud.over && <button className="zombie-secondary" onClick={() => { engine.current?.reset(); setMenu(false); setPaused(false); }}>RESTART</button>}
          <button className="zombie-secondary" onClick={() => window.open(HUBSIDE_URL, '_blank', 'noopener,noreferrer')}>GO TO HUBSIDE ↗</button>
        </div>
      </div>}
    </div>
  </div>;
}
