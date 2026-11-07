export type MatchBreakKind = "mid-game" | "between-games";

export interface MatchBreakState {
  kind: MatchBreakKind;
  remainingSeconds: number;
}

export function createMatchBreak(kind: MatchBreakKind): MatchBreakState {
  return {
    kind,
    remainingSeconds: kind === "mid-game" ? 60 : 120,
  };
}

/** Advances a match interval countdown and returns null when it is complete. */
export function advanceMatchBreak(
  state: MatchBreakState,
  elapsedSeconds: number,
): MatchBreakState | null {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new RangeError("Elapsed time must be a finite, non-negative number.");
  }
  if (!Number.isFinite(state.remainingSeconds) || state.remainingSeconds < 0) {
    throw new RangeError("Remaining break time must be a finite, non-negative number.");
  }
  const remainingSeconds = Math.max(0, state.remainingSeconds - elapsedSeconds);
  return remainingSeconds === 0 ? null : { ...state, remainingSeconds };
}
