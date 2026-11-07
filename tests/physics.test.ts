import { describe, expect, it } from "vitest";
import {
  createShuttleState, DEFAULT_SHUTTLE_CONFIG, shuttleAcceleration,
  simulateTrajectory, stepShuttle,
} from "../src/physics/shuttle.js";

describe("shuttle flight physics", () => {
  it("applies gravity and drag opposite to the direction of travel", () => {
    const a = shuttleAcceleration({x:0,y:0,z:30});
    expect(a.y).toBeLessThan(0);
    expect(a.z).toBeLessThan(0);
  });
  it("slows the shuttle compared with a no-drag trajectory", () => {
    const initial = createShuttleState({x:0,y:2,z:-5},{x:0,y:8,z:25});
    const dragged = stepShuttle(initial,1/120);
    const noDrag = stepShuttle(initial,1/120,{...DEFAULT_SHUTTLE_CONFIG,dragCoefficientAreaM2:0});
    expect(Math.hypot(dragged.velocity.x,dragged.velocity.y,dragged.velocity.z))
      .toBeLessThan(Math.hypot(noDrag.velocity.x,noDrag.velocity.y,noDrag.velocity.z));
  });
  it("produces identical trajectories for identical initial states", () => {
    const initial = createShuttleState({x:0,y:2.3,z:-5.8},{x:0,y:11,z:28});
    const a = simulateTrajectory(initial);
    const b = simulateTrajectory(initial);
    expect(a).toEqual(b);
  });
  it("terminates at the court or net and reports a finite landing", () => {
    const initial = createShuttleState({x:0,y:2.3,z:-5.8},{x:0,y:10,z:25});
    const result = simulateTrajectory(initial);
    expect(["ground","net","out"]).toContain(result.end);
    expect(result.landing).not.toBeNull();
    expect(Number.isFinite(result.durationSeconds)).toBe(true);
  });
  it("rejects non-positive integration steps", () => {
    const initial = createShuttleState({x:0,y:1,z:0},{x:0,y:1,z:1});
    expect(() => stepShuttle(initial,0)).toThrow(RangeError);
  });
});

import { createShotState, SHOT_PROFILES, type ShotType } from "../src/physics/shots.js";

describe("badminton shot presets", () => {
  const shotTypes: ShotType[] = ["clear", "drop", "smash", "lift"];

  it("provides all four basic shot types with finite launch velocities", () => {
    for (const type of shotTypes) {
      const state = createShotState(type, { x: 0, y: 1.25, z: 4.2 });
      expect(Number.isFinite(state.velocity.x)).toBe(true);
      expect(Number.isFinite(state.velocity.y)).toBe(true);
      expect(Number.isFinite(state.velocity.z)).toBe(true);
      expect(state.velocity.z).toBeLessThan(0);
      expect(SHOT_PROFILES[type].label.length).toBeGreaterThan(0);
    }
  });

  it("rejects invalid shot aim values", () => {
    expect(() => createShotState("clear", { x: 0, y: 1, z: 4 }, Number.NaN)).toThrow(RangeError);
  });

  it("gives smash a faster forward launch than a drop", () => {
    expect(Math.abs(SHOT_PROFILES.smash.velocity.z)).toBeGreaterThan(Math.abs(SHOT_PROFILES.drop.velocity.z));
  });
});
