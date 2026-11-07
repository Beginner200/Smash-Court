import { describe, expect, it } from "vitest";
import { advanceDoublesRotation, createDoublesRotation, getDoublesServer } from "../src/rules/doubles-rotation.js";

describe("doubles service rotation", () => {
  it("starts with the right-court player serving at zero-all", () => {
    const state = createDoublesRotation();
    expect(getDoublesServer(state, "player", 0)).toBe("human");
    expect(getDoublesServer(state, "opponent", 0)).toBe("opponent1");
  });

  it("keeps the same server and swaps courts when the serving side wins", () => {
    const state = advanceDoublesRotation(createDoublesRotation(), "player");
    expect(state.servingSide).toBe("player");
    expect(state.playerRight).toBe("partner");
    expect(getDoublesServer(state, "player", 1)).toBe("human");
  });

  it("passes service without swapping the receiving team's positions", () => {
    const state = advanceDoublesRotation(createDoublesRotation(), "opponent");
    expect(state.servingSide).toBe("opponent");
    expect(state.opponentRight).toBe("opponent1");
    expect(getDoublesServer(state, "opponent", 1)).toBe("opponent2");
  });

  it("uses the court positions to select the next server after a later service change", () => {
    let state = advanceDoublesRotation(createDoublesRotation(), "player");
    state = advanceDoublesRotation(state, "opponent");
    expect(state.playerRight).toBe("partner");
    expect(getDoublesServer(state, "player", 1)).toBe("human");
    expect(getDoublesServer(state, "opponent", 1)).toBe("opponent2");
  });

  it("rejects invalid scores", () => {
    expect(() => getDoublesServer(createDoublesRotation(), "player", -1)).toThrow(RangeError);
  });
});
