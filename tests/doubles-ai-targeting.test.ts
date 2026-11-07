import { describe, expect, it } from "vitest";
import { chooseAiReturnPlan } from "../src/physics/ai.js";

describe("doubles opponent open-space targeting", () => {
  it("chooses a landing target away from both the human and AI partner", () => {
    const human = { x: -0.78, y: 0, z: 5.8 };
    const partner = { x: 0.78, y: 0, z: 4.25 };
    const plan = chooseAiReturnPlan(human, { x: 0, y: 1.55, z: -4.8 }, 0, partner);
    const distanceToHuman = Math.hypot(plan.target.x - human.x, plan.target.z - human.z);
    const distanceToPartner = Math.hypot(plan.target.x - partner.x, plan.target.z - partner.z);
    expect(Math.min(distanceToHuman, distanceToPartner)).toBeGreaterThan(3.2);
    expect(Math.abs(plan.target.x)).toBeLessThanOrEqual(2.45);
    expect(plan.target.z).toBeGreaterThan(0.9);
    expect(plan.target.z).toBeLessThan(5.8);
  });

  it("changes the open-space choice when both receivers change positions", () => {
    const first = chooseAiReturnPlan(
      { x: -2, y: 0, z: 1.2 },
      { x: 0, y: 1.55, z: -4.8 },
      0,
      { x: 2, y: 0, z: 1.2 },
    );
    const second = chooseAiReturnPlan(
      { x: -0.5, y: 0, z: 5.5 },
      { x: 0, y: 1.55, z: -4.8 },
      0,
      { x: 0.5, y: 0, z: 5.5 },
    );
    expect(first.target).not.toEqual(second.target);
  });

  it("keeps singles targeting behavior when no partner is supplied", () => {
    const plan = chooseAiReturnPlan(
      { x: 1.8, y: 0, z: 5.2 },
      { x: 0, y: 1.55, z: -4.8 },
      0,
    );
    expect(plan.target.x).toBe(-1.75);
    expect(plan.target.z).toBe(1.85);
  });
});
