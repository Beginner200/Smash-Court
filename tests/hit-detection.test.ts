import { describe, expect, it } from "vitest";
import { canPlayerHitShuttle, PLAYER_HIT_REACH_M } from "../src/physics/hit-detection.js";

describe("player shuttle hit detection", () => {
  it("allows a hit when the shuttle is within racket reach", () => {
    expect(canPlayerHitShuttle({ x: 0, y: 0, z: 4 }, { x: 0.2, y: 1.1, z: 4.2 })).toBe(true);
  });
  it("rejects a shuttle that is too far away", () => {
    expect(canPlayerHitShuttle({ x: 0, y: 0, z: 4 }, { x: 0, y: 1.1, z: 6 })).toBe(false);
  });
  it("rejects a shuttle outside playable racket height", () => {
    expect(canPlayerHitShuttle({ x: 0, y: 0, z: 4 }, { x: 0, y: 4, z: 4 })).toBe(false);
  });
  it("rejects invalid positions and invalid reach", () => {
    expect(canPlayerHitShuttle({ x: Number.NaN, y: 0, z: 4 }, { x: 0, y: 1, z: 4 })).toBe(false);
    expect(canPlayerHitShuttle({ x: 0, y: 0, z: 4 }, { x: 0, y: 1, z: 4 }, -1)).toBe(false);
  });
  it("uses a finite, game-scale reach", () => {
    expect(PLAYER_HIT_REACH_M).toBeGreaterThan(0.5);
    expect(PLAYER_HIT_REACH_M).toBeLessThan(2);
  });
});
