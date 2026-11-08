import { describe, expect, it } from "vitest";
import { adjudicateFlightOutcome } from "../src/rules/flight-adjudication.js";

describe("automatic flight adjudication", () => {
  it("calls a fault when the shuttle hits the net", () => {
    expect(adjudicateFlightOutcome({ hitter: "A", end: "net" }))
      .toEqual({ kind: "fault", against: "A", code: "shuttle-fails-net" });
  });

  it("calls a fault when the shuttle lands out", () => {
    expect(adjudicateFlightOutcome({ hitter: "B", end: "out" }))
      .toEqual({ kind: "fault", against: "B", code: "shuttle-out" });
  });

  it("calls a fault when a shot lands on the hitter's own side", () => {
    expect(adjudicateFlightOutcome({ hitter: "A", end: "ground", landingSide: "A" }))
      .toEqual({ kind: "fault", against: "A", code: "shuttle-fails-net" });
  });

  it("awards the rally to the hitter when the receiver fails to return an in-court shot", () => {
    expect(adjudicateFlightOutcome({
      hitter: "B", end: "ground", landingSide: "A", receiverFailedToReturn: true,
    })).toEqual({ kind: "rally-won", winner: "B" });
  });

  it("does not invent a point when the simulation times out", () => {
    expect(adjudicateFlightOutcome({ hitter: "A", end: "timeout" })).toBeNull();
  });

  it("does not call a point before the receiving side's outcome is known", () => {
    expect(adjudicateFlightOutcome({ hitter: "A", end: "ground", landingSide: "B" })).toBeNull();
  });
});
