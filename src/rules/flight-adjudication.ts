import type { SideId } from "./types.js";
import type { RallyEvent } from "./rally-adjudication.js";

export interface FlightAdjudicationInput {
  hitter: SideId;
  end: "ground" | "net" | "out" | "timeout";
  /** Which side of the net the shuttle landed on, if it reached the floor. */
  landingSide?: SideId;
  /** True when the receiving side had no legal return before the shuttle landed. */
  receiverFailedToReturn?: boolean;
}

/**
 * Converts the physics engine's observable flight result into a BWF rally event.
 * It deliberately does not guess at player contact, ceiling contact, or lets
 * that the current scene/physics model cannot observe.
 */
export function adjudicateFlightOutcome(input: FlightAdjudicationInput): RallyEvent | null {
  if (input.end === "net") {
    return { kind: "fault", against: input.hitter, code: "shuttle-fails-net" };
  }
  if (input.end === "out") {
    return { kind: "fault", against: input.hitter, code: "shuttle-out" };
  }
  if (input.end === "timeout") return null;

  if (input.landingSide === input.hitter) {
    return { kind: "fault", against: input.hitter, code: "shuttle-fails-net" };
  }
  if (input.landingSide && input.landingSide !== input.hitter && input.receiverFailedToReturn) {
    return { kind: "rally-won", winner: input.hitter };
  }
  return null;
}
