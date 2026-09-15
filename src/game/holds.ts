import { HOLD_COLORS, HOLD_WEIGHTS, pickWeighted } from "./probability.ts";
import type { Hold, HoldColor, Random } from "./types";

export const HOLD_LIMIT = 4;

export class HoldQueue {
  private items: Hold[] = [];
  private nextId = 1;
  private random: Random;

  constructor(random: Random = Math.random) {
    this.random = random;
  }

  get holds(): Hold[] {
    return [...this.items];
  }

  add(forcedColor?: HoldColor): Hold | null {
    if (this.items.length >= HOLD_LIMIT) return null;
    const color = forcedColor ?? pickWeighted(HOLD_COLORS, HOLD_WEIGHTS, this.random);
    const omen = color === "red" || color === "gold" || color === "rainbow"
      ? "strong" : color === "green" ? "chance" : "normal";
    const hold: Hold = { id: this.nextId++, color, omen, createdAt: Date.now() };
    this.items.push(hold);
    return hold;
  }

  consume(): Hold | null {
    return this.items.shift() ?? null;
  }

  recolorFirst(color: HoldColor): boolean {
    const first = this.items[0];
    if (!first) return false;
    first.color = color;
    first.omen = color === "red" || color === "gold" || color === "rainbow" ? "strong" : "chance";
    return true;
  }
}
