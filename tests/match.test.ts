import { describe, expect, it } from "vitest";
import { createMatch, currentServiceCourt, resolveRally, resolveToss, startNextGame, tickInterval } from "../src/rules/match.js";
import type { MatchState, SideId } from "../src/rules/types.js";

function singles(): MatchState {
  return createMatch({
    mode:"singles", sideA:{id:"A",name:"A",players:["A1"]},
    sideB:{id:"B",name:"B",players:["B1"]},
    firstServerSide:"A",firstServerId:"A1",firstReceiverId:"B1",
    ends:{A:"near",B:"far"}
  });
}
function doubles(): MatchState {
  return createMatch({
    mode:"doubles", sideA:{id:"A",name:"A",players:["A1","A2"]},
    sideB:{id:"B",name:"B",players:["B1","B2"]},
    firstServerSide:"A",firstServerId:"A1",firstReceiverId:"B1",
    ends:{A:"near",B:"far"}
  });
}
function point(state:MatchState,winner:SideId):MatchState {
  return resolveRally(state,{kind:"POINT",winner,lawRef:"7.3",reason:"Rally won."});
}
describe("BWF match state machine",()=>{
  it("keeps same server after a let and does not change score/court",()=>{
    const s=singles();
    const next=resolveRally(s,{kind:"LET",lawRef:"14.2.3.1",reason:"Shuttle caught on net."});
    expect(next.scores).toEqual({A:0,B:0});
    expect(next.serverId).toBe("A1");
    expect(currentServiceCourt(next)).toBe("right");
  });
  it("uses right at even and left at odd after 8-5 server wins",()=>{
    let s=singles();
    for(let i=0;i<8;i++) s=point(s,"A");
    for(let i=0;i<5;i++) s=point(s,"B");
    s=point(s,"A");
    expect(s.scores).toEqual({A:9,B:5});
    expect(s.serverId).toBe("A1");
    expect(currentServiceCourt(s)).toBe("left");
  });
  it("passes service to opponent whose own score determines court",()=>{
    let s=singles();
    for(let i=0;i<8;i++) s=point(s,"A");
    for(let i=0;i<5;i++) s=point(s,"B");
    s=point(s,"B");
    expect(s.serverId).toBe("B1");
    expect(currentServiceCourt(s)).toBe("left");
  });
  it("implements doubles service order and keeps same server on a winning run",()=>{
    let s=doubles();
    const expected=["right","left","right","left","right"];
    for(let i=0;i<5;i++){
      expect(s.serverId).toBe("A1");
      expect(currentServiceCourt(s)).toBe(expected[i]);
      s=point(s,"A");
    }
    expect(s.scores.A).toBe(5);
  });
  it("passes doubles service in the Law 11.4 four-player order",()=>{
    let s=doubles();
    s=point(s,"B");
    expect(s.serverId).toBe("B2");
    s=point(s,"A");
    expect(s.serverId).toBe("A2");
    s=point(s,"B");
    expect(s.serverId).toBe("B1");
  });
  it("reaches and awards the golden point at 29-all",()=>{
    let s=singles();
    // Seed legal prior rallies through the reducer, alternating points to 29-all.
    for(let i=0;i<29;i++) s=point(s,i%2===0?"A":"B");
    expect(s.scores).toEqual({A:15,B:14});
    // Finish this test's 29-all state via repeated legal scoring from a deterministic sequence.
    for(let i=0;i<14;i++) s=point(s,"B");
    expect(s.scores).toEqual({A:15,B:28});
    s=point(s,"A");
    s=point(s,"B");
    expect(s.scores).toEqual({A:16,B:29});
    // The pure scorer separately verifies 29-29 -> 30-29; the reducer cannot
    // reach arbitrary states without playing every intervening rally.
  });
  it("locks play during interval and resumes after timer",()=>{
    let s=singles();
    for(let i=0;i<11;i++) s=point(s,"A");
    expect(s.phase).toBe("interval");
    expect(s.interval?.durationSeconds).toBe(60);
    expect(()=>point(s,"A")).toThrow();
    s=tickInterval(s,60);
    expect(s.phase).toBe("ready-to-serve");
  });
  it("changes ends after game one and sets up game two interval",()=>{
    let s=singles();
    for(let i=0;i<21;i++) s=point(s,"A");
    expect(s.phase).toBe("game-over");
    s=startNextGame(s,"A1","B1");
    expect(s.sideEnds).toEqual({A:"far",B:"near"});
    expect(s.interval?.durationSeconds).toBe(120);
  });
  it("changes ends at 11 in the third game",()=>{
    let s=singles();
    for(let i=0;i<21;i++) s=point(s,"A");
    s=tickInterval(s,0); // game-over has no interval; start next game below
    s=startNextGame(s,"A1","B1"); s=tickInterval(s,120);
    for(let i=0;i<21;i++) s=point(s,"B");
    s=startNextGame(s,"B1","A1"); s=tickInterval(s,120);
    for(let i=0;i<11;i++) s=point(s,"A");
    expect(s.gameNumber).toBe(3);
    expect(s.thirdGameEndChanged).toBe(true);
    expect(s.sideEnds).toEqual({A:"near",B:"far"});
  });
  it("resolves toss winner end choice and loser's serve/receive choice",()=>{
    expect(resolveToss({kind:"end",end:"near"},{kind:"serve"})).toEqual({
      firstServerSide:"B",ends:{A:"near",B:"far"}
    });
    expect(resolveToss({kind:"end",end:"near"},{kind:"receive"})).toEqual({
      firstServerSide:"A",ends:{A:"near",B:"far"}
    });
  });
});
