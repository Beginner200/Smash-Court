import type {
  LandingPoint,
  MatchMode,
  ServiceEvaluation,
  ServiceObservation,
  ServiceCourt
} from "./types.js";
import { serviceCourtForScore } from "./scoring.js";

/** BWF Laws 1.1, 9.1.1–9.1.9, 10.1 and 11.1. */
export function evaluateService(observation: ServiceObservation): ServiceEvaluation {
  // Law 14.2.2 takes precedence when both server and receiver are faulted in service.
  if (observation.receiverAlsoFaulted) {
    return { kind: "LET", lawRef: "14.2.2", reason: "Both server and receiver faulted during service." };
  }
  // Laws 9.4 and 14.2.1: serving before the receiver is ready is a let.
  if (!observation.receiverReady) {
    return { kind: "LET", lawRef: "14.2.1", reason: "Receiver was not ready." };
  }
  if (observation.undueDelayBy) {
    return { kind: "FAULT", against: observation.undueDelayBy, lawRef: "9.1.1", reason: `Undue delay by the ${observation.undueDelayBy} once both sides were ready.` };
  }
  if (observation.delayAfterBackwardMovement) {
    return { kind: "FAULT", against: "server", lawRef: "9.1.2", reason: "Delay after completion of the server's backward racket-head movement." };
  }
  const serverCourtFault = !observation.serverFeetInsideServiceCourt || observation.serverFeetTouchingLine;
  const receiverCourtFault = !observation.receiverFeetInsideServiceCourt || observation.receiverFeetTouchingLine;
  const serverFootFault = !observation.serverFeetStationary || !observation.serverFeetInContact;
  const receiverFootFault = !observation.receiverFeetStationary || !observation.receiverFeetInContact;
  if (observation.receiverAlsoFaulted ||
      (serverCourtFault || serverFootFault) && (receiverCourtFault || receiverFootFault)) {
    return { kind: "LET", lawRef: "14.2.2", reason: "Both server and receiver were faulted during service." };
  }
  if (serverCourtFault) {
    return { kind: "FAULT", against: "server", lawRef: "9.1.3", reason: "Server was outside the service court or touching a boundary line." };
  }
  if (receiverCourtFault) {
    return { kind: "FAULT", against: "receiver", lawRef: "9.1.3", reason: "Receiver was outside the service court or touching a boundary line." };
  }
  if (serverFootFault) {
    return { kind: "FAULT", against: "server", lawRef: "9.1.4", reason: "Server's feet were not stationary and in contact with the court." };
  }
  if (receiverFootFault) {
    return { kind: "FAULT", against: "receiver", lawRef: "9.1.4", reason: "Receiver's feet were not stationary and in contact with the court." };
  }
  if (!observation.baseStruckFirst) {
    return { kind: "FAULT", against: "server", lawRef: "9.1.5", reason: "The racket did not initially hit the base of the shuttle." };
  }
  // Law 9.1.6: the whole shuttle must be strictly below 1.15 m at impact.
  if (!(observation.shuttleTopHeightM < 1.15)) {
    return { kind: "FAULT", against: "server", lawRef: "9.1.6", reason: "Whole shuttle was not below 1.15 metres at impact." };
  }
  if (!observation.continuousForwardMovement) {
    return { kind: "FAULT", against: "server", lawRef: "9.1.7", reason: "Racket did not continue forwards from service start until delivery." };
  }
  if (!observation.flightUpwards || !observation.wouldLandInCorrectServiceCourt) {
    return { kind: "FAULT", against: "server", lawRef: "9.1.8", reason: "Service flight was not upwards over the net toward the correct diagonal service court." };
  }
  if (observation.missedShuttle) {
    return { kind: "FAULT", against: "server", lawRef: "9.1.9", reason: "Server missed the shuttle while attempting to serve." };
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
  const radius = point.footprintRadiusM ?? 0;
  if (radius < 0) throw new RangeError("Landing footprint radius cannot be negative.");
  // BWF Law 1.3: the line belongs to the court; an edge touching it is IN.
  return (
    Math.abs(point.x) - radius <= halfWidth &&
    Math.abs(point.distanceFromNet) - radius <= COURT_LENGTH_M / 2
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
  const radius = point.footprintRadiusM ?? 0;
  if (radius < 0) throw new RangeError("Landing footprint radius cannot be negative.");
  const correctHalf = serviceCourtForScore(serverScore) === "right"
    ? point.x <= radius
    : point.x >= -radius;
  const backLimit = mode === "singles"
    ? COURT_LENGTH_M / 2
    : COURT_LENGTH_M / 2 - DOUBLES_LONG_SERVICE_LINE_INSET_M;

  return (
    correctHalf &&
    Math.abs(point.x) - radius <= halfWidth &&
    point.distanceFromNet + radius >= SHORT_SERVICE_LINE_FROM_NET_M &&
    point.distanceFromNet - radius <= backLimit
  );
}

/** Server's own score determines the service court, in singles and doubles. */
export function getServiceCourt(serverScore: number): ServiceCourt {
  return serviceCourtForScore(serverScore);
}
