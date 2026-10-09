export type Orientation = 'portrait' | 'landscape';
export const ORIENTATION_KEY = 'dead-city-orientation';
export function readOrientation(value: string | null): Orientation { return value === 'landscape' ? 'landscape' : 'portrait'; }
export function aimAngles(yaw: number, pitch: number, x: number, y: number, dt: number) {
 return { yaw: yaw - x * dt * 2.9, pitch: Math.max(-.68, Math.min(.68, pitch + y * dt * 1.7)) };
}
export function dragDelta(dx: number, dy: number, rotated: boolean) { return rotated ? { x: -dy, y: dx } : { x: dx, y: dy }; }
export function releaseFirePointer(active: number | null, released: number) { return active === released ? null : active; }
