import { createShuttleState, DEFAULT_SHUTTLE_CONFIG, simulateTrajectory, type ShuttleState, type Vec3 } from "./shuttle.js";
import type { ShotType } from "./shots.js";
import type { TrajectoryResult } from "./shuttle.js";

export interface AiReturnPlan {
  shotType: ShotType;
  target: Vec3;
}

/** AI can chase only valid landings on the opponent's (negative-z) half. */
export function getAiLandingTarget(result: TrajectoryResult): Vec3 | null {
  if (result.end !== "ground" || !result.landing || result.landing.z >= 0) return null;
  return { x: result.landing.x, y: 0, z: result.landing.z };
}

/** Legacy simple choice, retained for callers that only need a shot type. */
export function chooseAiReturnShot(player: Vec3): ShotType {
  if (![player.x, player.y, player.z].every(Number.isFinite)) throw new RangeError("Player position must be finite.");
  if (player.z >= 5.2) return "drop";
  if (player.z <= 1.8 || Math.abs(player.x) >= 1.7) return "clear";
  return "drop";
}

/**
 * Pick a safe open-court target away from the player's current position.
 * rallyIndex alternates the lateral corner when the player is near the middle,
 * keeping the behavior deterministic and straightforward to test.
 */
export function chooseAiReturnPlan(player: Vec3, aiPosition: Vec3, rallyIndex = 0): AiReturnPlan {
  if (![player.x, player.y, player.z, aiPosition.x, aiPosition.y, aiPosition.z, rallyIndex].every(Number.isFinite)) {
    throw new RangeError("AI strategy coordinates and rally index must be finite.");
  }
  const playerX = Math.max(-2.35, Math.min(2.35, player.x));
  const playerZ = Math.max(0.45, Math.min(6.25, player.z));
  const targetX = Math.abs(playerX) < 0.55
    ? (Math.floor(rallyIndex) % 2 === 0 ? 1.75 : -1.75)
    : playerX > 0 ? -1.75 : 1.75;
  const targetZ = playerZ > 3.45 ? 1.85 : 5.55;
  const shotType: ShotType = targetZ < 3 ? "drop" : "clear";
  return {
    shotType,
    target: { x: targetX, y: 0, z: targetZ },
  };
}

/**
 * Aim the AI return at a chosen open-court target. A binary search calibrates
 * horizontal launch speed against the same drag model used by the live shuttle.
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
