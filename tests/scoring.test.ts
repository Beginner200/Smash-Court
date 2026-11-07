import { describe, expect, it } from "vitest";
import { addPoint, getGameWinner, isGameOver, serviceCourtForScore } from "../src/rules/scoring.js";

describe("BWF Law 7 — scoring", () => {
  it("continues at 20-all until a two-point lead", () => {
    expect(isGameOver(20,20)).toBe(false);
    expect(isGameOver(21,20)).toBe(false);
    expect(isGameOver(22,20)).toBe(true);
    expect(getGameWinner({A:22,B:20})).toBe("A");
  });
  it("ends immediately at 30-29", () => {
    expect(isGameOver(29,29)).toBe(false);
    expect(isGameOver(30,29)).toBe(true);
    expect(getGameWinner({A:29,B:30})).toBe("B");
  });
  it("never allows a legal score to pass 30", () => {
    expect(addPoint({A:29,B:29},"A")).toEqual({A:30,B:29});
    expect(() => addPoint({A:30,B:29},"A")).toThrow();
  });
  it("uses the server's own score parity for service court", () => {
    for (let score=0; score<=30; score++) {
      expect(serviceCourtForScore(score)).toBe(score % 2 === 0 ? "right" : "left");
    }
  });
  it("exhaustively checks reachable score pairs against the 21/deuce/30 rule", () => {
    for (let a=0; a<=30; a++) for (let b=0; b<=30; b++) {
      const expected = Math.max(a,b) === 30 ||
        (Math.max(a,b) >= 21 && Math.abs(a-b) >= 2);
      expect(isGameOver(a,b)).toBe(expected);
    }
  });
});
