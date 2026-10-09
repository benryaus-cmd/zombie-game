export type Orientation = 'portrait' | 'landscape';
export const ORIENTATION_KEY = 'dead-city-orientation';
export function readOrientation(value: string | null): Orientation { return value === 'landscape' ? 'landscape' : 'portrait'; }
export function aimAngles(yaw: number, pitch: number, x: number, y: number, dt: number) {
 return { yaw: yaw - x * dt * 2.9, pitch: Math.max(-.68, Math.min(.68, pitch + y * dt * 1.7)) };
}
export function dragDelta(dx: number, dy: number, rotated: boolean) { return rotated ? { x: -dy, y: dx } : { x: dx, y: dy }; }
export function releaseFirePointer(active: number | null, released: number) { return active === released ? null : active; }

export interface ScreenTap { x: number; y: number; at: number }
/** The first tap must finish before the second press; swipes never arm shooting. */
export const DOUBLE_TAP_MS = 350;
export const TAP_MAX_MS = 260;
export const TAP_MOVE_PX = 23;
export function isTap(start: ScreenTap, end: ScreenTap): boolean {
  return end.at >= start.at && end.at - start.at <= TAP_MAX_MS &&
    Math.hypot(end.x - start.x, end.y - start.y) <= TAP_MOVE_PX;
}
export function isSecondTap(previous: ScreenTap | null, next: ScreenTap): boolean {
  return previous !== null && next.at >= previous.at &&
    next.at - previous.at <= DOUBLE_TAP_MS &&
    Math.hypot(next.x - previous.x, next.y - previous.y) <= 70;
}
