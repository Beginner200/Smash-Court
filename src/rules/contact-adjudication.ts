import type { SideId } from "./types.js";

export type CourtActor = "human" | "partner" | "opponent1" | "opponent2";
export interface RacketContact { side: SideId; actor: CourtActor }
export type ContactFaultCode = "double-hit" | "partner-double-hit";
export interface ContactFault { kind: "fault"; against: SideId; code: ContactFaultCode }

/** Detects consecutive contacts by one side; no fault after the opponent has touched the shuttle. */
export function detectConsecutiveContact(previous: RacketContact | null, current: RacketContact): ContactFault | null {
  if (!previous || previous.side !== current.side) return null;
  return {
    kind: "fault",
    against: current.side,
    code: previous.actor === current.actor ? "double-hit" : "partner-double-hit",
  };
}
