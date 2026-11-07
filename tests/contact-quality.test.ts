import { describe, expect, it } from "vitest";
import { assessShotContact } from "../src/physics/contact-quality.js";

describe("racket contact quality", () => {
  it("rewards close contact at a useful height", () => {
    const result = assessShotContact({x:0,y:0,z:4},{x:0,y:1.8,z:4});
    expect(result.grade).toBe("PERFECT");
    expect(result.powerMultiplier).toBeGreaterThan(1);
  });
  it("reduces power for rushed contact", () => {
    const result = assessShotContact({x:0,y:0,z:4},{x:1.3,y:0.4,z:4.5});
    expect(result.grade).toBe("RUSHED");
    expect(result.powerMultiplier).toBeLessThan(1);
  });
  it("returns finite values for valid positions", () => {
    const result = assessShotContact({x:-1,y:0,z:5},{x:0.5,y:2.2,z:4.5});
    expect(Number.isFinite(result.quality)).toBe(true);
    expect(Number.isFinite(result.lateralErrorMps)).toBe(true);
  });
  it("rejects invalid coordinates", () => {
    expect(() => assessShotContact({x:NaN,y:0,z:4},{x:0,y:1,z:4})).toThrow(RangeError);
  });
});
