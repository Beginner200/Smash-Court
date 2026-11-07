import type { Vec3 } from "./shuttle.js";

export interface PlayerRacketPosition extends Vec3 {}

/** Reach measured from the player's approximate racket-hand position. */
export const PLAYER_HIT_REACH_M = 1.6;
export const PLAYER_RACKET_HEIGHT_M = 0.9;

/** True only when the shuttle is close enough and within a playable height. */
export function canPlayerHitShuttle(
  player: Vec3,
  shuttle: Vec3,
  reachM = PLAYER_HIT_REACH_M,
): boolean {
  if (![player.x, player.y, player.z, shuttle.x, shuttle.y, shuttle.z, reachM].every(Number.isFinite) || reachM < 0) {
    return false;
  }
  if (shuttle.y < 0.25 || shuttle.y > 3.2) return false;
  const racket = { x: player.x, y: player.y + PLAYER_RACKET_HEIGHT_M, z: player.z };
  return Math.hypot(shuttle.x - racket.x, shuttle.y - racket.y, shuttle.z - racket.z) <= reachM;
}
