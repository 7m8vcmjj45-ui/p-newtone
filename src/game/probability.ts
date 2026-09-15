import type { HoldColor, Mode, Random } from "./types";

export const NORMAL_HIT_RATE = 1 / 319.7;
export const RUSH_HIT_RATE = 1 / 73;
export const RUSH_ENTRY_RATE = 0.6;
export const ST_LENGTH = 120;
export const HIGH_SPEED_END = 30;
export const MAIN_END = 100;
export const PAYOUT_BALLS = 1500;

export const HOLD_COLORS: HoldColor[] = ["white", "blue", "green", "red", "gold", "rainbow"];
export const HOLD_WEIGHTS = [0.6, 0.22, 0.12, 0.045, 0.0149, 0.0001] as const;
const COLOR_MULTIPLIERS = [0.2, 0.5, 1, 5, 30] as const;
const NON_RAINBOW_WEIGHTED_MULTIPLIER = HOLD_WEIGHTS.slice(0, 5)
  .reduce((sum, weight, index) => sum + weight * COLOR_MULTIPLIERS[index], 0);

export function isRush(mode: Mode): boolean {
  return mode === "RUSH_HIGH_SPEED" || mode === "RUSH_MAIN" || mode === "RUSH_LAST";
}

export function rushZone(spinNumber: number): Mode {
  if (spinNumber <= HIGH_SPEED_END) return "RUSH_HIGH_SPEED";
  if (spinNumber <= MAIN_END) return "RUSH_MAIN";
  return "RUSH_LAST";
}

export function baseHitRate(mode: Mode): number {
  return isRush(mode) ? RUSH_HIT_RATE : NORMAL_HIT_RATE;
}

// The weighted average of these color-specific odds is exactly the base mode rate.
// The decision still happens when the hold is consumed and its spin begins.
export function hitRateForHold(mode: Mode, color: HoldColor): number {
  if (color === "rainbow") return 1;
  const index = HOLD_COLORS.indexOf(color);
  const remaining = baseHitRate(mode) - HOLD_WEIGHTS[5];
  return remaining * COLOR_MULTIPLIERS[index] / NON_RAINBOW_WEIGHTED_MULTIPLIER;
}

export function rollHit(mode: Mode, color: HoldColor, random: Random): boolean {
  return random() < hitRateForHold(mode, color);
}

export function pickWeighted<T>(items: readonly T[], weights: readonly number[], random: Random): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let value = random() * total;
  for (let i = 0; i < items.length; i += 1) {
    value -= weights[i];
    if (value < 0) return items[i];
  }
  return items[items.length - 1];
}
