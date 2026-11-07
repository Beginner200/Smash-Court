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
export function chooseAiReturnPlan(
  player: Vec3,
  aiPosition: Vec3,
  rallyIndex = 0,
  partner?: Vec3,
): AiReturnPlan {
  const values = [player.x, player.y, player.z, aiPosition.x, aiPosition.y, aiPosition.z, rallyIndex];
  if (partner) values.push(partner.x, partner.y, partner.z);
  if (!values.every(Number.isFinite)) {
    throw new RangeError("AI strategy coordinates and rally index must be finite.");
  }

  // Singles keeps its established behavior. In doubles, score a set of safe
  // landing zones by how far each is from BOTH receivers, not just the human.
  if (partner) {
    const receivers = [player, partner];
    const xs = [-2.45, -1.25, 0, 1.25, 2.45];
    const zs = [0.95, 2.35, 4.05, 5.75];
    let bestTarget = { x: 0, y: 0, z: 2.35 };
    let bestScore = -Infinity;
    for (const x of xs) {
      for (const z of zs) {
        const nearestReceiver = Math.min(...receivers.map(receiver =>
          Math.hypot(x - receiver.x, z - receiver.z)
        ));
        // Slightly favor the front/back depth variation when several spaces
        // are similarly open, while keeping every target safely in court.
        const depthVariation = ((Math.floor(rallyIndex) + xs.indexOf(x) + zs.indexOf(z)) % 2) * 0.08;
        const score = nearestReceiver + depthVariation;
        if (score > bestScore) {
          bestScore = score;
          bestTarget = { x, y: 0, z };
        }
      }
    }
    const shotType: ShotType = bestTarget.z <= 2.35 ? "drop" : "clear";
    return { shotType, target: bestTarget };
  }

  const playerX = Math.max(-2.35, Math.min(2.35, player.x));
  const playerZ = Math.max(0.45, Math.min(6.25, player.z));
  const targetX = Math.abs(playerX) < 0.55
    ? (Math.floor(rallyIndex) % 2 === 0 ? 1.75 : -1.75)
    : playerX > 0 ? -1.75 : 1.75;
  const targetZ = playerZ > 3.45 ? 1.85 : 5.55;
  const shotType: ShotType = targetZ < 3 ? "drop" : "clear";
  return { shotType, target: { x: targetX, y: 0, z: targetZ } };
}

/**
 * Aim the AI return at a chosen open-court target. A binary search calibrates
 * horizontal launch speed against the same drag model used by the live shuttle.
 */
export function createAiReturnState(position: Vec3, playerTarget: Vec3, shotType: ShotType = "clear", courtMode: "singles" | "doubles" = "singles"): ShuttleState {
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
    const flight = simulateTrajectory(candidate, { ...DEFAULT_SHUTTLE_CONFIG, courtMode });
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


/**
 * Calibrate the doubles partner's return to land safely in the opponent's
 * half-court. This avoids using the full-strength generic clear profile,
 * which can carry beyond the back boundary when the partner contacts deep.
 */
/**
 * Select a doubles partner return from the incoming contact situation.
 * Low contacts are lifted, high attacking contacts are smashed, front-court
 * contacts are dropped, and neutral contacts are played deep as clears.
 */
export function chooseDoublesPartnerShot(
  position: Vec3,
  incomingVelocity: Vec3,
  rallyIndex = 0,
): ShotType {
  if (![position.x, position.y, position.z, incomingVelocity.x, incomingVelocity.y, incomingVelocity.z, rallyIndex].every(Number.isFinite)) {
    throw new RangeError("Partner shot selection inputs must be finite.");
  }
  if (position.y <= 1.08 || (position.y <= 1.38 && incomingVelocity.y < -6.5)) return "lift";
  if (position.y >= 1.9 && incomingVelocity.y < 0) return "smash";
  if (position.z <= 2.65 && position.y >= 1.25) return "drop";
  // In neutral mid-court exchanges, vary the safe deep return occasionally.
  return Math.floor(rallyIndex) % 3 === 2 ? "lift" : "clear";
}

/**
 * Calibrate a partner return for its chosen shot type. Each profile has its
 * own trajectory and landing target, while candidate speeds are checked with
 * the doubles court width and the same shuttle-flight model used in play.
 */
export function createDoublesPartnerReturnState(
  position: Vec3,
  shotType: ShotType = "clear",
): ShuttleState {
  if (![position.x, position.y, position.z].every(Number.isFinite)) {
    throw new RangeError("Partner return position must be finite.");
  }

  const profile: Record<ShotType, { targetZ: number; launchY: number }> = {
    clear: { targetZ: -5.35, launchY: 10.5 },
    drop: { targetZ: -1.45, launchY: 5.2 },
    smash: { targetZ: -3.35, launchY: -1.2 },
    lift: { targetZ: -5.8, launchY: 14.5 },
  };
  const selected = profile[shotType];
  const target = {
    x: Math.max(-2.65, Math.min(2.65, -position.x * 0.28)),
    z: selected.targetZ,
  };
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.01 || dz >= 0) {
    return createShuttleState(position, { x: 0, y: 8, z: -18 });
  }
  const direction = { x: dx / distance, z: dz / distance };
  const doublesConfig = { ...DEFAULT_SHUTTLE_CONFIG, courtMode: "doubles" as const };
  let best: ShuttleState | null = null;
  let bestError = Number.POSITIVE_INFINITY;

  // A bounded speed sweep is more reliable than assuming every shot type has
  // the same monotonic launch-speed/landing-distance relationship.
  for (let i = 0; i <= 32; i++) {
    const speed = 7 + i * 0.95;
    const candidate = createShuttleState(position, {
      x: direction.x * speed,
      y: selected.launchY,
      z: direction.z * speed,
    });
    const flight = simulateTrajectory(candidate, doublesConfig);
    const landing = flight.landing;
    if (flight.end !== "ground" || !landing || landing.z >= 0 || Math.abs(landing.x) > 3.1) continue;
    const error = Math.hypot(landing.x - target.x, landing.z - target.z);
    if (error < bestError) {
      best = candidate;
      bestError = error;
    }
  }

  // If a particularly awkward contact cannot support the selected profile,
  // safely fall back to a calibrated clear instead of sending a wild shot.
  if (!best && shotType !== "clear") return createDoublesPartnerReturnState(position, "clear");
  if (best) return best;

  // Last-resort safe forward return for unusual edge-of-court contacts.
  return createShuttleState(position, { x: 0, y: 8, z: -18 });
}
