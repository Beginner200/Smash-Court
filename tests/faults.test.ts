import { describe, expect, it } from "vitest";
import { classifyInPlayEvent, correctServiceCourtError } from "../src/rules/faults.js";

describe("BWF Laws 12–14 — faults, lets and service-court correction",()=>{
  it("calls shuttle out as Law 13.3.1",()=>{
    expect(classifyInPlayEvent({kind:"landing",point:{x:3,distanceFromNet:2}},"singles"))
      .toMatchObject({kind:"FAULT",lawRef:"13.3.1"});
  });
  it("calls a shuttle caught on net during a rally a let",()=>{
    expect(classifyInPlayEvent({kind:"shuttle-caught-on-net-during-rally"},"singles"))
      .toMatchObject({kind:"LET",lawRef:"14.2.3.1"});
  });
  it("calls disintegration a let",()=>{
    expect(classifyInPlayEvent({kind:"shuttle-disintegrates"},"doubles"))
      .toMatchObject({kind:"LET",lawRef:"14.2.4"});
  });
  it("corrects service-court error without changing score or replaying",()=>{
    expect(correctServiceCourtError({
      kind:"wrong-court",actualPlayerId:"A1",description:"Server was in left court."
    },"A1","B1")).toMatchObject({lawRef:"12.2",scoreStands:true});
  });
});
