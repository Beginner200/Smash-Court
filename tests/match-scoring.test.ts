import { describe, expect, it } from "vitest";
import { awardRallyPoint, createMatchScore, getGameWinner } from "../src/rules/match-scoring.js";

describe("rally and match scoring", () => {
  it("awards one point for each rally", () => {
    const next = awardRallyPoint(createMatchScore(), "player");
    expect(next.points).toEqual({ player: 1, opponent: 0 });
  });
  it("requires a two-point lead at 21", () => {
    expect(getGameWinner({ player: 21, opponent: 20 })).toBeNull();
    expect(getGameWinner({ player: 22, opponent: 20 })).toBe("player");
  });
  it("ends at 30 even without a two-point lead", () => {
    expect(getGameWinner({ player: 30, opponent: 29 })).toBe("player");
  });
  it("resets points and awards a game after a game ends", () => {
    let state = createMatchScore();
    state = { ...state, points: { player: 20, opponent: 20 } };
    state = awardRallyPoint(state, "player");
    expect(state.points).toEqual({ player: 21, opponent: 20 });
    state = awardRallyPoint(state, "player");
    expect(state.games.player).toBe(1);
    expect(state.points).toEqual({ player: 0, opponent: 0 });
    expect(state.gameNumber).toBe(2);
  });
  it("ends a best-of-three match when a side wins two games", () => {
    let state = createMatchScore();
    state = { ...state, games: { player: 1, opponent: 0 }, points: { player: 20, opponent: 20 } };
    state = awardRallyPoint(state, "opponent");
    state = awardRallyPoint(state, "opponent");
    expect(state.winner).toBe("opponent");
    expect(state.games.opponent).toBe(1);
  });
  it("rejects points after the match ends", () => {
    const state = { ...createMatchScore(), winner: "player" as const };
    expect(() => awardRallyPoint(state, "opponent")).toThrow();
  });
});