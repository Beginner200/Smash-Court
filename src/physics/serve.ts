import { createShuttleState, DEFAULT_SHUTTLE_CONFIG, simulateTrajectory, type ShuttleState, type TrajectoryResult } from "./shuttle.js";
import { evaluateService, isServeLandingInServiceCourt } from "../rules/service.js";
import { getServiceCourt } from "../rules/service.js";
import type { MatchMode, ServiceEvaluation } from "../rules/types.js";

export type ServingSide = "player" | "opponent";

/**
 * Playable singles-style service launch for the one-player-versus-AI prototype.
 * Coordinates use +z for the near/player end and -z for the far/AI end.
 */
export function createServeState(server: ServingSide, serverScore: number): ShuttleState {
  if (!Number.isInteger(serverScore) || serverScore < 0) {
    throw new RangeError("Server score must be a non-negative integer.");
  }
  const rightCourt = getServiceCourt(serverScore) === "right";
  const x = server === "player"
    ? (rightCourt ? 0.7 : -0.7)
    : (rightCourt ? -0.7 : 0.7);
  const z = server === "player" ? 6.3 : -6.3;
  const direction = server === "player" ? -1 : 1;
  return createShuttleState(
    { x, y: 0.95, z },
    { x: 0, y: 6.5, z: 42 * direction },
  );
}

export interface ServeCheck {
  trajectory: TrajectoryResult;
  evaluation: ServiceEvaluation;
  landingInCorrectServiceCourt: boolean;
}

/**
 * Evaluates the simulated service landing against the score-selected diagonal box.
 * Foot placement/readiness are assumed valid in this prototype; the shuttle height,
 * upward flight, and service-box landing are checked from the simulated trajectory.
 */
export function evaluateServeFlight(
  initial: ShuttleState,
  server: ServingSide,
  serverScore: number,
  mode: MatchMode,
): ServeCheck {
  const trajectory = simulateTrajectory(initial, { ...DEFAULT_SHUTTLE_CONFIG, courtMode: mode });
  const landing = trajectory.landing;
  const relativeX = landing
    ? (server === "player" ? -landing.x : landing.x)
    : 0;
  const landingInCorrectServiceCourt = trajectory.end === "ground" && !!landing &&
    isServeLandingInServiceCourt(
      { x: relativeX, distanceFromNet: Math.abs(landing.z), footprintRadiusM: DEFAULT_SHUTTLE_CONFIG.shuttleRadiusM },
      mode,
      serverScore,
    );
  const evaluation = evaluateService({
    shuttleTopHeightM: initial.position.y + DEFAULT_SHUTTLE_CONFIG.shuttleRadiusM,
    serverFeetStationary: true,
    serverFeetInContact: true,
    serverFeetInsideServiceCourt: true,
    serverFeetTouchingLine: false,
    receiverFeetStationary: true,
    receiverFeetInContact: true,
    receiverFeetInsideServiceCourt: true,
    receiverFeetTouchingLine: false,
    baseStruckFirst: true,
    continuousForwardMovement: true,
    flightUpwards: initial.velocity.y > 0,
    wouldLandInCorrectServiceCourt: landingInCorrectServiceCourt,
    missedShuttle: false,
    receiverReady: true,
  });
  return { trajectory, evaluation, landingInCorrectServiceCourt };
}
