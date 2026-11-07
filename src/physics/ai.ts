import { createShuttleState, type ShuttleState, type Vec3 } from "./shuttle.js";
import type { ShotType } from "./shots.js";
import type { TrajectoryResult } from "./shuttle.js";

/** AI can chase only valid landings on the opponent's (negative-z) half. */
export function getAiLandingTarget(result: TrajectoryResult): Vec3 | null {
  if (result.end !== "ground" || !result.landing || result.landing.z >= 0) return null;
  return { x: result.landing.x, y: 0, z: result.landing.z };
}

/** Choose a basic return based on how far forward/back the player is standing. */
export function chooseAiReturnShot(player: Vec3): ShotType {
  if (![player.x, player.y, player.z].every(Number.isFinite)) throw new RangeError("Player position must be finite.");
  if (player.z >= 5.2) return "drop";
  if (player.z <= 1.8 || Math.abs(player.x) >= 1.7) return "clear";
  return "drop";
}

/** A simple prototype return stroke aimed generally back toward the human side. */
export function createAiReturnState(position: Vec3, playerX = 0, shotType: ShotType = "clear"): ShuttleState {
  if (![position.x, position.y, position.z, playerX].every(Number.isFinite)) {
    throw new RangeError("AI return coordinates must be finite.");
  }
  const lateral = Math.max(-2.5, Math.min(2.5, (playerX - position.x) * 0.5));
  // The earlier profiles lost nearly all forward speed to shuttle drag and
  // landed beside the net. These lower, longer profiles reach the player's half
  // at a playable height and give the player time to move into racket range.
  const profile = shotType === "drop" ? { y: 6, z: 24 } : { y: 8, z: 28 };
  return createShuttleState(position, { x: lateral, y: profile.y, z: profile.z });
}
