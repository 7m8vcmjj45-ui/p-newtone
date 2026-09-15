import assert from "node:assert/strict";
import test from "node:test";
import { GameEngine } from "../src/game/engine.ts";
import { createSpinPlan } from "../src/presentation/plan.ts";

const alwaysHigh = () => 0.99;

test("変動中に4保留を貯め、終了時に次を自動消化する", () => {
  const engine = new GameEngine(alwaysHigh);
  assert.ok(engine.addHold());
  const firstSpin = engine.snapshot.activeSpin;
  assert.ok(firstSpin);
  for (let i = 0; i < 4; i += 1) assert.ok(engine.addHold());
  assert.equal(engine.snapshot.holds.length, 4);
  assert.equal(engine.addHold(), null);
  engine.finishSpin(firstSpin.id);
  assert.equal(engine.snapshot.holds.length, 3);
  assert.ok(engine.snapshot.activeSpin);
  assert.notEqual(engine.snapshot.activeSpin.id, firstSpin.id);
});

test("STの30・100・120回境界で状態が切り替わる", () => {
  const engine = new GameEngine(alwaysHigh);
  assert.equal(engine.enterRush(), true);
  for (let number = 1; number <= 120; number += 1) {
    assert.ok(engine.addHold());
    const spin = engine.snapshot.activeSpin;
    assert.ok(spin);
    assert.equal(spin.rushSpin, number);
    if (number === 30) assert.equal(engine.snapshot.mode, "RUSH_HIGH_SPEED");
    if (number === 31) assert.equal(engine.snapshot.mode, "RUSH_MAIN");
    if (number === 100) assert.equal(engine.snapshot.mode, "RUSH_MAIN");
    if (number === 101 || number === 120) assert.equal(engine.snapshot.mode, "RUSH_LAST");
    assert.equal(spin.win, false);
    engine.finishSpin(spin.id);
  }
  assert.equal(engine.snapshot.mode, "NORMAL");
  assert.equal(engine.snapshot.rushSpins, 0);
});

test("初当たりとRUSH再当たりの1500発、ST再セット", () => {
  const engine = new GameEngine(alwaysHigh);
  engine.forceNext({ result: "win" });
  assert.ok(engine.addHold());
  const first = engine.snapshot.activeSpin;
  assert.ok(first);
  assert.equal(first.rushEntry, false);
  engine.finishSpin(first.id);
  assert.equal(engine.snapshot.mode, "JACKPOT");
  assert.equal(engine.snapshot.totalBalls, 1500);
  engine.completeJackpot();
  assert.equal(engine.snapshot.mode, "NORMAL");

  assert.equal(engine.enterRush(), true);
  engine.forceNext({ result: "win" });
  assert.ok(engine.addHold());
  const second = engine.snapshot.activeSpin;
  assert.ok(second);
  assert.equal(second.rushEntry, true);
  engine.finishSpin(second.id);
  assert.equal(engine.snapshot.totalBalls, 3000);
  engine.completeJackpot();
  assert.equal(engine.snapshot.mode, "RUSH_HIGH_SPEED");
  assert.equal(engine.snapshot.rushSpins, 0);
});

test("初当たりのRUSH突入判定は60%境界で分かれる", () => {
  for (const [draw, expected] of [[0.59, true], [0.6, false]] as const) {
    const engine = new GameEngine(() => draw);
    engine.forceNext({ result: "win" });
    assert.ok(engine.addHold());
    assert.equal(engine.snapshot.activeSpin?.rushEntry, expected);
  }
});

test("規定回転の最終変動後は次の行事へ移り、待機保留も次のステージで回る", () => {
  const engine = new GameEngine(alwaysHigh);
  assert.equal(engine.moveToStage("teiki"), true);
  assert.equal(engine.moveToStageFinalSpin(), true);
  engine.forceNext({ route: "akasupi", result: "loss" });
  assert.ok(engine.addHold());
  const final = engine.snapshot.activeSpin;
  assert.ok(final);
  assert.equal(final.stageId, "teiki");
  assert.equal(final.stageSpin, 12);
  const plan = createSpinPlan(final, alwaysHigh);
  assert.equal(plan.stageAdvanceReason, "spins");
  assert.equal(plan.nextStage?.id, "summer");
  assert.ok(engine.addHold());
  assert.equal(engine.advanceStage(final.id, "result"), false);
  assert.equal(engine.advanceStage(final.id, "spins"), true);
  assert.equal(engine.snapshot.stageId, "summer");
  assert.equal(engine.snapshot.stageSpins, 0);
  engine.finishSpin(final.id);
  assert.equal(engine.snapshot.activeSpin?.stageId, "summer");
  assert.equal(engine.snapshot.activeSpin?.stageSpin, 1);
});

test("結果発表型のステージは発表後に移り、移動は変動中にできない", () => {
  const engine = new GameEngine(alwaysHigh);
  assert.equal(engine.snapshot.stageId, "omiya");
  assert.equal(engine.moveToStageFinalSpin(), false);
  engine.forceNext({ route: "campus", resultAnnouncement: true, result: "loss" });
  assert.ok(engine.addHold());
  const spin = engine.snapshot.activeSpin;
  assert.ok(spin);
  assert.equal(engine.moveToStage("shibaura"), false);
  const plan = createSpinPlan(spin, alwaysHigh);
  assert.equal(plan.stageAdvanceReason, "result");
  assert.equal(engine.advanceStage(spin.id, "result"), true);
  assert.equal(engine.snapshot.stageId, "teiki");
  engine.finishSpin(spin.id);
  assert.equal(engine.moveToStage("shibaura"), true);
  assert.equal(engine.snapshot.stageId, "shibaura");
});
