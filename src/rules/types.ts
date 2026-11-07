/**
 * Domain types for the Smash Court 3D rules engine.
 * Ruleset references in this package target the BWF Laws effective on
 * 4 November 2026 (the 2025 Laws, amended 26 April 2025).
 * Official law index: https://worldbadminton.com/laws/rules_2025.htm
 */

export type SideId = "A" | "B";
export type PlayerId = string;
export type MatchMode = "singles" | "doubles";
export type MatchLength = "single-game" | "best-of-three";
export type ServiceCourt = "right" | "left";
export type CourtEnd = "near" | "far";
export type MatchPhase = "ready-to-serve" | "interval" | "game-over" | "match-over";

export interface Side {
  id: SideId;
  name: string;
  players: readonly PlayerId[];
}

export type Scores = Record<SideId, number>;
export type GamesWon = Record<SideId, number>;
export type SideEnds = Record<SideId, CourtEnd>;

export type TossChoice =
  | { kind: "serve" }
  | { kind: "receive" }
  | { kind: "end"; end: CourtEnd };

export interface TossResolution {
  firstServerSide: SideId;
  ends: SideEnds;
}

export type UmpireDecision =
  | {
      kind: "POINT";
      winner: SideId;
      lawRef: "7.3";
      reason: string;
    }
  | {
      kind: "FAULT";
      against: SideId;
      lawRef: string;
      reason: string;
    }
  | {
      kind: "LET";
      lawRef: string;
      reason: string;
    };

export interface DecisionLogEntry {
  rallyNumber: number;
  decision: UmpireDecision;
  scoreAfter: Scores;
  serverAfter: PlayerId;
  serviceCourtAfter: ServiceCourt;
}

export interface IntervalState {
  kind: "mid-game" | "between-games";
  durationSeconds: 60 | 120;
  remainingSeconds: number;
}

export interface MatchState {
  mode: MatchMode;
  matchLength: MatchLength;
  sides: Record<SideId, Side>;
  scores: Scores;
  gamesWon: GamesWon;
  gameNumber: number;
  servingSide: SideId;
  serverId: PlayerId;
  receiverId: PlayerId;
  /** The four-player service sequence defined by BWF Law 11.4. */
  doublesServiceSequence: readonly PlayerId[];
  sideEnds: SideEnds;
  phase: MatchPhase;
  interval: IntervalState | null;
  intervalTakenThisGame: boolean;
  thirdGameEndChanged: boolean;
  lastGameWinner: SideId | null;
  matchWinner: SideId | null;
  rallyNumber: number;
  decisionLog: readonly DecisionLogEntry[];
}

export interface CreateMatchOptions {
  mode: MatchMode;
  matchLength?: MatchLength;
  sideA: Side;
  sideB: Side;
  firstServerSide: SideId;
  firstServerId: PlayerId;
  firstReceiverId: PlayerId;
  ends: SideEnds;
}

export interface ServiceObservation {
  /** Height of the shuttle's highest point above the court at racket contact. */
  shuttleTopHeightM: number;
  serverFeetStationary: boolean;
  serverFeetInContact: boolean;
  serverFeetInsideServiceCourt: boolean;
  serverFeetTouchingLine: boolean;
  receiverFeetStationary: boolean;
  receiverFeetInContact: boolean;
  receiverFeetInsideServiceCourt: boolean;
  receiverFeetTouchingLine: boolean;
  baseStruckFirst: boolean;
  releasedWithoutSpin: boolean;
  continuousForwardMovement: boolean;
  flightUpwards: boolean;
  wouldLandInCorrectServiceCourt: boolean;
  missedShuttle: boolean;
  receiverReady: boolean;
  receiverAlsoFaulted?: boolean;
  undueDelay?: boolean;
}

export type ServiceEvaluation =
  | { kind: "LEGAL"; lawRef: "9.1"; reason: "Correct service" }
  | { kind: "FAULT"; lawRef: string; reason: string }
  | { kind: "LET"; lawRef: "14.2.1" | "14.2.2"; reason: string };

export interface LandingPoint {
  /** Lateral position in metres, measured from the court centre line. */
  x: number;
  /** Distance in metres from the net toward the server's back boundary. */
  distanceFromNet: number;
}

export interface ServiceCourtError {
  kind: "wrong-server" | "wrong-court" | "wrong-receiver";
  actualPlayerId: PlayerId;
  description: string;
}

export interface ServiceCourtCorrection {
  correctedServerId: PlayerId;
  correctedReceiverId: PlayerId;
  lawRef: "12.2";
  scoreStands: true;
  description: string;
}

export const BWF_LAWS_2025_URL = "https://worldbadminton.com/laws/rules_2025.htm";
