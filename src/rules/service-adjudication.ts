import type { ServiceEvaluation, SideId, UmpireDecision } from "./types.js";

/** Convert the service judge result into the same decision format used by rally calls. */
export function adjudicateServiceEvaluation(
  evaluation: ServiceEvaluation,
  serverSide: SideId,
): UmpireDecision | null {
  if (evaluation.kind === "LEGAL") return null;
  if (evaluation.kind === "LET") {
    return { kind: "LET", lawRef: evaluation.lawRef, reason: evaluation.reason };
  }
  const against = evaluation.against === "server"
    ? serverSide
    : serverSide === "A" ? "B" : "A";
  return { kind: "FAULT", against, lawRef: evaluation.lawRef, reason: evaluation.reason };
}
