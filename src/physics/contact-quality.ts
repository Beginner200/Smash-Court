import type { Vec3 } from "./shuttle.js";
import { PLAYER_HIT_REACH_M, PLAYER_RACKET_HEIGHT_M } from "./hit-detection.js";

export type ContactGrade = "PERFECT" | "GOOD" | "RUSHED";
export interface ShotContactQuality {
  quality: number;
  grade: ContactGrade;
  powerMultiplier: number;
  lateralErrorMps: number;
}

/** Rates contact using racket distance and shuttle height at the instant of the hit. */
export function assessShotContact(player: Vec3, shuttle: Vec3): ShotContactQuality {
  const values = [player.x, player.y, player.z, shuttle.x, shuttle.y, shuttle.z];
  if (!values.every(Number.isFinite)) throw new RangeError("Contact positions must be finite.");
  const racket = { x: player.x, y: player.y + PLAYER_RACKET_HEIGHT_M, z: player.z };
  const distance = Math.hypot(shuttle.x-racket.x, shuttle.y-racket.y, shuttle.z-racket.z);
  const distanceScore = Math.max(0, 1 - distance / PLAYER_HIT_REACH_M);
  const idealHeight = 1.8;
  const heightScore = Math.max(0, 1 - Math.abs(shuttle.y-idealHeight) / 1.8);
  const quality = Math.max(0, Math.min(1, distanceScore * 0.65 + heightScore * 0.35));
  const grade: ContactGrade = quality >= 0.78 ? "PERFECT" : quality >= 0.48 ? "GOOD" : "RUSHED";
  const powerMultiplier = 0.68 + quality * 0.52;
  const lateralErrorMps = (shuttle.x-player.x) * (1-quality) * 1.8;
  return { quality, grade, powerMultiplier, lateralErrorMps };
}
