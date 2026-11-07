import { createShuttleState, type ShuttleState, type Vec3 } from "./shuttle.js";

export type ShotType = "clear" | "drop" | "smash" | "lift";

export interface ShotProfile {
  label: string;
  description: string;
  velocity: Vec3;
}

/**
 * Playable prototype shot profiles. Values are initial velocities in m/s;
 * they are tuning presets, not measured professional-player shot data.
 */
export const SHOT_PROFILES: Readonly<Record<ShotType, ShotProfile>> = Object.freeze({
  clear: {
    label: "Clear",
    description: "High, deep shot toward the opponent's back court.",
    velocity: { x: 0, y: 12, z: -25 },
  },
  drop: {
    label: "Drop",
    description: "Gentler attacking shot intended to fall near the net.",
    velocity: { x: 0, y: 6, z: -22 },
  },
  smash: {
    label: "Smash",
    description: "Fast, steep attacking shot.",
    velocity: { x: 0, y: 5, z: -34 },
  },
  lift: {
    label: "Lift",
    description: "High defensive shot toward the opponent's rear court.",
    velocity: { x: 0, y: 14, z: -24 },
  },
});

export function createShotState(
  type: ShotType,
  position: Vec3,
  lateralAimM = 0,
): ShuttleState {
  const profile = SHOT_PROFILES[type];
  if (!profile) throw new RangeError(`Unknown shot type: ${String(type)}`);
  if (!Number.isFinite(lateralAimM)) throw new RangeError("Shot aim must be finite.");
  return createShuttleState(position, {
    x: lateralAimM,
    y: profile.velocity.y,
    z: profile.velocity.z,
  });
}
