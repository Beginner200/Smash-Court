export type MatchSide = "player" | "opponent";

export interface MatchScoreState {
  points: { player: number; opponent: number };
  games: { player: number; opponent: number };
  gameNumber: number;
  winner: MatchSide | null;
  lastPoint: MatchSide | null;
}

export function createMatchScore(): MatchScoreState {
  return {
    points: { player: 0, opponent: 0 },
    games: { player: 0, opponent: 0 },
    gameNumber: 1,
    winner: null,
    lastPoint: null,
  };
}

export function getGameWinner(points: MatchScoreState["points"]): MatchSide | null {
  for (const side of ["player", "opponent"] as const) {
    const other = side === "player" ? "opponent" : "player";
    if (points[side] >= 30 || (points[side] >= 21 && points[side] - points[other] >= 2)) {
      return side;
    }
  }
  return null;
}

/** Awards one rally point; games use BWF 21-point, win-by-two, 30-point cap. */
export function awardRallyPoint(
  state: MatchScoreState,
  pointWinner: MatchSide,
): MatchScoreState {
  if (state.winner) throw new Error("The match has already ended.");
  const points = { ...state.points, [pointWinner]: state.points[pointWinner] + 1 };
  const gameWinner = getGameWinner(points);
  if (!gameWinner) return { ...state, points, lastPoint: pointWinner };

  const games = { ...state.games, [gameWinner]: state.games[gameWinner] + 1 };
  const matchWinner = games[gameWinner] === 2 ? gameWinner : null;
  return {
    points: matchWinner ? points : { player: 0, opponent: 0 },
    games,
    gameNumber: state.gameNumber + (matchWinner ? 0 : 1),
    winner: matchWinner,
    lastPoint: pointWinner,
  };
}
