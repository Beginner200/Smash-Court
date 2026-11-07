import { describe, expect, it } from "vitest";
import { createServeState, evaluateServeFlight } from "../src/physics/serve.js";

describe("serve and receive prototype", () => {
  it("starts even-score serves from the right service court for both ends", () => {
    const player = createServeState("player", 0);
    const ai = createServeState("opponent", 0);
    expect(player.position.x).toBeGreaterThan(0);
    expect(ai.position.x).toBeLessThan(0);
    expect(player.velocity.z).toBeLessThan(0);
    expect(ai.velocity.z).toBeGreaterThan(0);
  });

  it("switches to the left service court after the server's score becomes odd", () => {
    expect(createServeState("player", 1).position.x).toBeLessThan(0);
    expect(createServeState("opponent", 1).position.x).toBeGreaterThan(0);
  });

  it("produces a legal diagonal serve for the player and AI in singles", () => {
    for (const side of ["player", "opponent"] as const) {
      const initial = createServeState(side, 0);
      const check = evaluateServeFlight(initial, side, 0, "singles");
      expect(check.trajectory.end).toBe("ground");
      expect(check.landingInCorrectServiceCourt).toBe(true);
      expect(check.evaluation.kind).toBe("LEGAL");
    }
  });

  it("keeps the same serve profile inside the doubles service box", () => {
    const initial = createServeState("player", 0);
    const check = evaluateServeFlight(initial, "player", 0, "doubles");
    expect(check.evaluation.kind).toBe("LEGAL");
  });

  it("rejects a serve delivered at or above the 1.15m shuttle-height limit", () => {
    const initial = createServeState("player", 0);
    initial.position.y = 1.15;
    const check = evaluateServeFlight(initial, "player", 0, "singles");
    expect(check.evaluation).toMatchObject({ kind: "FAULT", lawRef: "9.1.6" });
  });
});
