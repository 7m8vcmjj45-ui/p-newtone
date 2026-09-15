import assert from "node:assert/strict";
import test from "node:test";
import { createSpinPlan } from "../src/presentation/plan.ts";
import { CAMPUS_EVENT_GROUP, CAMPUS_EVENTS } from "../src/data/events.ts";
import { REACHES } from "../src/data/reaches.ts";
import type { Spin } from "../src/game/types.ts";

function spin(overrides: Partial<Spin> = {}): Spin {
  return {
    id: 1,
    hold: { id: 1, color: "white", omen: "normal", createdAt: 0 },
    modeAtStart: "NORMAL",
    rushSpin: null,
    stageId: "omiya",
    stageSpin: 1,
    win: false,
    rushEntry: false,
    digits: [6, 3, 2],
    overrides: {},
    ...overrides
  };
}

test("リーチは左右同図柄、中央ハズレで決着する", () => {
  const plan = createSpinPlan(spin({ overrides: { reachId: "national-final" } }), () => 0.99);
  assert.equal(plan.reach?.id, "national-final");
  assert.equal(plan.finalDigits[0], plan.finalDigits[2]);
  assert.notEqual(plan.finalDigits[1], plan.finalDigits[0]);
});

test("リーチなしの変動は偶然の左右テンパイを表示しない", () => {
  const plan = createSpinPlan(spin({ digits: [4, 2, 4] }), () => 0.99);
  assert.equal(plan.reach, null);
  assert.notEqual(plan.finalDigits[0], plan.finalDigits[2]);
});

test("ACTを強制した場合は関東最終以上へ発展する", () => {
  const plan = createSpinPlan(spin({ overrides: { reachId: "kanto-1", act: true } }), () => 0.99);
  assert.equal(plan.reach?.id, "kanto-final");
  assert.equal(plan.act, true);
});

test("ステージは7行事それぞれの名前で、結果発表は4行事だけ", () => {
  assert.equal(CAMPUS_EVENT_GROUP.name, "学内イベント");
  assert.deepEqual(CAMPUS_EVENTS.map((event) => event.name), [
    "大宮祭", "定期演奏会", "夏ライ", "芝浦祭", "冬ライ", "クリライ", "春ライ"
  ]);
  for (const event of CAMPUS_EVENTS) {
    const plan = createSpinPlan(spin({
      win: true,
      digits: [7, 7, 7],
      stageId: event.id,
      overrides: { route: "campus", resultAnnouncement: true, reachId: "national-final", act: true }
    }), () => 0.99);
    assert.equal(plan.route, "campus");
    assert.equal(plan.stage.id, event.id);
    assert.equal(plan.event?.id, event.id);
    assert.equal(plan.reach, null);
    assert.equal(plan.act, false);
    assert.equal(plan.resultAnnouncement, event.stageExit.kind === "result");
    assert.equal(plan.prediction !== null, event.stageExit.kind === "result");
    assert.equal(plan.stageAdvanceReason, event.stageExit.kind === "result" ? "result" : null);
  }
});

test("アカスピ変動は学内イベント名と内ステ予告を表示しない", () => {
  const plan = createSpinPlan(spin({
    stageId: "shibaura",
    overrides: { route: "akasupi", reachId: "kanto-2" }
  }), () => 0.99);
  assert.equal(plan.route, "akasupi");
  assert.equal(plan.event, null);
  assert.equal(plan.prediction, null);
  assert.equal(plan.stage.id, "shibaura");
  assert.equal(plan.reach?.id, "kanto-2");
});

test("１次で終わるアカスピも進行表示には全国決勝まで並ぶ", () => {
  const plan = createSpinPlan(spin({ overrides: { route: "akasupi", reachId: "kanto-1" } }), () => 0.99);
  assert.deepEqual(plan.akasupiStages.map((stage) => stage.id), ["kanto-1"]);
  assert.deepEqual(plan.akasupiDisplayStages.map((stage) => stage.id),
    ["kanto-1", "kanto-2", "kanto-final", "national-final"]);
});

test("学内イベントのオーディションは予告の通過曲数と内部当落に合わせる", () => {
  const passed = createSpinPlan(spin({
    win: true, digits: [4, 4, 4], stageId: "shibaura",
    overrides: { route: "campus", resultAnnouncement: true }
  }), () => 0.99);
  assert.equal(passed.prediction?.songs, 20);
  assert.equal(passed.audition?.passingSlots, 20);
  assert.equal(passed.audition?.passed, true);
  const failed = createSpinPlan(spin({
    stageId: "omiya", overrides: { route: "campus", resultAnnouncement: true }
  }), () => 0.99);
  assert.equal(failed.audition?.passingSlots, 20);
  assert.equal(failed.audition?.passed, false);
  const revival = createSpinPlan(spin({
    win: true, digits: [7, 7, 7], stageId: "omiya",
    overrides: { route: "campus", resultAnnouncement: true, mirrorBreak: true }
  }), () => 0.99);
  assert.equal(revival.mirrorRevival, true);
  assert.equal(revival.audition?.passed, false);
});

test("結果発表の確率と規定回転数の移行条件はステージごとに分かれる", () => {
  const result = createSpinPlan(spin({
    stageId: "summer", overrides: { route: "campus", wallBreak: false }
  }), () => 0);
  assert.equal(result.resultAnnouncement, true);
  assert.equal(result.stageAdvanceReason, "result");
  assert.equal(result.nextStage?.id, "shibaura");
  const quiet = createSpinPlan(spin({
    stageId: "summer", overrides: { route: "campus", wallBreak: false }
  }), () => 0.99);
  assert.equal(quiet.resultAnnouncement, false);
  assert.equal(quiet.nextStage, null);

  const before = createSpinPlan(spin({ stageId: "teiki", stageSpin: 11, overrides: { route: "akasupi" } }), () => 0.99);
  assert.equal(before.stageAdvanceReason, null);
  const final = createSpinPlan(spin({ stageId: "teiki", stageSpin: 12, overrides: { route: "akasupi" } }), () => 0.99);
  assert.equal(final.stageAdvanceReason, "spins");
  assert.equal(final.nextStage?.id, "summer");
  assert.equal(final.resultAnnouncement, false);
});

test("アカスピはどの通常ステージからも確率で始まる", () => {
  for (const event of CAMPUS_EVENTS) {
    const plan = createSpinPlan(spin({ stageId: event.id, overrides: { wallBreak: false } }), () => 0);
    assert.equal(plan.route, "akasupi");
    assert.equal(plan.stage.id, event.id);
    assert.equal(plan.event, null);
  }
});

test("全国決勝へ行く演出は１次・２次・最終を順に通過して優勝する", () => {
  const plan = createSpinPlan(spin({
    win: true,
    digits: [7, 7, 7],
    overrides: { route: "akasupi", reachId: "national-final" }
  }), () => 0.99);
  assert.deepEqual(plan.akasupiStages.map((stage) => stage.id),
    ["kanto-1", "kanto-2", "kanto-final", "national-final"]);
  assert.equal(plan.akasupiVerdict, "champion");
  assert.equal(plan.mirrorRevival, false);
});

test("途中敗退、ACT、途中からの復活は到達段階に合う結果になる", () => {
  const defeated = createSpinPlan(spin({ overrides: { route: "akasupi", reachId: "kanto-2" } }), () => 0.99);
  assert.deepEqual(defeated.akasupiStages.map((stage) => stage.id), ["kanto-1", "kanto-2"]);
  assert.equal(defeated.akasupiVerdict, "failed");
  const act = createSpinPlan(spin({ overrides: { route: "akasupi", reachId: "kanto-final", act: true } }), () => 0.99);
  assert.equal(act.akasupiVerdict, "act");
  const revival = createSpinPlan(spin({
    win: true, digits: [7, 7, 7], overrides: { route: "akasupi", reachId: "kanto-1" }
  }), () => 0.99);
  assert.equal(revival.akasupiVerdict, "failed");
  assert.equal(revival.mirrorRevival, true);
});

test("アカスピは先の段階ほど当たり時に選ばれやすい", () => {
  const rates = REACHES.map((stage) => stage.winWeight / (stage.winWeight + stage.lossWeight));
  for (let index = 1; index < rates.length; index += 1) assert.ok(rates[index] > rates[index - 1]);
});
