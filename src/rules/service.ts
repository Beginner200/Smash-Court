import type {
  LandingPoint,
  MatchMode,
  ServiceEvaluation,
  ServiceObservation,
  ServiceCourt
} from "./types.js";
import { serviceCourtForScore } from "./scoring.js";

/** BWF Laws 1.1, 9.1.3–9.1.7, 10.1 and 11.1. */
export function evaluateService(observation: ServiceObservation): ServiceEvaluation {
  // Law 14.2.2 takes precedence when both server and receiver are faulted in service.
  if (observation.receiverAlsoFaulted) {
    return { kind: "LET", lawRef: "14.2.2", reason: "Both server and receiver faulted during service." };
  }
  // Laws 9.4 and 14.2.1: serving before the receiver is ready is a let.
  if (!observation.receiverReady) {
    return { kind: "LET", lawRef: "14.2.1", reason: "Receiver was not ready." };
  }
  if (observation.undueDelay) {
    return { kind: "FAULT", lawRef: "9.1.1", reason: "Undue delay in delivering the service." };
  }
  if (!observation.serverFeetInsideServiceCourt || observation.serverFeetTouchingLine ||
      !observation.receiverFeetInsideServiceCourt || observation.receiverFeetTouchingLine) {
    return { kind: "FAULT", lawRef: "9.1.3", reason: "Server or receiver is outside the correct service court or touching a boundary line." };
  }
  if (!observation.serverFeetStationary || !observation.serverFeetInContact ||
      !observation.receiverFeetStationary || !observation.receiverFeetInContact) {
    return { kind: "FAULT", lawRef: "9.1.4", reason: "Some part of both players' feet did not remain in contact with the court in a stationary position." };
  }
  if (!observation.baseStruckFirst || !observation.releasedWithoutSpin) {
    return { kind: "FAULT", lawRef: "9.1.5", reason: "Shuttle was not released without added spin or the racket did not initially hit its base." };
  }
  // Law 9.1.6: the whole shuttle must be strictly below 1.15 m at impact.
  if (!(observation.shuttleTopHeightM < 1.15)) {
    return { kind: "FAULT", lawRef: "9.1.6", reason: "Whole shuttle was not below 1.15 metres at impact." };
  }
  if (!observation.continuousForwardMovement) {
    return { kind: "FAULT", lawRef: "9.1.7", reason: "Racket did not continue forwards from service start until delivery." };
  }
  if (observation.missedShuttle) {
    return { kind: "FAULT", lawRef: "9.1.8", reason: "Server missed the shuttle while attempting to serve." };
  }
  return { kind: "LEGAL", lawRef: "9.1", reason: "Correct service" };
}

export const COURT_LENGTH_M = 13.4;
export const DOUBLES_WIDTH_M = 6.1;
export const SINGLES_WIDTH_M = 5.18;
export const SHORT_SERVICE_LINE_FROM_NET_M = 1.98;
export const DOUBLES_LONG_SERVICE_LINE_INSET_M = 0.76;

/** BWF Law 1.3: boundary lines form part of the court, so equality is IN. */
export function isLandingInCourt(point: LandingPoint, mode: MatchMode): boolean {
  const halfWidth = (mode === "singles" ? SINGLES_WIDTH_M : DOUBLES_WIDTH_M) / 2;
  return (
    Math.abs(point.x) <= halfWidth &&
    Math.abs(point.distanceFromNet) <= COURT_LENGTH_M / 2
  );
}

/**
 * Checks a serve in server-relative coordinates.
 * BWF Law 10.1 (singles) and Law 11.1 (doubles).
 * Singles uses the back boundary line; the doubles long service line is
 * an internal line in singles and is therefore not a singles service boundary.
 */
export function isServeLandingInServiceCourt(
  point: LandingPoint,
  mode: MatchMode,
  serverScore: number
): boolean {
  const halfWidth = (mode === "singles" ? SINGLES_WIDTH_M : DOUBLES_WIDTH_M) / 2;
  const correctHalf = serviceCourtForScore(serverScore) === "right"
    ? point.x <= 0
    : point.x >= 0;
  const backLimit = mode === "singles"
    ? COURT_LENGTH_M / 2
    : COURT_LENGTH_M / 2 - DOUBLES_LONG_SERVICE_LINE_INSET_M;

  return (
    correctHalf &&
    Math.abs(point.x) <= halfWidth &&
    point.distanceFromNet >= SHORT_SERVICE_LINE_FROM_NET_M &&
    point.distanceFromNet <= backLimit
  );
}

/** Server's own score determines the service court, in singles and doubles. */
export function getServiceCourt(serverScore: number): ServiceCourt {
  return serviceCourtForScore(serverScore);
}
