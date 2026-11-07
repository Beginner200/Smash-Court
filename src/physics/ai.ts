import { createShuttleState, type ShuttleState, type Vec3 } from "./shuttle.js";
import type { TrajectoryResult } from "./shuttle.js";

/** AI can chase only valid landings on the opponent's (negative-z) half. */
export function getAiLandingTarget(result: TrajectoryResult): Vec3 | null {
  if (result.end !== "ground" || !result.landing || result.landing.z >= 0) return null;
  return { x: result.landing.x, y: 0, z: result.landing.z };
}

/** A simple prototype return stroke aimed generally back toward the human side. */
export function createAiReturnState(position: Vec3, playerX = 0): ShuttleState {
  if (![position.x, position.y, position.z, playerX].every(Number.isFinite)) {
    throw new RangeError("AI return coordinates must be finite.");
  }
  const lateral = Math.max(-2.5, Math.min(2.5, (playerX - position.x) * 0.5));
  return createShuttleState(position, { x: lateral, y: 8.5, z: 24 });
}
