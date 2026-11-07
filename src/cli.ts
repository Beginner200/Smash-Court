import { createMatch, resolveRally, scoreLabel, startNextGame, tickInterval } from "./index.js";
import type { MatchState, SideId } from "./index.js";

function playPoint(state: MatchState, winner: SideId): MatchState {
  if (state.phase === "interval" && state.interval) state = tickInterval(state,state.interval.remainingSeconds);
  return resolveRally(state, { kind: "POINT", winner, lawRef: "7.3", reason: `Side ${winner} won the rally.` });
}

let match = createMatch({
  mode: "singles",
  matchLength: "best-of-three",
  sideA: { id: "A", name: "Player A", players: ["A1"] },
  sideB: { id: "B", name: "Player B", players: ["B1"] },
  firstServerSide: "A",
  firstServerId: "A1",
  firstReceiverId: "B1",
  ends: { A: "near", B: "far" }
});

console.log("SMASH COURT 3D — RULES ENGINE TRANSCRIPT");
console.log("Demo: deterministic sample points; not a simulated skill match.");
for (let i = 0; i < 21; i++) match = playPoint(match, "A");
console.log(`Game 1: ${scoreLabel(match.scores)} — winner ${match.lastGameWinner}`);
match = startNextGame(match, "A1", "B1");
match = tickInterval(match, 120);
for (let i = 0; i < 21; i++) match = playPoint(match, "B");
console.log(`Game 2: ${scoreLabel(match.scores)} — winner ${match.lastGameWinner}`);
match = startNextGame(match,"B1","A1");
match = tickInterval(match,120);
for (let i = 0; i < 21; i++) match = playPoint(match,"B");
console.log(`Game 3: ${scoreLabel(match.scores)} — winner ${match.lastGameWinner}`);
console.log(`Match winner: ${match.matchWinner ?? "undecided"}`);
console.log(`Rallies logged: ${match.decisionLog.length}`);
