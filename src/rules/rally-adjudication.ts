import type { SideId, UmpireDecision } from "./types.js";

export type RallyFaultCode =
  | "incorrect-service"
  | "service-shuttle-caught-on-net"
  | "service-shuttle-caught-in-net"
  | "receiver-partner-hits-serve"
  | "shuttle-out"
  | "shuttle-fails-net"
  | "shuttle-touches-ceiling-or-wall"
  | "shuttle-touches-object-outside-court"
  | "shuttle-touches-player"
  | "shuttle-caught-or-slung"
  | "double-hit"
  | "partner-double-hit"
  | "racket-contact-not-toward-opponent"
  | "player-touches-net"
  | "court-invasion"
  | "under-net-obstruction"
  | "obstruction"
  | "deliberate-distraction"
  | "misconduct";

export type RallyEvent =
  | { kind: "fault"; against: SideId; code: RallyFaultCode }
  | {
      kind: "let";
      lawRef: "14.2.1" | "14.2.2" | "14.2.3" | "14.2.4" | "14.2.5" | "14.2.6" | "14.2.7";
      reason: string;
    }
  | { kind: "rally-won"; winner: SideId };

const FAULTS: Record<RallyFaultCode, { lawRef: string; reason: string }> = {
  "incorrect-service": {
    lawRef: "13.1",
    reason: "The service was not delivered in accordance with Law 9.1.",
  },
  "service-shuttle-caught-on-net": {
    lawRef: "13.2.1",
    reason: "The served shuttle was caught on the net and remained suspended on its top.",
  },
  "service-shuttle-caught-in-net": {
    lawRef: "13.2.2",
    reason: "After passing over the net, the served shuttle was caught in the net.",
  },
  "receiver-partner-hits-serve": {
    lawRef: "13.2.3",
    reason: "The receiver's partner hit the serve.",
  },
  "shuttle-out": {
    lawRef: "13.3.1",
    reason: "The shuttle landed outside the court boundaries.",
  },
  "shuttle-fails-net": {
    lawRef: "13.3.2",
    reason: "The shuttle failed to pass over the net.",
  },
  "shuttle-touches-ceiling-or-wall": {
    lawRef: "13.3.3",
    reason: "The shuttle touched the ceiling or a side wall.",
  },
  "shuttle-touches-player": {
    lawRef: "13.3.4",
    reason: "The shuttle touched a player's person or dress.",
  },
  "shuttle-touches-object-outside-court": {
    lawRef: "13.3.5",
    reason: "The shuttle touched another object or person outside the court.",
  },
  "shuttle-caught-or-slung": {
    lawRef: "13.3.6",
    reason: "The shuttle was caught and held on the racket, then slung during the stroke.",
  },
  "double-hit": {
    lawRef: "13.3.7",
    reason: "The shuttle was hit twice in succession by the same player.",
  },
  "partner-double-hit": {
    lawRef: "13.3.8",
    reason: "The shuttle was hit successively by a player and that player's partner.",
  },
  "racket-contact-not-toward-opponent": {
    lawRef: "13.3.9",
    reason: "The shuttle touched the racket but did not travel towards the opponent's court.",
  },
  "player-touches-net": {
    lawRef: "13.4.1",
    reason: "The player, racket, or clothing touched the net or its supports while the shuttle was in play.",
  },
  "court-invasion": {
    lawRef: "13.4.2",
    reason: "The player illegally invaded the opponent's court over the net.",
  },
  "under-net-obstruction": {
    lawRef: "13.4.3",
    reason: "The player invaded the opponent's court under the net and obstructed or distracted the opponent.",
  },
  obstruction: {
    lawRef: "13.4.4",
    reason: "The player obstructed an opponent from making a legal stroke.",
  },
  "deliberate-distraction": {
    lawRef: "13.4.5",
    reason: "The player deliberately distracted an opponent by action such as shouting or gestures.",
  },
  misconduct: {
    lawRef: "13.5",
    reason: "The player committed a flagrant, repeated, or persistent offence under Law 16.",
  },
};

/**
 * Converts a detected rally event into an umpire decision.
 * This adjudicates supplied observations; it does not infer contacts or line calls
 * from the 3D scene by itself.
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
  return {
    kind: "FAULT",
    against: event.against,
    lawRef: fault.lawRef,
    reason: fault.reason,
  };
}
