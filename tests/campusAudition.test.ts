import assert from "node:assert/strict";
import test from "node:test";
import { AUDITION_CATEGORIES, MAX_AUDITION_RANK, MAX_CATEGORY_SCORE, MIN_CATEGORY_SCORE } from "../src/data/audition.ts";
import { createCampusAudition } from "../src/presentation/campusAudition.ts";

test("４項目は10〜40点で、合計は表示点数と一致する", () => {
  for (const passingSlots of [12, 16, 20]) {
    for (const shouldPass of [true, false]) {
      const result = createCampusAudition(passingSlots, shouldPass, () => 0.52);
      assert.deepEqual(result.scores.map((score) => score.name), AUDITION_CATEGORIES.map((item) => item.name));
      assert.ok(result.scores.every((score) => score.points >= MIN_CATEGORY_SCORE && score.points <= MAX_CATEGORY_SCORE));
      assert.equal(result.total, result.scores.reduce((sum, score) => sum + score.points, 0));
      assert.ok(result.rank >= 1 && result.rank <= MAX_AUDITION_RANK);
      assert.equal(result.passed, result.rank <= passingSlots);
    }
  }
});

test("通過枠の境界では枠内が通過、次の順位は不通過", () => {
  const passed = createCampusAudition(16, true, () => 0.999);
  const failed = createCampusAudition(16, false, () => 0);
  assert.equal(passed.rank, 16);
  assert.equal(passed.passed, true);
  assert.equal(failed.rank, 17);
  assert.equal(failed.passed, false);
});
