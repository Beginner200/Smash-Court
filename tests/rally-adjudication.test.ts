import { describe, expect, it } from "vitest";
import { adjudicateRallyEvent, type RallyFaultCode } from "../src/rules/rally-adjudication.js";

describe("BWF Laws 13–14 — rally adjudication", () => {
  it("awards the point to the opponent for each supported fault", () => {
    const cases: Array<[RallyFaultCode, string]> = [
      ["incorrect-service", "13.1.1"],
      ["shuttle-out", "13.1.2"],
      ["shuttle-fails-net", "13.1.3"],
      ["shuttle-touches-ceiling-or-wall", "13.1.4"],
      ["shuttle-touches-player", "13.1.5"],
      ["shuttle-caught-or-slung", "13.1.7"],
      ["double-hit", "13.1.8"],
      ["partner-double-hit", "13.1.9"],
      ["player-touches-net", "13.1.11"],
      ["court-invasion", "13.1.12"],
      ["obstruction", "13.1.13"],
      ["deliberate-distraction", "13.1.14"],
    ];
    for (const [code, lawRef] of cases) {
      expect(adjudicateRallyEvent({ kind: "fault", against: "A", code }))
        .toMatchObject({ kind: "FAULT", against: "A", lawRef });
      expect(adjudicateRallyEvent({ kind: "fault", against: "B", code }))
        .toMatchObject({ kind: "FAULT", against: "B", lawRef });
    }
  });

  it("replays a rally for each supported let", () => {
    for (const lawRef of ["14.2.1", "14.2.2", "14.2.3"] as const) {
      expect(adjudicateRallyEvent({ kind: "let", lawRef, reason: "Replay the rally." }))
        .toEqual({ kind: "LET", lawRef, reason: "Replay the rally." });
    }
  });

  it("records a rally winner as a point under Law 7.3", () => {
    expect(adjudicateRallyEvent({ kind: "rally-won", winner: "B" }))
      .toMatchObject({ kind: "POINT", winner: "B", lawRef: "7.3" });
  });
});
