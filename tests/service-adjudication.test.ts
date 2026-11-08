import { describe, expect, it } from "vitest";
import { adjudicateServiceEvaluation } from "../src/rules/service-adjudication.js";

describe("service decision integration", () => {
  it("does not create a fault for a legal serve", () => {
    expect(adjudicateServiceEvaluation({ kind: "LEGAL", lawRef: "9.1", reason: "Correct service" }, "A")).toBeNull();
  });
  it("assigns a server fault to the serving side", () => {
    expect(adjudicateServiceEvaluation({ kind: "FAULT", against: "server", lawRef: "9.1.6", reason: "Too high" }, "B"))
      .toEqual({ kind: "FAULT", against: "B", lawRef: "9.1.6", reason: "Too high" });
  });
  it("assigns a receiver fault to the receiving side", () => {
    expect(adjudicateServiceEvaluation({ kind: "FAULT", against: "receiver", lawRef: "9.1.3", reason: "Receiver foot fault" }, "A"))
      .toEqual({ kind: "FAULT", against: "B", lawRef: "9.1.3", reason: "Receiver foot fault" });
  });
  it("preserves a let without awarding a point", () => {
    expect(adjudicateServiceEvaluation({ kind: "LET", lawRef: "14.2.1", reason: "Receiver not ready" }, "A"))
      .toEqual({ kind: "LET", lawRef: "14.2.1", reason: "Receiver not ready" });
  });
});
