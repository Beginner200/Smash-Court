import { describe, expect, it } from "vitest";
import { evaluateService, isLandingInCourt, isServeLandingInServiceCourt } from "../src/rules/service.js";
import type { ServiceObservation } from "../src/rules/types.js";

const legal: ServiceObservation = {
  shuttleTopHeightM: 1.14,
  serverFeetStationary: true, serverFeetInContact: true,
  serverFeetInsideServiceCourt: true, serverFeetTouchingLine: false,
  receiverFeetStationary: true, receiverFeetInContact: true,
  receiverFeetInsideServiceCourt: true, receiverFeetTouchingLine: false,
  baseStruckFirst: true, releasedWithoutSpin: true,
  continuousForwardMovement: true, missedShuttle: false,
  receiverReady: true
};

describe("BWF Laws 9–11 — service and boundaries", () => {
  it("accepts a legal service", () => expect(evaluateService(legal).kind).toBe("LEGAL"));
  it("faults a shuttle at 1.20m under Law 9.1.6", () => {
    const result=evaluateService({...legal,shuttleTopHeightM:1.20});
    expect(result).toMatchObject({kind:"FAULT",lawRef:"9.1.6"});
  });
  it("faults at exactly 1.15m because the whole shuttle must be below", () => {
    expect(evaluateService({...legal,shuttleTopHeightM:1.15}).kind).toBe("FAULT");
  });
  it("uses feet and service-court rules", () => {
    expect(evaluateService({...legal,serverFeetTouchingLine:true})).toMatchObject({kind:"FAULT",lawRef:"9.1.3"});
    expect(evaluateService({...legal,receiverFeetStationary:false})).toMatchObject({kind:"FAULT",lawRef:"9.1.4"});
  });
  it("replays if receiver was not ready", () => {
    expect(evaluateService({...legal,receiverReady:false})).toMatchObject({kind:"LET",lawRef:"14.2.1"});
  });
  it("calls service court from the server's own score", () => {
    expect(isServeLandingInServiceCourt({x:-1,distanceFromNet:3}, "singles", 0)).toBe(true);
    expect(isServeLandingInServiceCourt({x:-1,distanceFromNet:3}, "singles", 1)).toBe(false);
  });
  it("accepts singles serve beyond the doubles long service line up to the singles back boundary", () => {
    expect(isServeLandingInServiceCourt({x:-1,distanceFromNet:6.3},"singles",0)).toBe(true);
    expect(isServeLandingInServiceCourt({x:-1,distanceFromNet:6.3},"doubles",0)).toBe(false);
  });
  it("treats a shuttle touching the singles sideline as IN", () => {
    expect(isLandingInCourt({x:2.59,distanceFromNet:2},"singles")).toBe(true);
  });
  it("treats a shuttle outside the singles sideline as OUT", () => {
    expect(isLandingInCourt({x:2.591,distanceFromNet:2},"singles")).toBe(false);
  });
});
