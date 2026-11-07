import { describe, expect, it } from "vitest";
import { advanceMatchBreak, createMatchBreak } from "../src/rules/match-breaks.js";

describe("official match intervals", () => {
  it("creates a 60-second mid-game interval", () => {
    expect(createMatchBreak("mid-game")).toEqual({ kind: "mid-game", remainingSeconds: 60 });
  });

  it("creates a 120-second between-games interval", () => {
    expect(createMatchBreak("between-games")).toEqual({ kind: "between-games", remainingSeconds: 120 });
  });

  it("counts down without mutating the original state", () => {
    const initial = createMatchBreak("mid-game");
    expect(advanceMatchBreak(initial, 12)).toEqual({ kind: "mid-game", remainingSeconds: 48 });
    expect(initial.remainingSeconds).toBe(60);
  });

  it("returns null when the interval finishes", () => {
    expect(advanceMatchBreak(createMatchBreak("between-games"), 120)).toBeNull();
    expect(advanceMatchBreak(createMatchBreak("mid-game"), 75)).toBeNull();
  });

  it("rejects invalid elapsed time", () => {
    const state = createMatchBreak("mid-game");
    expect(() => advanceMatchBreak(state, -1)).toThrow(RangeError);
    expect(() => advanceMatchBreak(state, Number.NaN)).toThrow(RangeError);
  });
});
