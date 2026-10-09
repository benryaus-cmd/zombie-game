import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import MovementJoystick from '@/components/MovementJoystick';
import LookJoystick from '@/components/LookJoystick';
import { AssetPreview, loadModel, type Model } from '@/game/assetPreview';
import { createWorld } from '@/game/createWorld';
import { disposeWorld } from '@/game/disposeWorld';
import { advanceWorld, jumpWorld, getGroundHeight } from '@/game/worldMovement';
import { advanceWeather, applySkyLighting } from '@/game/skyEffects';
import type { LiveSettings, LookInput, MovementInput, WorldEngine } from '@/game/worldTypes';
import './zombie.css';

type Weapon = 'pistol' | 'rifle' | 'shotgun';
type Hud = {
  health: number; wave: number; kills: number; alive: number; queued: number;
  ammo: number; reserve: number; weapon: Weapon; reloading: boolean;
  countdown: number; over: boolean; ready: boolean; notice: string;
  portal: boolean;
};
type Enemy = {
  root: THREE.Group; mixer: THREE.AnimationMixer | null; action: THREE.AnimationAction | null;
  x: number; z: number; hp: number; speed: number; hitAt: number; deadAt: number;
};
const INITIAL_HUD: Hud = { health: 100, wave: 0, kills: 0, alive: 0, queued: 0, ammo: 12, reserve: 96, weapon: 'pistol', reloading: false, countdown: 0, over: false, ready: false, notice: 'LOADING THE CITY...', portal: false };
const HUBSIDE_URL = 'https://aippy.ai/@PinkYyyy/street-art-canvas-aV7b';
const WEAPONS: Record<Weapon, { rounds: number; delay: number; reload: number; damage: number }> = {
  pistol: { rounds: 12, delay: .32, reload: 1.2, damage: 1 },
  rifle: { rounds: 30, delay: .11, reload: 1.7, damage: 1 },
  shotgun: { rounds: 6, delay: .85, reload: 2, damage: 2 },
};
const ASSET_BASE = import.meta.env.BASE_URL + 'assets/zombie-kit/';
const REMOTE_ASSET_BASE = 'https://raw.githubusercontent.com/benryaus-cmd/zombie-game/8b033b008c3865587759196ed96e852502903cb5/public/assets/zombie-kit/';
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
function attachGun(avatar: THREE.Group, model: THREE.Group, weapon: Weapon): THREE.Group {
  const root = new THREE.Group();
  const bone: THREE.Bone[] = [];
  avatar.traverse(obj => { if (obj instanceof THREE.Bone && /hand[._ -]?r(ight)?$|right[._ -]?hand|r_hand/i.test(obj.name)) bone.push(obj); });
  if (bone.length) {
    bone[0].add(root);
    root.position.set(0, -.03, 0);
    root.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
  } else {
    avatar.add(root);
    root.position.set(.45, 1.25, .48);
    root.rotation.set(-.15, Math.PI, -.16);
  }
  fitModel(model, weapon === 'pistol' ? .29 : .42);
  // Rotate the firearm relative to the animated hand instead of moving the camera or player.
  model.rotation.set(0, Math.PI / 2, 0);
  root.add(model);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(.13, 7, 6),
    new THREE.MeshBasicMaterial({ color: '#ffeaa2', toneMapped: false }));
  flash.name = 'muzzle-flash';
  flash.visible = false;
  flash.position.set(0, 0, -.5);
  root.add(flash);
  return root;
}

class ZombieEngine {
  private world: WorldEngine;
  private avatar: AssetPreview;
  private portal: THREE.Group;
  private aborter = new AbortController();
  private frame = 0;
  private lastFrame = performance.now();
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
  private gunModels = new Map<Weapon, Model>();
  private gunMount: THREE.Group | null = null;
  private clip = '';
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
    this.world.botsEnabled = false;
    applySkyLighting(this.world, 'night');
    this.world.updateChunks(this.world.playerPosition.x, this.world.playerPosition.z);
    this.avatar = new AssetPreview(this.world.scene, this.world.playerAvatar);
    this.portal = createPortal(this.world);
    advanceWorld(this.world, 0, this.controls, this.keys);
    this.setAimCamera();
    this.resize();
    void this.loadAssets();
    this.frame = requestAnimationFrame(this.tick);
  }

  private async loadAssets() {
    try {
      const [zombie, pistol, rifle, shotgun] = await Promise.all([
        loadZombieAsset('Zombie_Ribcage.gltf', this.aborter.signal),
        loadZombieAsset('Pistol.gltf', this.aborter.signal),
        loadZombieAsset('Rifle.gltf', this.aborter.signal),
        loadZombieAsset('Shotgun.gltf', this.aborter.signal),
      ]);
      if (this.disposed) return;
      this.model = zombie;
      this.gunModels.set('pistol', pistol);
      this.gunModels.set('rifle', rifle);
      this.gunModels.set('shotgun', shotgun);
      this.clip = zombie.animations.some(c => c.name === 'Run') ? 'Run' : zombie.animations.find(c => /walk|crawl/i.test(c.name))?.name || zombie.animations[0]?.name || '';
    } catch (error) {
      if (this.disposed) return;
      console.error('Quaternius zombie asset load failed', error);
      this.notice = 'MODEL LOAD FAILED - SIMPLE ZOMBIES ACTIVE';
    }
    if (this.disposed) return;
    await this.avatar.configure({ model: 'casual-male' });
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
  setPaused(value: boolean) { this.paused = value; this.firing = false; this.keys.clear(); this.emitHud(); }

  equip(weapon: Weapon) {
    this.weapon = weapon; this.reloadTimer = 0; this.firing = false;
    if (this.gunMount) {
      this.gunMount.removeFromParent();
      this.gunMount = null;
    }
    const source = this.gunModels.get(weapon);
    if (source) this.gunMount = attachGun(this.world.playerAvatar, source.scene.clone(true) as THREE.Group, weapon);
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
    const now = performance.now() / 1000;
    if (now < this.nextShot) return;
    if (this.ammo[this.weapon] <= 0) { this.reload(); return; }
    this.nextShot = now + WEAPONS[this.weapon].delay;
    this.muzzleUntil = now + .08;
    this.ammo[this.weapon]--;
    const direction = this.world.camera.getWorldDirection(new THREE.Vector3());
    const ray = new THREE.Ray(this.world.camera.position.clone(), direction);
    const range = this.weapon === 'shotgun' ? 35 : 90;
    const possible = this.enemies.filter(e => e.deadAt <= 0).map(enemy => {
      const centre = new THREE.Vector3(enemy.x, enemy.root.position.y + 1.05, enemy.z);
      const distance = centre.sub(ray.origin).dot(direction);
      if (distance <= .2 || distance > range) return null;
      const miss = ray.distanceSqToPoint(new THREE.Vector3(enemy.x, enemy.root.position.y + 1.05, enemy.z));
      const radius = this.weapon === 'shotgun' ? 1.05 + distance * .012 : .72;
      return miss <= radius * radius ? { enemy, distance } : null;
    }).filter((x): x is { enemy: Enemy; distance: number } => !!x)
      .sort((a, b) => a.distance - b.distance);
    const targets = this.weapon === 'shotgun' ? possible.slice(0, 3) : possible.slice(0, 1);
    for (const target of targets) {
      // Wall colliders occlude hits, including enemies visually hidden inside buildings.
      const hidden = this.world.colliders.some(box => {
        const hit = ray.intersectBox(new THREE.Box3(
          new THREE.Vector3(box.minX, box.minY, box.minZ),
          new THREE.Vector3(box.maxX, box.maxY, box.maxZ)), new THREE.Vector3());
        return hit && hit.distanceTo(ray.origin) + .05 < target.distance;
      });
      if (hidden) continue;
      target.enemy.hp -= WEAPONS[this.weapon].damage;
      if (target.enemy.hp <= 0) this.kill(target.enemy);
    }
    if (this.ammo[this.weapon] <= 0) this.reload();
    this.emitHud();
  }
  private kill(enemy: Enemy) {
    enemy.deadAt = performance.now() / 1000;
    this.kills++;
    if (enemy.mixer && this.model) {
      const death = this.model.animations.find(c => /death/i.test(c.name));
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
    let x = px + 16, z = pz;
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2, radius = 15 + Math.random() * 12;
      const sx = px + Math.cos(a) * radius, sz = pz + Math.sin(a) * radius;
      if (!blocked(this.world, sx, sz, .7)) { x = sx; z = sz; break; }
    }
    let visual = this.model ? cloneSkinned(this.model.scene) as THREE.Group : createFallbackZombie();
    const body = new THREE.Group();
    fitModel(visual, 1.85);
    body.add(visual);
    body.position.set(x, getGroundHeight(this.world, x, z), z);
    this.world.scene.add(body);
    let mixer: THREE.AnimationMixer | null = null;
    let action: THREE.AnimationAction | null = null;
    if (this.model && this.clip) {
      mixer = new THREE.AnimationMixer(visual);
      const clip = this.model.animations.find(c => c.name === this.clip);
      if (clip) { action = mixer.clipAction(clip); action.play(); }
    }
    this.enemies.push({ root: body, mixer, action, x, z, hp: this.wave >= 4 && Math.random() < .22 ? 3 : 1,
      speed: 1.55 + this.wave * .16 + Math.random() * .35, hitAt: 0, deadAt: 0 });
    this.queued--;
  }
  private updateEnemy(enemy: Enemy, delta: number, now: number) {
    enemy.mixer?.update(delta);
    if (enemy.deadAt > 0) {
      if (now - enemy.deadAt > 1.45) {
        enemy.mixer?.stopAllAction();
        enemy.root.removeFromParent();
        return false;
      }
      return true;
    }
    const px = this.world.playerPosition.x, pz = this.world.playerPosition.z;
    const dx = px - enemy.x, dz = pz - enemy.z, length = Math.hypot(dx, dz);
    enemy.root.rotation.y = Math.atan2(dx, dz);
    if (length > 1.15) {
      const step = Math.min(length - 1.08, delta * enemy.speed);
      const nx = enemy.x + dx / length * step, nz = enemy.z + dz / length * step;
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
    } else if (now - enemy.hitAt > 1.12) {
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
      this.world.playerYaw -= (this.controls.lookInput?.x || 0) * dt * 2.9;
      this.world.playerPitch = THREE.MathUtils.clamp(this.world.playerPitch + (this.controls.lookInput?.y || 0) * dt * 1.7, -.68, .68);
      advanceWorld(this.world, dt, this.controls, this.keys);
      advanceWeather(this.world, dt);
      this.setAimCamera();
      const now = time / 1000;
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
      const muzzle = this.gunMount?.getObjectByName('muzzle-flash');
      if (muzzle) muzzle.visible = now < this.muzzleUntil;
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
    world.camera.position.copy(world.playerPosition).addScaledVector(forward, -3.3).addScaledVector(right, .85);
    world.camera.position.y += .72;
    const aim = world.playerPosition.clone().addScaledVector(forward, 12);
    aim.y += world.playerPitch * 8;
    world.camera.lookAt(aim);
    world.skyDome.position.copy(world.camera.position);
  }
  reset() {
    for (const enemy of this.enemies) { enemy.mixer?.stopAllAction(); enemy.root.removeFromParent(); }
    this.enemies = [];
    this.health = 100; this.wave = 0; this.kills = 0; this.queued = 0;
    this.countdown = 1.3; this.spawnTimer = 0; this.over = false; this.paused = false;
    this.ammo = { pistol: 12, rifle: 30, shotgun: 6 };
    this.reserve = { pistol: 96, rifle: 240, shotgun: 48 };
    this.reloadTimer = 0; this.weapon = 'pistol'; this.notice = 'SURVIVE THE WAVES';
    this.world.playerPosition.set(0, 1.72, 5);
    this.world.velocityY = 0;
    this.equip('pistol');
    this.emitHud();
  }
  private emitHud() {
    if (this.disposed) return;
    this.onHud({ health: this.health, wave: this.wave, kills: this.kills,
      alive: this.enemies.filter(e => e.deadAt <= 0).length, queued: this.queued,
      ammo: this.ammo[this.weapon], reserve: this.reserve[this.weapon], weapon: this.weapon,
      reloading: this.reloadTimer > 0, countdown: this.countdown,
      over: this.over, ready: this.ready, notice: this.notice, portal: this.portalNear });
  }
  dispose() {
    this.disposed = true; this.aborter.abort(); cancelAnimationFrame(this.frame);
    for (const enemy of this.enemies) { enemy.mixer?.stopAllAction(); enemy.root.removeFromParent(); }
    this.gunMount?.removeFromParent();
    this.avatar.dispose();
    this.portal.removeFromParent();
    disposeWorld(this.world);
  }
}

export default function ZombieGame() {
  const mount = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
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
    const pointerUp = () => current.fire(false);
    const blur = () => { current.fire(false); current.move({ x: 0, y: 0 }); current.look({ x: 0, y: 0 }); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', current.resize);
    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('pointerup', pointerUp); window.removeEventListener('blur', blur);
      window.removeEventListener('resize', current.resize);
      engine.current = null; current.dispose();
    };
  }, []);
  const start = () => {
    if (hud.over) engine.current?.reset();
    engine.current?.setPaused(false);
    setStarted(true); setPaused(false); setMenu(false);
    if (document.documentElement.requestFullscreen) {
      // Fullscreen is optional. Aippy Android may not support it; the CSS layout still works.
      void document.documentElement.requestFullscreen().then(() => {
        const orientation = screen.orientation as ScreenOrientation & { lock?: (value: string) => Promise<void> };
        return orientation.lock?.('landscape').catch(() => undefined);
      }).catch(() => undefined);
    }
  };
  const pause = () => { engine.current?.setPaused(true); setPaused(true); setMenu(true); };
  const resume = () => { engine.current?.setPaused(false); setPaused(false); setMenu(false); };
  const stopFire = useCallback(() => engine.current?.fire(false), []);
  return <div className="zombie-root">
    <div ref={mount} className="world-mount" aria-label="3D zombie survival city"
      onPointerDown={event => {
        if (!started || paused || hud.over || drag.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
        event.preventDefault();
        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
        if (event.pointerType === 'mouse') engine.current?.fire(true);
      }}
      onPointerMove={event => {
        const current = drag.current;
        if (!current || current.id !== event.pointerId) return;
        engine.current?.dragLook(event.clientX - current.x, event.clientY - current.y);
        drag.current = { ...current, x: event.clientX, y: event.clientY };
      }}
      onPointerUp={event => {
        if (drag.current?.id === event.pointerId) drag.current = null;
        engine.current?.fire(false);
      }}
      onPointerCancel={() => { drag.current = null; engine.current?.fire(false); }}
      onLostPointerCapture={() => { drag.current = null; engine.current?.fire(false); }}
    />
    <div className="zombie-hud">
      <header className="zombie-top">
        <div className="zombie-brand"><strong>DEAD CITY</strong><span>HUBSIDE SURVIVAL</span></div>
        <div className="zombie-health"><span>HEALTH {hud.health}%</span><div><i style={{ width: hud.health + '%' }} /></div></div>
        <div className="zombie-wave"><strong>WAVE {hud.wave}</strong><small>{hud.alive + hud.queued} REMAINING</small></div>
        <div className="zombie-kills">KILLS <strong>{hud.kills}</strong></div>
        <button className="zombie-menu-button" onClick={pause} aria-label="Pause game">☰</button>
      </header>
      {started && !paused && !hud.over && <div className="zombie-reticle" aria-hidden="true">+</div>}
      {started && !paused && !hud.over && <>
        <div className="zombie-controls"><MovementJoystick onMove={onMove} /><LookJoystick onLook={onLook} /></div>
        <button className="zombie-fire" onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); engine.current?.fire(true); }}
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
          <button className="zombie-start" onClick={hud.over || !started ? start : resume} disabled={!hud.ready}>{hud.over ? 'TRY AGAIN' : started ? 'RESUME' : 'START SURVIVING'}</button>
          {started && !hud.over && <button className="zombie-secondary" onClick={() => { engine.current?.reset(); setMenu(false); setPaused(false); }}>RESTART</button>}
          <button className="zombie-secondary" onClick={() => window.open(HUBSIDE_URL, '_blank', 'noopener,noreferrer')}>GO TO HUBSIDE ↗</button>
        </div>
      </div>}
    </div>
  </div>;
}
