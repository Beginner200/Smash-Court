import { addPoint, getGameWinner, serviceCourtForScore } from "./scoring.js";
import type {
  CreateMatchOptions, DecisionLogEntry, MatchState, SideId, TossChoice,
  TossResolution, UmpireDecision, ServiceCourt, PlayerId, Scores, SideEnds
} from "./types.js";

function otherSide(side: SideId): SideId { return side === "A" ? "B" : "A"; }
function flipEnds(ends: MatchState["sideEnds"]): MatchState["sideEnds"] {
  return { A: ends.A === "near" ? "far" : "near", B: ends.B === "near" ? "far" : "near" };
}
function assertPlayer(sidePlayers: readonly string[], player: string, label: string): void {
  if (!sidePlayers.includes(player)) throw new Error(`${label} must belong to the specified side.`);
}

/** BWF Law 6: toss winner chooses to serve/receive first or choose an end. */
export function resolveToss(
  winnerChoice: TossChoice,
  loserChoice: TossChoice,
  tossWinner: SideId = "A"
): TossResolution {
  const tossLoser = otherSide(tossWinner);
  if ((winnerChoice.kind === "end") === (loserChoice.kind === "end")) {
    throw new Error("One side must choose serve/receive and the other must choose an end.");
  }
  if (winnerChoice.kind === "end" && loserChoice.kind !== "end") {
    const winnerEnd = winnerChoice.end;
    const loserEnd: "near" | "far" = winnerEnd === "near" ? "far" : "near";
    const ends: SideEnds = tossWinner === "A"
      ? { A: winnerEnd, B: loserEnd }
      : { A: loserEnd, B: winnerEnd };
    return {
      firstServerSide: loserChoice.kind === "serve" ? tossLoser : tossWinner,
      ends
    };
  }
  if (winnerChoice.kind === "end") {
    throw new Error("Invalid toss choice combination.");
  }
  if (loserChoice.kind === "end") {
    const loserEnd = loserChoice.end;
    const winnerEnd: "near" | "far" = loserEnd === "near" ? "far" : "near";
    const ends: SideEnds = tossWinner === "A"
      ? { A: winnerEnd, B: loserEnd }
      : { A: loserEnd, B: winnerEnd };
    return {
      firstServerSide: winnerChoice.kind === "serve" ? tossWinner : tossLoser,
      ends
    };
  }
  return {
    firstServerSide: winnerChoice.kind === "serve" ? tossWinner : tossLoser,
    ends: { A: "near", B: "far" }
  };
}

/**
 * Create a game/match state. In doubles the service sequence is:
 * initial server -> partner of initial receiver -> partner of initial server
 * -> initial receiver -> repeat (BWF Law 11.4).
 */
export function createMatch(options: CreateMatchOptions): MatchState {
  const expectedPlayers = options.mode === "singles" ? 1 : 2;
  for (const side of [options.sideA, options.sideB]) {
    if (side.players.length !== expectedPlayers) {
      throw new Error(`${options.mode} requires exactly ${expectedPlayers} player(s) per side.`);
    }
    if (new Set(side.players).size !== side.players.length) throw new Error("Player IDs must be unique within a side.");
  }
  const receiverSide = otherSide(options.firstServerSide);
  const serverPlayers = options.firstServerSide === "A" ? options.sideA.players : options.sideB.players;
  const receiverPlayers = receiverSide === "A" ? options.sideA.players : options.sideB.players;
  assertPlayer(serverPlayers, options.firstServerId, "Initial server");
  assertPlayer(receiverPlayers, options.firstReceiverId, "Initial receiver");

  const serverPartner = serverPlayers.find(p => p !== options.firstServerId);
  const receiverPartner = receiverPlayers.find(p => p !== options.firstReceiverId);
  const sequence = options.mode === "singles"
    ? [options.firstServerId, options.firstReceiverId]
    : [options.firstServerId, receiverPartner!, serverPartner!, options.firstReceiverId];

  return {
    mode: options.mode,
    matchLength: options.matchLength ?? "best-of-three",
    sides: { A: options.sideA, B: options.sideB },
    scores: { A: 0, B: 0 },
    gamesWon: { A: 0, B: 0 },
    gameNumber: 1,
    servingSide: options.firstServerSide,
    serverId: options.firstServerId,
    receiverId: options.firstReceiverId,
    doublesServiceSequence: sequence,
    sideEnds: options.ends,
    phase: "ready-to-serve",
    interval: null,
    intervalTakenThisGame: false,
    thirdGameEndChanged: false,
    lastGameWinner: null,
    matchWinner: null,
    rallyNumber: 0,
    decisionLog: []
  };
}

export function currentServiceCourt(state: MatchState): ServiceCourt {
  return serviceCourtForScore(state.scores[state.servingSide]);
}

function nextServerAfterServicePass(state: MatchState): PlayerId {
  const current = state.doublesServiceSequence.indexOf(state.serverId);
  if (current < 0) throw new Error("Current server is missing from the game's service order.");
  return state.doublesServiceSequence[(current + 1) % state.doublesServiceSequence.length]!;
}

function sideOfPlayer(state: MatchState, playerId: PlayerId): SideId {
  if (state.sides.A.players.includes(playerId)) return "A";
  if (state.sides.B.players.includes(playerId)) return "B";
  throw new Error(`Unknown player: ${playerId}`);
}

function partnerOf(state: MatchState, playerId: PlayerId): PlayerId {
  const side = sideOfPlayer(state, playerId);
  const partner = state.sides[side].players.find(p => p !== playerId);
  if (!partner) return playerId;
  return partner;
}

function appendLog(state: MatchState, decision: UmpireDecision, next: MatchState): MatchState {
  const entry: DecisionLogEntry = {
    rallyNumber: state.rallyNumber + 1,
    decision,
    scoreAfter: { ...next.scores },
    serverAfter: next.serverId,
    serviceCourtAfter: currentServiceCourt(next)
  };
  return { ...next, rallyNumber: state.rallyNumber + 1, decisionLog: [...state.decisionLog, entry] };
}

function startBetweenGameInterval(state: MatchState): MatchState {
  return {
    ...state,
    phase: "interval",
    interval: { kind: "between-games", durationSeconds: 120, remainingSeconds: 120 }
  };
}

/**
 * Award a completed rally. Every rally must resolve as POINT, FAULT or LET.
 * A fault against a side awards the rally to the other side (BWF Laws 7.3, 13).
 * A let replays with the same server and no score change (BWF Law 14).
 */
export function resolveRally(state: MatchState, decision: UmpireDecision): MatchState {
  if (state.phase !== "ready-to-serve") throw new Error("Cannot resolve a rally while play is locked.");
  if (state.matchWinner || state.lastGameWinner) throw new Error("Match/game is already over.");

  if (decision.kind === "LET") {
    const next = { ...state };
    return appendLog(state, decision, next);
  }

  const winner = decision.kind === "POINT" ? decision.winner : otherSide(decision.against);
  const oldServingSide = state.servingSide;
  const scores = addPoint(state.scores, winner);
  let next: MatchState = { ...state, scores };

  if (winner === oldServingSide) {
    // BWF Laws 10.3.1 and 11.3.1: same server serves again; doubles partners
    // on the serving side change service courts after their side wins a point.
    if (state.mode === "doubles") next = { ...next, receiverId: partnerOf(state, state.receiverId) };
  } else {
    // BWF Laws 10.3.2, 11.3.2 and 11.4: service passes to next player in order.
    const newServer = nextServerAfterServicePass(state);
    const newServingSide = sideOfPlayer(state, newServer);
    next = {
      ...next,
      servingSide: newServingSide,
      serverId: newServer,
      receiverId: state.mode === "doubles" ? partnerOf(state, state.serverId) : state.serverId
    };
  }

  const gameWinner = getGameWinner(scores);
  if (gameWinner) {
    const gamesWon = { ...state.gamesWon, [gameWinner]: state.gamesWon[gameWinner] + 1 };
    const matchTarget = state.matchLength === "single-game" ? 1 : 2;
    const matchWinner = gamesWon[gameWinner] >= matchTarget ? gameWinner : null;
    next = {
      ...next,
      gamesWon,
      lastGameWinner: gameWinner,
      matchWinner,
      phase: matchWinner ? "match-over" : "game-over",
      interval: null
    };
  } else {
    // BWF Law 16.2.1: one 60-second interval when the leading score first
    // reaches 11 in each game.
    const leading = Math.max(scores.A, scores.B);
    if (!state.intervalTakenThisGame && leading >= 11) {
      next = {
        ...next,
        phase: "interval",
        interval: { kind: "mid-game", durationSeconds: 60, remainingSeconds: 60 },
        intervalTakenThisGame: true
      };
    }
    // BWF Law 8.1.3: in the third game, change ends when a side first reaches 11.
    if (state.gameNumber === 3 && !state.thirdGameEndChanged && leading >= 11) {
      next = { ...next, sideEnds: flipEnds(next.sideEnds), thirdGameEndChanged: true };
    }
  }
  return appendLog(state, decision, next);
}

/** Resume play after a timed interval. */
export function tickInterval(state: MatchState, seconds: number): MatchState {
  if (state.phase !== "interval" || !state.interval) throw new Error("No interval is active.");
  if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError("Seconds must be non-negative.");
  const remaining = Math.max(0, state.interval.remainingSeconds - seconds);
  if (remaining > 0) return { ...state, interval: { ...state.interval, remainingSeconds: remaining } };
  return { ...state, phase: "ready-to-serve", interval: null };
}

/**
 * Begin the next game. Either player of the game-winning side may serve;
 * either player of the losing side may receive (BWF Law 11.6).
 */
export function startNextGame(
  state: MatchState,
  firstServerId: PlayerId,
  firstReceiverId: PlayerId
): MatchState {
  if (state.phase !== "game-over" || !state.lastGameWinner) throw new Error("There is no completed game to continue.");
  if (state.matchWinner) throw new Error("The match has already ended.");
  const winner = state.lastGameWinner;
  const loser = otherSide(winner);
  assertPlayer(state.sides[winner].players, firstServerId, "Next-game server");
  assertPlayer(state.sides[loser].players, firstReceiverId, "Next-game receiver");

  const serverPartner = state.sides[winner].players.find(p => p !== firstServerId);
  const receiverPartner = state.sides[loser].players.find(p => p !== firstReceiverId);
  const sequence = state.mode === "singles"
    ? [firstServerId, firstReceiverId]
    : [firstServerId, receiverPartner!, serverPartner!, firstReceiverId];

  const nextGameNumber = state.gameNumber + 1;
  const shouldChangeEnds = state.gameNumber === 1 || (state.gameNumber === 2 && nextGameNumber === 3);
  const base: MatchState = {
    ...state,
    scores: { A: 0, B: 0 },
    gameNumber: nextGameNumber,
    servingSide: winner,
    serverId: firstServerId,
    receiverId: firstReceiverId,
    doublesServiceSequence: sequence,
    sideEnds: shouldChangeEnds ? flipEnds(state.sideEnds) : state.sideEnds,
    phase: "ready-to-serve",
    interval: null,
    intervalTakenThisGame: false,
    thirdGameEndChanged: false,
    lastGameWinner: null
  };
  // A 120-second interval occurs between games (Law 16.2.2).
  return {
    ...base,
    phase: "interval",
    interval: { kind: "between-games", durationSeconds: 120, remainingSeconds: 120 }
  };
}

/** Small pure helper for transcript and scoreboard consumers. */
export function scoreLabel(scores: Scores): string {
  return `${scores.A}–${scores.B}`;
}
