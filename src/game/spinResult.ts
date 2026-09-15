import { RUSH_ENTRY_RATE, isRush, rollHit } from "./probability.ts";
import type { Hold, Mode, Random, Spin, SpinOverrides } from "./types";

function winningDigits(random: Random): [number, number, number] {
  const symbol = random() < 0.38 ? 7 : 1 + Math.floor(random() * 6);
  return [symbol, symbol, symbol];
}

function losingDigits(random: Random): [number, number, number] {
  const left = 1 + Math.floor(random() * 7);
  const right = 1 + Math.floor(random() * 7);
  const center = 1 + Math.floor(random() * 7);
  if (left === center && center === right) return [left, center, center === 7 ? 1 : center + 1];
  return [left, center, right];
}

export function createSpin(
  id: number,
  hold: Hold,
  mode: Mode,
  rushSpin: number | null,
  stageId: string,
  stageSpin: number | null,
  overrides: SpinOverrides,
  random: Random
): Spin {
  let win = overrides.result === "win" ? true
    : overrides.result === "loss" ? false
    : rollHit(mode, hold.color, random);
  if (overrides.mirrorBreak) win = true;
  if (overrides.act && overrides.result !== "win" && !overrides.mirrorBreak) win = false;
  return {
    id,
    hold,
    modeAtStart: mode,
    rushSpin,
    stageId,
    stageSpin,
    win,
    rushEntry: win && (isRush(mode) || random() < RUSH_ENTRY_RATE),
    digits: win ? winningDigits(random) : losingDigits(random),
    overrides
  };
}
