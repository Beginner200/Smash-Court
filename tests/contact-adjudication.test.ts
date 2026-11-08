import { describe, expect, it } from "vitest";
import { detectConsecutiveContact } from "../src/rules/contact-adjudication.js";

describe("consecutive racket contact adjudication", () => {
  it("allows the first contact", () => {
    expect(detectConsecutiveContact(null, { side: "A", actor: "human" })).toBeNull();
  });
  it("allows a contact after the opponent has returned the shuttle", () => {
    expect(detectConsecutiveContact({ side: "A", actor: "human" }, { side: "B", actor: "opponent1" })).toBeNull();
  });
  it("calls a double hit when the same player contacts twice in succession", () => {
    expect(detectConsecutiveContact({ side: "A", actor: "human" }, { side: "A", actor: "human" }))
      .toEqual({ kind: "fault", against: "A", code: "double-hit" });
  });
  it("calls a partner double hit when teammates contact in succession", () => {
    expect(detectConsecutiveContact({ side: "A", actor: "human" }, { side: "A", actor: "partner" }))
      .toEqual({ kind: "fault", against: "A", code: "partner-double-hit" });
  });
});
