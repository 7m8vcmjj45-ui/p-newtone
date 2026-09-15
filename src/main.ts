import "./style.css";
import { GameEngine } from "./game/engine";
import type { HoldColor, SpinOverrides } from "./game/types";
import { SoundPlayer } from "./presentation/audio";
import { createSpinPlan } from "./presentation/plan";
import { PresentationRunner } from "./presentation/runner";
import { GameUI } from "./presentation/ui";
import { campusEventById } from "./data/events.ts";

const ui = new GameUI();
const sound = new SoundPlayer();
const engine = new GameEngine();
const runner = new PresentationRunner(engine, ui, sound);

engine.onChange = (snapshot) => ui.render(snapshot);
engine.onSpin = (spin) => { void runner.run(spin, createSpinPlan(spin)); };
engine.onJackpot = (spin) => { void runner.showJackpot(spin); };
ui.render(engine.snapshot);
ui.setHandle(false);

const COLOR_NAMES: Record<HoldColor, string> = {
  white: "白", blue: "青", green: "緑", red: "赤", gold: "金", rainbow: "虹"
};

function admit(event?: MouseEvent, automatic = false): boolean {
  const before = engine.snapshot;
  const hold = engine.addHold();
  if (!hold) {
    if (!automatic) {
      ui.showFeedback("保留MAX", true);
      sound.play("max");
    }
    return false;
  }
  sound.play("entry");
  ui.entryPulse(event);
  const strong = hold.color === "red" || hold.color === "gold" || hold.color === "rainbow";
  if (strong) ui.showFeedback("先読み！ " + COLOR_NAMES[hold.color] + "マイク");
  else if (!automatic) ui.showFeedback(before.activeSpin || before.mode === "JACKPOT"
    ? "入賞・保留 " + engine.snapshot.holds.length + " / 4" : "入賞 → 変動開始");
  return true;
}

ui.lcd.addEventListener("click", (event) => admit(event));
ui.lcd.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    admit();
  }
});

let handleTimer: number | null = null;
function setHandle(enabled: boolean): void {
  if (handleTimer !== null) window.clearInterval(handleTimer);
  handleTimer = null;
  ui.setHandle(enabled);
  if (!enabled) {
    ui.showFeedback("ハンドルOFF・タップで入賞");
    return;
  }
  ui.showFeedback("ハンドルON・自動入賞中");
  admit(undefined, true);
  handleTimer = window.setInterval(() => {
    if (!document.hidden) admit(undefined, true);
  }, 1250);
}
ui.handleControl.addEventListener("click", () => setHandle(handleTimer === null));

const params = new URLSearchParams(window.location.search);
const debugMode = params.get("debug") === "1";
ui.debugPanel.hidden = !debugMode;
ui.debugPanel.open = debugMode;
ui.fastMode.checked = params.get("fast") === "1";
document.getElementById("app")?.classList.toggle("debug-active", debugMode);
const debugShortcut = document.getElementById("debugShortcut") as HTMLAnchorElement;
debugShortcut.hidden = !import.meta.env.DEV || debugMode;

ui.debugPanel.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-debug]");
  if (!button) return;
  const action = button.dataset.debug;
  if (action === "add" || action === "play") { admit(); return; }
  if (action === "fill") { engine.fillHolds(); ui.showFeedback("保留を4個まで追加"); return; }
  if (action === "campus-route") {
    engine.forceNext({ route: "campus", resultAnnouncement: undefined, reachId: undefined, act: false });
    ui.showFeedback("次回転を通常ステージ変動に設定");
    return;
  }
  if (action === "akasupi-route") {
    engine.forceNext({ route: "akasupi", resultAnnouncement: undefined });
    ui.showFeedback("次回転をアカスピに設定");
    return;
  }
  if (action === "selected-event") {
    const selected = document.getElementById("debugEventSelect") as HTMLSelectElement;
    const success = engine.moveToStage(selected.value);
    ui.showFeedback(success ? selected.selectedOptions[0].text + " ステージへ移動"
      : "通常時の変動終了後に移動してください");
    return;
  }
  if (action === "audition") {
    const stage = campusEventById(engine.snapshot.stageId);
    if (stage?.stageExit.kind !== "result") {
      ui.showFeedback("結果発表は大宮祭・夏ライ・芝浦祭・春ライで指定");
      return;
    }
    engine.forceNext({ route: "campus", resultAnnouncement: true, reachId: undefined, act: false });
    ui.showFeedback("次回転に " + stage.name + " 結果発表を設定");
    return;
  }
  if (action === "stage-final") {
    const success = engine.moveToStageFinalSpin();
    ui.showFeedback(success ? "次回転を規定回転の最終変動に設定"
      : "規定回転ステージで変動終了後に操作してください");
    return;
  }
  if (action === "rush" || action === "last") {
    const success = action === "rush" ? engine.enterRush() : engine.moveToRushLast();
    ui.showFeedback(success ? "RUSHへ移動" : "変動終了後に操作してください");
    return;
  }
  if (action === "red" || action === "gold" || action === "rainbow") {
    const queued = engine.snapshot.holds.length;
    engine.forceColor(action as HoldColor);
    if (queued === 0) admit();
    ui.showFeedback(action.toUpperCase() + " 保留を設定");
    return;
  }
  let overrides: SpinOverrides = {};
  if (action === "win") overrides = { result: "win" };
  else if (action === "loss") overrides = { result: "loss" };
  else if (action === "wall") overrides = { wallBreak: true };
  else if (action === "mirror") overrides = { mirrorBreak: true };
  else if (action === "act") overrides = { route: "akasupi", resultAnnouncement: undefined, act: true };
  else if (action?.startsWith("kanto-") || action === "national-final")
    overrides = { route: "akasupi", resultAnnouncement: undefined, reachId: action };
  engine.forceNext(overrides);
  ui.showFeedback("次回転に " + button.textContent + " を設定");
});
