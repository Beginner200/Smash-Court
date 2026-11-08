import { describe, expect, it } from "vitest";
import { adjudicateRallyEvent, type RallyFaultCode } from "../src/rules/rally-adjudication.js";

describe("BWF Laws 13–14 — rally adjudication", () => {
  it("awards the point to the opponent for each supported fault", () => {
    const cases: Array<[RallyFaultCode, string]> = [
      ["incorrect-service", "13.1"],
      ["shuttle-out", "13.3.1"],
      ["shuttle-fails-net", "13.3.2"],
      ["shuttle-touches-ceiling-or-wall", "13.3.3"],
      ["shuttle-touches-player", "13.3.4"],
      ["shuttle-caught-or-slung", "13.3.6"],
      ["double-hit", "13.3.7"],
      ["partner-double-hit", "13.3.8"],
      ["player-touches-net", "13.4.1"],
      ["court-invasion", "13.4.2"],
      ["obstruction", "13.4.4"],
      ["deliberate-distraction", "13.4.5"],\n      ["shuttle-touches-object-outside-court", "13.3.5"],\n      ["racket-contact-not-toward-opponent", "13.3.9"],\n      ["under-net-obstruction", "13.4.3"],\n      ["misconduct", "13.5"],
    ];
    for (const [code, lawRef] of cases) {
      expect(adjudicateRallyEvent({ kind: "fault", against: "A", code }))
        .toMatchObject({ kind: "FAULT", against: "A", lawRef });
      expect(adjudicateRallyEvent({ kind: "fault", against: "B", code }))
        .toMatchObject({ kind: "FAULT", against: "B", lawRef });
    }
  });

  it("replays a rally for each supported let", () => {
    for (const lawRef of ["14.2.1", "14.2.2", "14.2.3", "14.2.4", "14.2.5", "14.2.6", "14.2.7"] as const) {
      expect(adjudicateRallyEvent({ kind: "let", lawRef, reason: "Replay the rally." }))
        .toEqual({ kind: "LET", lawRef, reason: "Replay the rally." });
    }
  });

  it("records a rally winner as a point under Law 7.3", () => {
    expect(adjudicateRallyEvent({ kind: "rally-won", winner: "B" }))
      .toMatchObject({ kind: "POINT", winner: "B", lawRef: "7.3" });
  });
});
