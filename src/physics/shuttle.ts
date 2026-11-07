/**
 * Deterministic badminton shuttle flight model.
 * Coordinates: x = lateral, y = height above court, z = court length.
 * BWF Law 13.2 landing decisions are delegated to the pure rules court checker.
 */
import {
  COURT_LENGTH_M,
  DOUBLES_WIDTH_M,
  isLandingInCourt,
} from "../rules/service.js";
import type { MatchMode } from "../rules/types.js";

export interface Vec3 { x: number; y: number; z: number }
export interface ShuttleState { position: Vec3; velocity: Vec3; timeSeconds: number }
export interface ShuttlePhysicsConfig {
  massKg: number;
  airDensityKgM3: number;
  dragCoefficientAreaM2: number;
  gravityMps2: number;
  shuttleRadiusM: number;
  netHeightCenterM: number;
  courtMode: MatchMode;
  fixedStepSeconds: number;
  maxFlightSeconds: number;
}
export interface TrajectorySample extends ShuttleState {}
export type FlightEnd = "ground" | "net" | "timeout" | "out";
export interface TrajectoryResult {
  samples: TrajectorySample[];
  end: FlightEnd;
  landing: Vec3 | null;
  landingInCourt: boolean | null;
  impactSpeedMps: number | null;
  durationSeconds: number;
}

export const DEFAULT_SHUTTLE_CONFIG: Readonly<ShuttlePhysicsConfig> = Object.freeze({
  massKg: 0.0052,
  airDensityKgM3: 1.225,
  // Effective Cd*A tuned as a starting point; calibrate against measured shuttle data.
  dragCoefficientAreaM2: 0.0015,
  gravityMps2: 9.80665,
  shuttleRadiusM: 0.033,
  netHeightCenterM: 1.524,
  courtMode: "singles",
  fixedStepSeconds: 1 / 240,
  maxFlightSeconds: 5,
});

const add = (a: Vec3, b: Vec3): Vec3 => ({ x:a.x+b.x, y:a.y+b.y, z:a.z+b.z });
const scale = (v: Vec3, s: number): Vec3 => ({ x:v.x*s, y:v.y*s, z:v.z*s });
const magnitude = (v: Vec3): number => Math.hypot(v.x,v.y,v.z);
const finite = (v: Vec3): boolean => Number.isFinite(v.x)&&Number.isFinite(v.y)&&Number.isFinite(v.z);

export function createShuttleState(position: Vec3, velocity: Vec3): ShuttleState {
  if (!finite(position) || !finite(velocity)) throw new RangeError("Shuttle vectors must be finite.");
  return { position: { ...position }, velocity: { ...velocity }, timeSeconds: 0 };
}

/** Quadratic drag: Fd = 1/2 rho CdA |v|², directed opposite velocity. */
export function shuttleAcceleration(velocity: Vec3, config: ShuttlePhysicsConfig = DEFAULT_SHUTTLE_CONFIG): Vec3 {
  const speed = magnitude(velocity);
  const dragPerMass = 0.5 * config.airDensityKgM3 * config.dragCoefficientAreaM2 / config.massKg * speed;
  return {
    x: -dragPerMass * velocity.x,
    y: -config.gravityMps2 - dragPerMass * velocity.y,
    z: -dragPerMass * velocity.z,
  };
}

/** Semi-implicit Euler with fixed substeps; no random values are used. */
export function stepShuttle(state: ShuttleState, dt: number, config: ShuttlePhysicsConfig = DEFAULT_SHUTTLE_CONFIG): ShuttleState {
  if (!(dt > 0) || !Number.isFinite(dt)) throw new RangeError("dt must be finite and positive.");
  const a = shuttleAcceleration(state.velocity, config);
  const velocity = add(state.velocity, scale(a, dt));
  return {
    position: add(state.position, scale(velocity, dt)),
    velocity,
    timeSeconds: state.timeSeconds + dt,
  };
}

function netHeightAt(x: number, config: ShuttlePhysicsConfig): number {
  const halfCourtWidth = (config.courtMode === "singles" ? 5.18 : DOUBLES_WIDTH_M) / 2;
  return config.netHeightCenterM + 0.026 * Math.min(1, Math.abs(x) / halfCourtWidth);
}

/**
 * Simulates to first ground/net contact. A net collision is detected by crossing
 * z=0 while the shuttle's lowest point is below the net tape height.
 * Court dimensions and line ownership are read from Phase 1 rules code.
 */
export function simulateTrajectory(
  initial: ShuttleState,
  config: ShuttlePhysicsConfig = DEFAULT_SHUTTLE_CONFIG,
): TrajectoryResult {
  if (!(config.fixedStepSeconds > 0) || !(config.maxFlightSeconds > 0)) {
    throw new RangeError("Physics time-step and flight duration must be positive.");
  }
  if (!(config.massKg > 0) || !(config.airDensityKgM3 >= 0) || !(config.dragCoefficientAreaM2 >= 0)) {
    throw new RangeError("Invalid shuttle aerodynamic parameters.");
  }
  let state: ShuttleState = {
    position: { ...initial.position }, velocity: { ...initial.velocity }, timeSeconds: initial.timeSeconds,
  };
  const samples: TrajectorySample[] = [{ ...state, position: { ...state.position }, velocity: { ...state.velocity } }];
  let end: FlightEnd = "timeout";
  let landing: Vec3 | null = null;
  let impactSpeedMps: number | null = null;
  const maxSteps = Math.ceil(config.maxFlightSeconds / config.fixedStepSeconds);

  for (let i = 0; i < maxSteps; i++) {
    const previous = state;
    state = stepShuttle(state, config.fixedStepSeconds, config);
    // Interpolate the exact net-plane crossing within this fixed physics step.
    if ((previous.position.z < 0 && state.position.z >= 0) || (previous.position.z > 0 && state.position.z <= 0)) {
      const dz = state.position.z - previous.position.z;
      const t = dz === 0 ? 0 : -previous.position.z / dz;
      const crossingY = previous.position.y + (state.position.y - previous.position.y) * t;
      const crossingX = previous.position.x + (state.position.x - previous.position.x) * t;
      if (crossingY - config.shuttleRadiusM <= netHeightAt(crossingX, config)) {
        const contact = { x: crossingX, y: crossingY, z: 0 };
        samples.push({ position: contact, velocity: { ...state.velocity }, timeSeconds: previous.timeSeconds + config.fixedStepSeconds * t });
        end = "net";
        landing = contact;
        impactSpeedMps = magnitude(state.velocity);
        break;
      }
    }
    if (state.position.y <= config.shuttleRadiusM) {
      const dy = previous.position.y - state.position.y;
      const t = dy <= 0 ? 1 : Math.max(0, Math.min(1, (previous.position.y - config.shuttleRadiusM) / dy));
      landing = {
        x: previous.position.x + (state.position.x - previous.position.x) * t,
        y: config.shuttleRadiusM,
        z: previous.position.z + (state.position.z - previous.position.z) * t,
      };
      const landingPoint = {
        x: landing.x,
        distanceFromNet: Math.abs(landing.z),
        footprintRadiusM: config.shuttleRadiusM,
      };
      const insideLength = Math.abs(landing.z) <= COURT_LENGTH_M / 2 + config.shuttleRadiusM;
      const inCourt = insideLength && isLandingInCourt(landingPoint, config.courtMode);
      end = inCourt ? "ground" : "out";
      impactSpeedMps = magnitude(state.velocity);
      samples.push({ position: landing, velocity: { ...state.velocity }, timeSeconds: state.timeSeconds });
      break;
    }
    if (!finite(state.position) || !finite(state.velocity)) throw new Error("Shuttle simulation became non-finite.");
    samples.push({ ...state, position: { ...state.position }, velocity: { ...state.velocity } });
  }
  const durationSeconds = samples[samples.length - 1]?.timeSeconds ?? 0;
  return {
    samples, end, landing,
    landingInCourt: landing ? end === "ground" : null,
    impactSpeedMps, durationSeconds,
  };
}

export function metresPerSecondToKmh(speedMps: number): number {
  return speedMps * 3.6;
}
