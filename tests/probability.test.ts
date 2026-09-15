import assert from "node:assert/strict";
import test from "node:test";
import {
  HOLD_COLORS, HOLD_WEIGHTS, NORMAL_HIT_RATE, RUSH_HIT_RATE,
  hitRateForHold, rushZone
} from "../src/game/probability.ts";

test("保留色の重み付き平均は通常時とST中の基本確率に一致する", () => {
  for (const [mode, expected] of [
    ["NORMAL", NORMAL_HIT_RATE],
    ["RUSH_MAIN", RUSH_HIT_RATE]
  ] as const) {
    const average = HOLD_COLORS.reduce(
      (sum, color, index) => sum + HOLD_WEIGHTS[index] * hitRateForHold(mode, color), 0
    );
    assert.ok(Math.abs(average - expected) < 1e-12);
  }
  assert.equal(hitRateForHold("NORMAL", "rainbow"), 1);
  assert.ok(hitRateForHold("NORMAL", "white") < hitRateForHold("NORMAL", "blue"));
  assert.ok(hitRateForHold("NORMAL", "blue") < hitRateForHold("NORMAL", "green"));
  assert.ok(hitRateForHold("NORMAL", "green") < hitRateForHold("NORMAL", "red"));
  assert.ok(hitRateForHold("NORMAL", "red") < hitRateForHold("NORMAL", "gold"));
});

test("ST区間の境界と120回以内の継続率", () => {
  assert.equal(rushZone(1), "RUSH_HIGH_SPEED");
  assert.equal(rushZone(30), "RUSH_HIGH_SPEED");
  assert.equal(rushZone(31), "RUSH_MAIN");
  assert.equal(rushZone(100), "RUSH_MAIN");
  assert.equal(rushZone(101), "RUSH_LAST");
  assert.equal(rushZone(120), "RUSH_LAST");
  const continuation = 1 - (1 - RUSH_HIT_RATE) ** 120;
  assert.ok(continuation > 0.8 && continuation < 0.82);
});
