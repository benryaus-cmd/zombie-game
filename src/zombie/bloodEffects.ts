import * as THREE from 'three';

/** One reusable particle buffer and one instanced blood-decal draw call for the entire horde. */
const DROPLETS = 360;
const STAINS = 140;
type Drop = { life: number; velocity: THREE.Vector3 };
export class BloodEffects {
  private readonly positions = new Float32Array(DROPLETS * 3);
  private readonly colours = new Float32Array(DROPLETS * 3);
  private readonly drops: Drop[] = [];
  private readonly points: THREE.Points;
  private readonly decals: THREE.InstancedMesh;
  private readonly splatterTexture: THREE.CanvasTexture;
  private particleIndex = 0;
  private stainIndex = 0;
  private clock = 0;
  private readonly stains: { expires: number; active: boolean }[] = [];
  private readonly unused = new THREE.Matrix4().makeScale(0, 0, 0);
  constructor(private readonly scene: THREE.Scene) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const context = canvas.getContext('2d');
    if (context) {
      context.clearRect(0, 0, 64, 64);
      context.fillStyle = '#fff';
      context.beginPath();
      for (let i = 0; i < 18; i++) {
        const angle = (i / 18) * Math.PI * 2;
        const radius = 23 + Math.sin(i * 13.3) * 4 + Math.sin(i * 7.7) * 6;
        const x = 32 + Math.cos(angle) * radius;
        const y = 32 + Math.sin(angle) * radius;
        if (!i) context.moveTo(x, y); else context.lineTo(x, y);
      }
      context.closePath();
      context.fill();
    }
    this.splatterTexture = new THREE.CanvasTexture(canvas);
    this.splatterTexture.colorSpace = THREE.SRGBColorSpace;
    this.splatterTexture.minFilter = THREE.LinearFilter;
    this.splatterTexture.magFilter = THREE.LinearFilter;
    const geometry = new THREE.BufferGeometry();
    for (let i = 0; i < DROPLETS; i++) {
      this.positions[i * 3 + 1] = -10000;
      this.drops.push({ life: 0, velocity: new THREE.Vector3() });
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colours, 3));
    const dots = new THREE.PointsMaterial({
      size: .17, map: this.splatterTexture, transparent: true,
      alphaTest: .08, vertexColors: true, depthWrite: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geometry, dots);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.decals = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: '#981619', map: this.splatterTexture, transparent: true,
        side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
      STAINS,
    );
    this.decals.frustumCulled = false;
    this.decals.renderOrder = 3;
    for (let i = 0; i < STAINS; i++) {
      this.decals.setMatrixAt(i, this.unused);
      this.stains.push({ expires: 0, active: false });
    }
    this.decals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.decals.instanceMatrix.needsUpdate = true;
    scene.add(this.decals);
  }

  burst(point: THREE.Vector3, incoming: THREE.Vector3, strength: number, floorY: number, fatal = false) {
    const count = Math.min(46, Math.max(6, Math.ceil(strength * (fatal ? 2.8 : 1.7))));
    const heading = incoming.clone().normalize();
    for (let j = 0; j < count; j++) {
      const i = this.particleIndex++ % DROPLETS;
      const p = i * 3;
      this.positions[p] = point.x + (Math.random() - .5) * .17;
      this.positions[p + 1] = point.y + (Math.random() - .5) * .23;
      this.positions[p + 2] = point.z + (Math.random() - .5) * .17;
      const speed = .8 + Math.random() * (fatal ? 5.5 : 3.5);
      this.drops[i].velocity.set(
        heading.x * speed + (Math.random() - .5) * 4,
        1 + Math.random() * (fatal ? 4.6 : 3.4),
        heading.z * speed + (Math.random() - .5) * 4,
      );
      this.drops[i].life = .35 + Math.random() * .75;
      const shade = Math.random();
      this.colours[p] = .56 + shade * .44;
      this.colours[p + 1] = .012 + shade * .045;
      this.colours[p + 2] = .012 + shade * .055;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.points.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    const numStains = fatal ? 5 + Math.floor(Math.random() * 4) : Math.random() < .6 ? 2 : 1;
    for (let k = 0; k < numStains; k++) {
      const spread = fatal ? 1.15 : .55;
      this.stain(new THREE.Vector3(
        point.x + (Math.random() - .5) * spread,
        floorY + .028 + Math.random() * .008,
        point.z + (Math.random() - .5) * spread,
      ), (fatal ? .45 : .22) + Math.random() * (fatal ? .75 : .4));
    }
  }

  private stain(position: THREE.Vector3, size: number) {
    const i = this.stainIndex++ % STAINS;
    const angle = Math.random() * Math.PI * 2;
    const matrix = new THREE.Matrix4().compose(
      position,
      new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, angle)),
      new THREE.Vector3(size, size * (.6 + Math.random() * .8), 1),
    );
    this.decals.setMatrixAt(i, matrix);
    this.stains[i] = { expires: this.clock + 18 + Math.random() * 14, active: true };
    this.decals.instanceMatrix.needsUpdate = true;
  }

  update(dt: number, floorHeight: (x: number, z: number) => number) {
    this.clock += dt;
    let changed = false;
    for (let i = 0; i < DROPLETS; i++) {
      const drop = this.drops[i];
      if (drop.life <= 0) continue;
      changed = true;
      const p = i * 3;
      this.positions[p] += drop.velocity.x * dt;
      this.positions[p + 1] += drop.velocity.y * dt;
      this.positions[p + 2] += drop.velocity.z * dt;
      drop.velocity.y -= 12 * dt;
      drop.life -= dt;
      if (drop.life <= 0 || this.positions[p + 1] <= floorHeight(this.positions[p], this.positions[p + 2]) + .055) {
        drop.life = 0;
        this.positions[p + 1] = -10000;
      }
    }
    if (changed) (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    let stainsChanged = false;
    for (let i = 0; i < STAINS; i++) {
      if (this.stains[i].active && this.clock >= this.stains[i].expires) {
        this.stains[i].active = false;
        this.decals.setMatrixAt(i, this.unused);
        stainsChanged = true;
      }
    }
    if (stainsChanged) this.decals.instanceMatrix.needsUpdate = true;
  }

  clear() {
    for (let i = 0; i < DROPLETS; i++) {
      this.drops[i].life = 0;
      this.positions[i * 3 + 1] = -10000;
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    for (let i = 0; i < STAINS; i++) {
      this.decals.setMatrixAt(i, this.unused);
      this.stains[i].active = false;
    }
    this.decals.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.points.removeFromParent();
    this.decals.removeFromParent();
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.decals.geometry.dispose();
    (this.decals.material as THREE.Material).dispose();
    this.splatterTexture.dispose();
  }
}
