import type { SideId, UmpireDecision } from "./types.js";

export type RallyFaultCode =
  | "incorrect-service"
  | "shuttle-out"
  | "shuttle-fails-net"
  | "shuttle-touches-ceiling-or-wall"
  | "shuttle-touches-object-outside-court"
  | "racket-contact-not-toward-opponent"
  | "shuttle-touches-player"
  | "shuttle-caught-or-slung"
  | "double-hit"
  | "partner-double-hit"
  | "player-touches-net"
  | "court-invasion"
  | "under-net-obstruction"
  | "obstruction"
  | "deliberate-distraction"
  | "misconduct";

export type RallyEvent =
  | { kind: "fault"; against: SideId; code: RallyFaultCode }
  | { kind: "let"; lawRef: "14.2.1" | "14.2.2" | "14.2.3" | "14.2.4" | "14.2.5" | "14.2.6" | "14.2.7"; reason: string }
  | { kind: "rally-won"; winner: SideId };

const FAULTS: Record<RallyFaultCode, { lawRef: string; reason: string }> = {
  "incorrect-service": {
    lawRef: "13.1.1",
    reason: "The service was not delivered in accordance with the service laws.",
  },
  "shuttle-out": {
    lawRef: "13.1.2",
    reason: "The shuttle landed outside the court boundaries.",
  },
  "shuttle-fails-net": {
    lawRef: "13.1.3",
    reason: "The shuttle failed to pass over the net.",
  },
  "shuttle-touches-ceiling-or-wall": {
    lawRef: "13.1.4",
    reason: "The shuttle touched the ceiling or a side wall.",
  },
  "shuttle-touches-player": {
    lawRef: "13.1.5",
    reason: "The shuttle touched the player or the player's dress.",
  },
  "shuttle-touches-object-outside-court": {\n    lawRef: "13.3.5",\n    reason: "The shuttle touched another object or person outside the court.",\n  },\n  "racket-contact-not-toward-opponent": {\n    lawRef: "13.3.9",\n    reason: "The shuttle touched the racket but did not travel towards the opponent’s court.",\n  },\n  "shuttle-caught-or-slung": {
    lawRef: "13.1.7",
    reason: "The shuttle was caught and held on the racket, then slung during the stroke.",
  },
  "double-hit": {
    lawRef: "13.1.8",
    reason: "The shuttle was hit twice in succession by the same player.",
  },
  "partner-double-hit": {
    lawRef: "13.1.9",
    reason: "The shuttle was hit successively by a player and that player's partner.",
  },
  "player-touches-net": {
    lawRef: "13.1.11",
    reason: "The player, racket, or clothing touched the net or its supports while the shuttle was in play.",
  },
  "court-invasion": {
    lawRef: "13.1.12",
    reason: "The player invaded the opponent's court over the net in a way that obstructed or distracted the opponent.",
  },
  "under-net-obstruction": {\n    lawRef: "13.4.3",\n    reason: "The player invaded the opponent’s court under the net and obstructed or distracted the opponent.",\n  },\n  misconduct: {\n    lawRef: "13.5",\n    reason: "The player committed a flagrant, repeated, or persistent offence under Law 16.",\n  },\n  obstruction: {
    lawRef: "13.1.13",
    reason: "The player obstructed an opponent.",
  },
  "deliberate-distraction": {
    lawRef: "13.1.14",
    reason: "The player deliberately distracted an opponent by action or shouting.",
  },
};

/**
 * Converts a detected rally event into the umpire's decision.
 * This module adjudicates supplied observations; it does not infer contact,
 * net faults, or court-line calls from the 3D scene by itself.
 */
export function adjudicateRallyEvent(event: RallyEvent): UmpireDecision {
  if (event.kind === "let") {
    return { kind: "LET", lawRef: event.lawRef, reason: event.reason };
  }
  if (event.kind === "rally-won") {
    return {
      kind: "POINT",
      winner: event.winner,
      lawRef: "7.3",
      reason: "The opposing side failed to make a legal return.",
    };
  }
  const fault = FAULTS[event.code];
  const winner: SideId = event.against === "A" ? "B" : "A";
  return {
    kind: "FAULT",
    against: event.against,
    lawRef: fault.lawRef,
    reason: fault.reason,
  };
}
