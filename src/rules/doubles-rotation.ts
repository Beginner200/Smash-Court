export type DoublesSide = "player" | "opponent";
export type DoublesPlayer = "human" | "partner" | "opponent1" | "opponent2";

export interface DoublesRotationState {
  servingSide: DoublesSide;
  playerRight: "human" | "partner";
  opponentRight: "opponent1" | "opponent2";
}

export function createDoublesRotation(): DoublesRotationState {
  return { servingSide: "player", playerRight: "human", opponentRight: "opponent1" };
}

/** The player standing in the score-selected service court is the doubles server. */
export function getDoublesServer(
  state: DoublesRotationState,
  side: DoublesSide,
  score: number,
): DoublesPlayer {
  if (!Number.isInteger(score) || score < 0) throw new RangeError("Score must be a non-negative integer.");
  const rightCourt = score % 2 === 0;
  if (side === "player") return rightCourt ? state.playerRight : state.playerRight === "human" ? "partner" : "human";
  return rightCourt ? state.opponentRight : state.opponentRight === "opponent1" ? "opponent2" : "opponent1";
}

/**
 * BWF doubles rotation: a serving side that wins swaps its players' service courts
 * while retaining the server. When the receiving side wins, positions stay put and
 * the player now in the score-selected service court becomes the next server.
 */
export function advanceDoublesRotation(
  state: DoublesRotationState,
  rallyWinner: DoublesSide,
): DoublesRotationState {
  if (rallyWinner === state.servingSide) {
    if (state.servingSide === "player") {
      return { ...state, playerRight: state.playerRight === "human" ? "partner" : "human" };
    }
    return { ...state, opponentRight: state.opponentRight === "opponent1" ? "opponent2" : "opponent1" };
  }
  return { ...state, servingSide: rallyWinner };
}
