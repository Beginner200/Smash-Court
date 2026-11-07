import { createShuttleState, DEFAULT_SHUTTLE_CONFIG, simulateTrajectory, type ShuttleState, type Vec3 } from "./shuttle.js";
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

/**
 * Aim the AI return at the player's current court position.
 * A short binary search calibrates horizontal launch speed against the same
 * drag model used by the live shuttle, so moving forward/back or sideways
 * changes where the AI places its return.
 */
export function createAiReturnState(position: Vec3, playerTarget: Vec3, shotType: ShotType = "clear"): ShuttleState {
  if (![position.x, position.y, position.z, playerTarget.x, playerTarget.y, playerTarget.z].every(Number.isFinite)) {
    throw new RangeError("AI return coordinates must be finite.");
  }

  const target = {
    x: Math.max(-2.4, Math.min(2.4, playerTarget.x)),
    z: Math.max(0.45, Math.min(6.25, playerTarget.z)),
  };
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.01 || dz <= 0) {
    return createShuttleState(position, { x: 0, y: 6, z: 20 });
  }

  const profile = shotType === "drop" ? { y: 6 } : { y: 8 };
  const direction = { x: dx / distance, z: dz / distance };
  let low = 6;
  let high = 42;
  let best = createShuttleState(position, { x: direction.x * 22, y: profile.y, z: direction.z * 22 });
  let bestError = Number.POSITIVE_INFINITY;

  for (let i = 0; i < 22; i++) {
    const speed = (low + high) / 2;
    const candidate = createShuttleState(position, {
      x: direction.x * speed,
      y: profile.y,
      z: direction.z * speed,
    });
    const flight = simulateTrajectory(candidate, DEFAULT_SHUTTLE_CONFIG);
    const landing = flight.landing;
    if (landing) {
      const landedDistance = Math.hypot(landing.x - position.x, landing.z - position.z);
      const error = Math.abs(landedDistance - distance);
      if (flight.end === "ground" && error < bestError) {
        best = candidate;
        bestError = error;
      }
      if (landedDistance < distance) low = speed;
      else high = speed;
    } else {
      high = speed;
    }
  }
  return best;
}
