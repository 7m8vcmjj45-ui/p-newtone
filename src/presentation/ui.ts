import { SYMBOL_IMAGES } from "../data/assets";
import type { ReachData } from "../data/reaches";
import type { CampusAuditionResult } from "./campusAudition";
import { ST_LENGTH, isRush } from "../game/probability";
import { campusEventById } from "../data/events.ts";
import type { GameSnapshot, Hold, HoldColor } from "../game/types";

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error("Missing UI element: " + id);
  return element as T;
};

const MODE_NAMES: Record<GameSnapshot["mode"], string> = {
  NORMAL: "通常", JACKPOT: "大当たり",
  RUSH_HIGH_SPEED: "RUSH 高速", RUSH_MAIN: "RUSH メイン", RUSH_LAST: "RUSH アンコール"
};

function micMarkup(color: HoldColor): string {
  return '<svg class="mic-icon mic-' + color + '" viewBox="0 0 48 48"><use href="#mic"></use></svg>';
}

function slotMarkup(hold?: Hold): string {
  return '<div class="hold-slot ' + (hold ? "filled color-" + hold.color : "") + '">' +
    (hold ? micMarkup(hold.color) : '<span class="empty-mark">＋</span>') + '</div>';
}

export class GameUI {
  readonly lcd = byId<HTMLElement>("lcd");
  readonly debugPanel = byId<HTMLDetailsElement>("debugPanel");
  readonly fastMode = byId<HTMLInputElement>("fastMode");
  private symbols = byId<HTMLElement>("symbols");
  private title = byId<HTMLElement>("cueTitle");
  private subtitle = byId<HTMLElement>("cueSubtitle");
  private tag = byId<HTMLElement>("cueTag");
  private footer = byId<HTMLElement>("cueFooter");
  private akasupiProgress = byId<HTMLElement>("akasupiProgress");
  private campusScoreboard = byId<HTMLElement>("campusScoreboard");
  private feedback = byId<HTMLElement>("feedback");
  private pushButton = byId<HTMLButtonElement>("pushButton");
  private handleButton = byId<HTMLButtonElement>("handleButton");
  private crackOverlay = byId<HTMLElement>("crackOverlay");
  private rollingTimer: number | null = null;
  private feedbackTimer: number | null = null;
  private lockedLeft: number | null = null;
  private lockedRight: number | null = null;
  private targetBalls = 0;
  private shownBalls = 0;
  private ballFrame: number | null = null;
  onPush: (() => void) | null = null;

  constructor() {
    this.pushButton.addEventListener("click", () => {
      this.onPush?.();
    });
    this.setPush(false);
  }

  render(snapshot: GameSnapshot): void {
    const stage = campusEventById(snapshot.stageId);
    if (stage && snapshot.mode === "NORMAL" && !snapshot.activeSpin) {
      this.setStage(stage.name);
      this.setVisualType(stage.animationType);
    }
    byId<HTMLElement>("modeValue").textContent = MODE_NAMES[snapshot.mode];
    byId<HTMLElement>("stValue").textContent = isRush(snapshot.mode)
      ? String(ST_LENGTH - snapshot.rushSpins + (snapshot.activeSpin ? 1 : 0)) : "—";
    this.updateBalls(snapshot.totalBalls);
    byId<HTMLElement>("spinCounter").textContent = snapshot.mode === "NORMAL"
      ? "通常 " + snapshot.normalSpins + "回転"
      : isRush(snapshot.mode) ? "ST " + snapshot.rushSpins + " / " + ST_LENGTH : "BONUS";
    byId<HTMLElement>("holdCount").textContent = snapshot.holds.length + " / 4";
    byId<HTMLElement>("holds").innerHTML = Array.from({ length: 4 }, (_, index) => slotMarkup(snapshot.holds[index])).join("");
    byId<HTMLElement>("activeHold").innerHTML = snapshot.activeSpin
      ? micMarkup(snapshot.activeSpin.hold.color) : '<span class="empty-mark">—</span>';
    byId<HTMLElement>("lcdHolds").innerHTML =
      '<div class="lcd-active-slot ' + (snapshot.activeSpin ? "filled" : "") + '">' +
      (snapshot.activeSpin ? micMarkup(snapshot.activeSpin.hold.color) : '<span class="empty-mark">—</span>') +
      '</div>' + Array.from({ length: 4 }, (_, index) => slotMarkup(snapshot.holds[index])).join("");
    const atMax = snapshot.holds.length === 4;
    byId<HTMLElement>("entryStatus").textContent = atMax ? "保留MAX"
      : snapshot.mode === "JACKPOT" ? "BONUS中も入賞OK"
      : snapshot.activeSpin ? "変動中・タップで保留" : "画面タップで入賞";
    this.lcd.classList.toggle("at-max", atMax);
    const strongHold = snapshot.holds.find((hold) =>
      hold.color === "red" || hold.color === "gold" || hold.color === "rainbow"
    );
    const preRead = byId<HTMLElement>("preReadSignal");
    preRead.textContent = strongHold ? "先読み  " + ({ red: "赤", gold: "金", rainbow: "虹" } as const)[strongHold.color as "red" | "gold" | "rainbow"] + "マイク" : "";
    preRead.classList.toggle("visible", !!strongHold);
    this.lcd.classList.toggle("strong-hold", !!strongHold);
    this.lcd.classList.remove("mode-normal", "mode-rush", "mode-last", "mode-jackpot");
    this.lcd.classList.add(snapshot.mode === "NORMAL" ? "mode-normal"
      : snapshot.mode === "JACKPOT" ? "mode-jackpot"
      : snapshot.mode === "RUSH_LAST" ? "mode-last" : "mode-rush");
    const zone = byId<HTMLElement>("zoneLabel");
    zone.textContent = snapshot.mode === "RUSH_HIGH_SPEED" ? "HIGH SPEED  1–30"
      : snapshot.mode === "RUSH_MAIN" ? "RUSH MAIN  31–100"
      : snapshot.mode === "RUSH_LAST" ? "ENCORE  101–120"
      : snapshot.mode === "NORMAL" && stage
        ? stage.stageExit.kind === "spins"
          ? "STAGE  " + snapshot.stageSpins + " / " + stage.stageExit.requiredSpins
          : "STAGE  " + snapshot.stageSpins + "回転"
        : "";
  }

  private updateBalls(target: number): void {
    const display = byId<HTMLElement>("ballsValue");
    if (target === this.targetBalls) {
      if (this.ballFrame === null) display.innerHTML = target.toLocaleString() + " <em>発</em>";
      return;
    }
    if (this.ballFrame !== null) window.cancelAnimationFrame(this.ballFrame);
    const from = this.shownBalls;
    this.targetBalls = target;
    const started = performance.now();
    display.classList.add("counting");
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / 1400);
      this.shownBalls = Math.round(from + (target - from) * (1 - (1 - progress) ** 3));
      display.innerHTML = this.shownBalls.toLocaleString() + " <em>発</em>";
      if (progress < 1) this.ballFrame = window.requestAnimationFrame(step);
      else {
        this.ballFrame = null;
        display.classList.remove("counting");
      }
    };
    this.ballFrame = window.requestAnimationFrame(step);
  }

  setStage(name: string): void {
    byId<HTMLElement>("stageName").textContent = name + " STAGE";
  }

  setVisualType(type: string): void {
    this.lcd.dataset.visual = type;
  }

  setHandle(enabled: boolean): void {
    this.handleButton.classList.toggle("on", enabled);
    this.handleButton.setAttribute("aria-pressed", String(enabled));
    this.handleButton.querySelector("strong")!.textContent = enabled ? "ON" : "OFF";
  }

  get handleControl(): HTMLButtonElement {
    return this.handleButton;
  }

  cue(tag: string, title: string, subtitle: string, footer = ""): void {
    this.tag.textContent = tag;
    this.title.textContent = title;
    this.subtitle.textContent = subtitle;
    this.footer.textContent = footer;
    this.lcd.classList.remove("muted", "blackout");
    if (this.lcd.classList.contains("telop-focus")) {
      this.title.classList.remove("telop-changing");
      this.subtitle.classList.remove("telop-changing");
      void this.title.offsetWidth;
      this.title.classList.add("telop-changing");
      this.subtitle.classList.add("telop-changing");
    }
  }

  setReachDevelopment(stages: ReachData[] | null): void {
    const active = !!stages?.length;
    this.lcd.classList.toggle("reach-developing", active);
    this.setTelopFocus(active);
    this.akasupiProgress.replaceChildren();
    this.title.classList.remove("telop-changing");
    this.subtitle.classList.remove("telop-changing");
    if (!stages) return;
    for (const stage of stages) {
      const step = document.createElement("span");
      step.className = "akasupi-step";
      step.textContent = stage.progressName;
      this.akasupiProgress.append(step);
    }
  }

  setTelopFocus(active: boolean): void {
    this.lcd.classList.toggle("telop-focus", active);
    if (!active) {
      this.title.classList.remove("telop-changing");
      this.subtitle.classList.remove("telop-changing");
    }
  }

  setCampusScoreboard(scores: CampusAuditionResult["scores"] | null): void {
    this.lcd.classList.toggle("campus-audition", !!scores);
    this.campusScoreboard.replaceChildren();
    if (!scores) return;
    for (const score of scores) {
      const row = document.createElement("span");
      row.className = "campus-score-row";
      const name = document.createElement("small");
      name.textContent = score.name;
      const points = document.createElement("strong");
      points.textContent = "—";
      row.append(name, points);
      this.campusScoreboard.append(row);
    }
  }

  revealCampusScore(index: number, points: number): void {
    const row = this.campusScoreboard.children[index];
    if (!(row instanceof HTMLElement)) return;
    row.querySelector("strong")!.textContent = points + "点";
    row.classList.add("revealed");
  }

  setReachStep(index: number, status: "judging" | "passed" | "failed" | "act" | "champion"): void {
    const step = this.akasupiProgress.children[index];
    if (!step) return;
    step.className = "akasupi-step " + status;
    const statusName = status === "failed" && index === 3 ? "優勝ならず"
      : { judging: "審査中", passed: "通過", failed: "通過ならず", act: "審査中ACT", champion: "優勝" }[status];
    this.akasupiProgress.setAttribute("aria-label", "アカスピ審査進行: " +
      Array.from(this.akasupiProgress.children).map((item) => item.textContent).join(" → ") +
      " / " + (index + 1) + "段階目 " + statusName);
  }

  setDigits(digits: [number, number, number], special = false): void {
    this.symbols.innerHTML = digits.map((digit) => {
      const image = SYMBOL_IMAGES[digit];
      const content = image ? '<img src="' + image + '" alt="' + digit + '図柄" />' : String(digit);
      return '<span class="symbol ' + (digit === 7 ? "seven " : "") + (special ? "hit" : "") + '">' + content + '</span>';
    }).join("");
  }

  startRolling(): void {
    this.stopRolling();
    this.symbols.classList.add("rolling");
    this.rollingTimer = window.setInterval(() => {
      this.renderRollingDigits();
    }, 95);
  }

  lockLeft(symbol: number): void {
    this.lockedLeft = symbol;
    this.symbols.classList.add("left-locked");
    this.renderRollingDigits();
  }

  lockRight(symbol: number): void {
    this.lockedRight = symbol;
    this.symbols.classList.remove("rolling");
    this.symbols.classList.add("right-locked", "center-rolling");
    this.renderRollingDigits();
  }

  private renderRollingDigits(): void {
    const randomDigit = () => 1 + Math.floor(Math.random() * 7);
    this.setDigits([
      this.lockedLeft ?? randomDigit(),
      randomDigit(),
      this.lockedRight ?? randomDigit()
    ]);
  }

  stopRolling(digits?: [number, number, number], special = false): void {
    if (this.rollingTimer !== null) window.clearInterval(this.rollingTimer);
    this.rollingTimer = null;
    this.lockedLeft = null;
    this.lockedRight = null;
    this.symbols.classList.remove("rolling", "left-locked", "right-locked", "center-rolling");
    if (digits) this.setDigits(digits, special);
  }

  showCrack(kind: "wall" | "mirror"): void {
    this.crackOverlay.classList.remove("wall", "mirror", "visible");
    void this.crackOverlay.offsetWidth;
    this.crackOverlay.classList.add(kind, "visible");
    window.setTimeout(() => this.crackOverlay.classList.remove("visible"), 1300);
  }

  setMuted(muted: boolean): void {
    this.lcd.classList.toggle("muted", muted);
  }

  setBlackout(blackout: boolean): void {
    this.lcd.classList.toggle("blackout", blackout);
  }

  setPush(active: boolean): void {
    this.pushButton.classList.toggle("ready", active);
    this.pushButton.disabled = !active;
  }

  showFeedback(message: string, max = false): void {
    this.feedback.textContent = message;
    this.feedback.classList.toggle("max", max);
    this.feedback.classList.add("visible");
    if (max) {
      byId<HTMLElement>("holds").classList.add("shaking");
      byId<HTMLElement>("lcdHolds").classList.add("shaking");
    }
    if (this.feedbackTimer !== null) window.clearTimeout(this.feedbackTimer);
    this.feedbackTimer = window.setTimeout(() => {
      this.feedback.classList.remove("visible");
      byId<HTMLElement>("holds").classList.remove("shaking");
      byId<HTMLElement>("lcdHolds").classList.remove("shaking");
    }, 950);
  }

  entryPulse(event?: MouseEvent): void {
    const layer = byId<HTMLElement>("entryPulseLayer");
    const rect = this.lcd.getBoundingClientRect();
    const pulse = document.createElement("span");
    pulse.className = "entry-pulse";
    pulse.style.left = ((event?.clientX ?? rect.left + rect.width / 2) - rect.left) + "px";
    pulse.style.top = ((event?.clientY ?? rect.top + rect.height / 2) - rect.top) + "px";
    layer.append(pulse);
    window.setTimeout(() => pulse.remove(), 600);
  }
}
