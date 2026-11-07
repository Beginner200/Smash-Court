import type { Scores, SideId } from "./types.js";

/**
 * BWF Law 7.2, 7.4 and 7.5:
 * first to 21, win by two from 20-all, and the 30th point wins at 29-all.
 */
export function isGameOver(scoreA: number, scoreB: number): boolean {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    throw new RangeError("Scores must be non-negative integers.");
  }
  const high = Math.max(scoreA, scoreB);
  const low = Math.min(scoreA, scoreB);
  return high === 30 || (high >= 21 && high - low >= 2);
}

/** Returns the winner only when the BWF game-ending condition is met. */
export function getGameWinner(scores: Scores): SideId | null {
  if (!isGameOver(scores.A, scores.B)) return null;
  return scores.A > scores.B ? "A" : "B";
}

/** BWF Law 7.3: the rally winner adds exactly one point. */
export function addPoint(scores: Scores, winner: SideId): Scores {
  if (isGameOver(scores.A, scores.B)) {
    throw new Error("Cannot score after the game has ended.");
  }
  const next = { ...scores, [winner]: scores[winner] + 1 };
  if (next.A > 30 || next.B > 30) {
    throw new Error("BWF scoring cap exceeded.");
  }
  return next;
}

/** BWF Laws 10.1.1–10.1.2 and 11.1.1–11.1.2: server's own score sets court. */
export function serviceCourtForScore(serverScore: number): "right" | "left" {
  if (!Number.isInteger(serverScore) || serverScore < 0) {
    throw new RangeError("Server score must be a non-negative integer.");
  }
  return serverScore % 2 === 0 ? "right" : "left";
}
