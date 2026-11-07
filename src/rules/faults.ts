import type { MatchMode, ServiceCourtCorrection, ServiceCourtError } from "./types.js";
import { isLandingInCourt, isServeLandingInServiceCourt } from "./service.js";

export type InPlayEvent =
  | { kind: "landing"; point: { x: number; distanceFromNet: number } }
  | { kind: "under-net" }
  | { kind: "fails-to-cross" }
  | { kind: "ceiling-or-wall" }
  | { kind: "player-or-dress" }
  | { kind: "outside-object" }
  | { kind: "double-hit"; samePlayer: boolean }
  | { kind: "carried-or-slung" }
  | { kind: "net-touch"; playerOrRacket: boolean }
  | { kind: "opponent-court-invasion"; interferesOrTouchesNet: boolean }
  | { kind: "obstruction"; deliberate: boolean }
  | { kind: "shuttle-disintegrates" }
  | { kind: "unforeseen-circumstance" }
  | { kind: "shuttle-caught-on-net-during-rally" };

export type ClassifiedRallyEvent =
  | { kind: "FAULT"; lawRef: string; reason: string }
  | { kind: "LET"; lawRef: string; reason: string }
  | { kind: "IN_PLAY"; reason: string };

/** BWF Laws 13 and 14. Events are facts detected by the physics/animation layer. */
export function classifyInPlayEvent(event: InPlayEvent, mode: MatchMode): ClassifiedRallyEvent {
  switch (event.kind) {
    case "landing":
      return isLandingInCourt(event.point, mode)
        ? { kind: "IN_PLAY", reason: "Shuttle landed on or within the applicable boundary lines." }
        : { kind: "FAULT", lawRef: "13.3.1", reason: "Shuttle landed outside the court." };
    case "under-net":
    case "fails-to-cross":
      return { kind: "FAULT", lawRef: "13.3.2", reason: "Shuttle failed to pass over the net." };
    case "ceiling-or-wall":
      return { kind: "FAULT", lawRef: "13.3.3", reason: "Shuttle touched the ceiling or side wall." };
    case "player-or-dress":
      return { kind: "FAULT", lawRef: "13.3.4", reason: "Shuttle touched a player or their dress." };
    case "outside-object":
      return { kind: "FAULT", lawRef: "13.3.5", reason: "Shuttle touched an object or person outside the court." };
    case "double-hit":
      return event.samePlayer
        ? { kind: "FAULT", lawRef: "13.3.7", reason: "The same player hit the shuttle twice in succession." }
        : { kind: "IN_PLAY", reason: "A partner contact must be assessed under the one-hit-per-side rule." };
    case "carried-or-slung":
      return { kind: "FAULT", lawRef: "13.3.6", reason: "Shuttle was caught and held on the racket then slung during execution of a stroke." };
    case "net-touch":
      return event.playerOrRacket
        ? { kind: "FAULT", lawRef: "13.4.1", reason: "Player or racket touched the net or its supports while shuttle was in play." }
        : { kind: "IN_PLAY", reason: "No net contact by player or racket." };
    case "opponent-court-invasion":
      return event.interferesOrTouchesNet
        ? { kind: "FAULT", lawRef: "13.4.2", reason: "Player invaded the opponent's court and obstructed or distracted an opponent." }
        : { kind: "IN_PLAY", reason: "Opponent-court reach did not interfere and did not touch the net." };
    case "obstruction":
      return event.deliberate
        ? { kind: "FAULT", lawRef: "13.4.5", reason: "Player deliberately distracted an opponent by shouting or gestures." }
        : { kind: "IN_PLAY", reason: "No deliberate obstruction." };
    case "shuttle-disintegrates":
      return { kind: "LET", lawRef: "14.2.4", reason: "Shuttle disintegrated during play." };
    case "unforeseen-circumstance":
      return { kind: "LET", lawRef: "14.2.5", reason: "Unforeseen or accidental situation occurred." };
    case "shuttle-caught-on-net-during-rally":
      return { kind: "LET", lawRef: "14.2.3.1", reason: "Shuttle became caught on top of the net, except during service." };
  }
}

/** BWF Law 12.2 (2025): correct the discovered error while shuttle is not in play; score stands. */
export function correctServiceCourtError(
  error: ServiceCourtError,
  correctServerId: string,
  correctReceiverId: string
): ServiceCourtCorrection {
  return {
    correctedServerId: correctServerId,
    correctedReceiverId: correctReceiverId,
    lawRef: "12.2",
    scoreStands: true,
    description: `Corrected ${error.kind}: ${error.description}. Existing score stands; no rally replay.`
  };
}

/** Convenience checker for the service flight landing point. */
export function classifyServiceLanding(
  point: { x: number; distanceFromNet: number },
  mode: MatchMode,
  serverScore: number
): ClassifiedRallyEvent {
  return isServeLandingInServiceCourt(point, mode, serverScore)
    ? { kind: "IN_PLAY", reason: "Serve landed in the correct diagonal service court." }
    : { kind: "FAULT", lawRef: "13.1", reason: "Serve failed to land on or within the correct diagonal service court." };
}
