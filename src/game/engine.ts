import { HoldQueue } from "./holds.ts";
import { CAMPUS_EVENTS } from "../data/events.ts";
import { PAYOUT_BALLS, ST_LENGTH, isRush, rushZone } from "./probability.ts";
import { createSpin } from "./spinResult.ts";
import type { GameSnapshot, Hold, HoldColor, Mode, Random, Spin, SpinOverrides } from "./types";

export class GameEngine {
  private queue: HoldQueue;
  private mode: Mode = "NORMAL";
  private activeSpin: Spin | null = null;
  private rushSpins = 0;
  private normalSpins = 0;
  private stageIndex = 0;
  private stageSpins = 0;
  private totalBalls = 0;
  private spinId = 1;
  private nextColor?: HoldColor;
  private nextOverrides: SpinOverrides = {};
  private jackpotRush = false;
  private random: Random;

  onChange: (snapshot: GameSnapshot) => void = () => {};
  onSpin: (spin: Spin) => void = () => {};
  onJackpot: (spin: Spin) => void = () => {};

  constructor(random: Random = Math.random) {
    this.random = random;
    this.queue = new HoldQueue(random);
  }

  get snapshot(): GameSnapshot {
    return {
      mode: this.mode,
      holds: this.queue.holds,
      activeSpin: this.activeSpin,
      rushSpins: this.rushSpins,
      normalSpins: this.normalSpins,
      stageId: CAMPUS_EVENTS[this.stageIndex].id,
      stageSpins: this.stageSpins,
      totalBalls: this.totalBalls
    };
  }

  addHold(): Hold | null {
    const hold = this.queue.add(this.nextColor);
    if (!hold) return null;
    this.nextColor = undefined;
    this.emit();
    this.startNext();
    return hold;
  }

  fillHolds(): number {
    let count = 0;
    while (this.queue.holds.length < 4) {
      if (!this.addHold()) break;
      count += 1;
    }
    return count;
  }

  forceColor(color: HoldColor): void {
    if (!this.queue.recolorFirst(color)) this.nextColor = color;
    this.emit();
  }

  forceNext(overrides: SpinOverrides): void {
    this.nextOverrides = { ...this.nextOverrides, ...overrides };
    this.emit();
  }

  moveToStage(stageId: string): boolean {
    if (this.activeSpin || this.mode !== "NORMAL") return false;
    const index = CAMPUS_EVENTS.findIndex((event) => event.id === stageId);
    if (index < 0) return false;
    this.stageIndex = index;
    this.stageSpins = 0;
    this.emit();
    return true;
  }

  moveToStageFinalSpin(): boolean {
    if (this.activeSpin || this.mode !== "NORMAL") return false;
    const exit = CAMPUS_EVENTS[this.stageIndex].stageExit;
    if (exit.kind !== "spins") return false;
    this.stageSpins = exit.requiredSpins - 1;
    this.emit();
    return true;
  }

  advanceStage(spinId: number, reason: "result" | "spins"): boolean {
    const spin = this.activeSpin;
    if (!spin || spin.id !== spinId || spin.modeAtStart !== "NORMAL") return false;
    const exit = CAMPUS_EVENTS[this.stageIndex].stageExit;
    if (exit.kind !== reason || (exit.kind === "spins" && this.stageSpins < exit.requiredSpins)) return false;
    this.stageIndex = (this.stageIndex + 1) % CAMPUS_EVENTS.length;
    this.stageSpins = 0;
    this.emit();
    return true;
  }

  enterRush(): boolean {
    if (this.activeSpin || this.mode === "JACKPOT") return false;
    this.rushSpins = 0;
    this.mode = "RUSH_HIGH_SPEED";
    this.emit();
    this.startNext();
    return true;
  }

  moveToRushLast(): boolean {
    if (this.activeSpin || this.mode === "JACKPOT") return false;
    this.rushSpins = 100;
    this.mode = "RUSH_LAST";
    this.emit();
    this.startNext();
    return true;
  }

  finishSpin(spinId: number): void {
    const spin = this.activeSpin;
    if (!spin || spin.id !== spinId) return;
    this.activeSpin = null;
    if (spin.win) {
      this.totalBalls += PAYOUT_BALLS;
      this.jackpotRush = spin.rushEntry;
      this.mode = "JACKPOT";
      this.emit();
      this.onJackpot(spin);
      return;
    }
    if (spin.rushSpin === ST_LENGTH) {
      this.mode = "NORMAL";
      this.rushSpins = 0;
    }
    this.emit();
    this.startNext();
  }

  completeJackpot(): void {
    if (this.mode !== "JACKPOT") return;
    this.mode = this.jackpotRush ? "RUSH_HIGH_SPEED" : "NORMAL";
    this.rushSpins = 0;
    this.emit();
    this.startNext();
  }

  private startNext(): void {
    if (this.activeSpin || this.mode === "JACKPOT") return;
    const hold = this.queue.consume();
    if (!hold) return;
    let rushSpin: number | null = null;
    let stageSpin: number | null = null;
    if (isRush(this.mode)) {
      this.rushSpins += 1;
      rushSpin = this.rushSpins;
      this.mode = rushZone(rushSpin);
    } else {
      this.normalSpins += 1;
      this.stageSpins += 1;
      stageSpin = this.stageSpins;
    }
    const overrides = this.nextOverrides;
    this.nextOverrides = {};
    const spin = createSpin(this.spinId++, hold, this.mode, rushSpin,
      CAMPUS_EVENTS[this.stageIndex].id, stageSpin, overrides, this.random);
    this.activeSpin = spin;
    this.emit();
    this.onSpin(spin);
  }

  private emit(): void {
    this.onChange(this.snapshot);
  }
}
