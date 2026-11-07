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
  // BWF Law 9.4 / 14.2.1: a serve delivered before receiver readiness is a let.
  if (!observation.receiverReady) {
    return { kind: "LET", lawRef: "14.2.1", reason: "Receiver was not ready." };
  }

  let serverFault: { lawRef: string; reason: string } | null = null;
  let receiverFault: { lawRef: string; reason: string } | null = null;
  const setServerFault = (lawRef: string, reason: string) => {
    serverFault ??= { lawRef, reason };
  };
  const setReceiverFault = (lawRef: string, reason: string) => {
    receiverFault ??= { lawRef, reason };
  };

  // BWF Law 9.1.1: either side may cause undue delay once both are ready.
  if (observation.undueDelayBy === "server") setServerFault("9.1.1", "Server caused undue delay once both sides were ready.");
  if (observation.undueDelayBy === "receiver") setReceiverFault("9.1.1", "Receiver caused undue delay once both sides were ready.");
  // BWF Law 9.1.2: delay after the server's backward racket-head movement is a server fault.
  if (observation.delayAfterBackwardMovement) {
    setServerFault("9.1.2", "Delay after completion of the server's backward racket-head movement.");
  }

  // BWF Laws 9.1.3–9.1.4: server and receiver are judged independently.
  if (!observation.serverFeetInsideServiceCourt || observation.serverFeetTouchingLine) {
    setServerFault("9.1.3", "Server was outside the service court or touching a boundary line.");
  }
  if (!observation.receiverFeetInsideServiceCourt || observation.receiverFeetTouchingLine) {
    setReceiverFault("9.1.3", "Receiver was outside the service court or touching a boundary line.");
  }
  if (!observation.serverFeetStationary || !observation.serverFeetInContact) {
    setServerFault("9.1.4", "Server's feet were not stationary and in contact with the court.");
  }
  if (!observation.receiverFeetStationary || !observation.receiverFeetInContact) {
    setReceiverFault("9.1.4", "Receiver's feet were not stationary and in contact with the court.");
  }

  // BWF Laws 9.1.5–9.1.9: service delivery/flight requirements apply to server.
  if (!observation.baseStruckFirst) {
    setServerFault("9.1.5", "The racket did not initially hit the base of the shuttle.");
  }
  // Law 9.1.6: the whole shuttle must be strictly below 1.15 m at impact.
  if (!(observation.shuttleTopHeightM < 1.15)) {
    setServerFault("9.1.6", "Whole shuttle was not below 1.15 metres at impact.");
  }
  if (!observation.continuousForwardMovement) {
    setServerFault("9.1.7", "Racket did not continue forwards from service start until delivery.");
  }
  if (!observation.flightUpwards || !observation.wouldLandInCorrectServiceCourt) {
    setServerFault("9.1.8", "Service flight was not upwards over the net toward the correct diagonal service court.");
  }
  if (observation.missedShuttle) {
    setServerFault("9.1.9", "Server missed the shuttle while attempting to serve.");
  }

  // BWF Law 14.2.2: simultaneous server and receiver faults are a let.
  if (serverFault && receiverFault) {
    return { kind: "LET", lawRef: "14.2.2", reason: "Both server and receiver were faulted during service." };
  }
  if (receiverFault) {
    return { kind: "FAULT", against: "receiver", ...receiverFault };
  }
  if (serverFault) {
    return { kind: "FAULT", against: "server", ...serverFault };
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
