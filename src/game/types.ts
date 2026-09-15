export type Mode = "NORMAL" | "JACKPOT" | "RUSH_HIGH_SPEED" | "RUSH_MAIN" | "RUSH_LAST";
export type HoldColor = "white" | "blue" | "green" | "red" | "gold" | "rainbow";

export interface Hold {
  id: number;
  color: HoldColor;
  omen: "normal" | "chance" | "strong";
  createdAt: number;
}

export interface SpinOverrides {
  result?: "win" | "loss";
  route?: "campus" | "akasupi";
  resultAnnouncement?: boolean;
  reachId?: string;
  wallBreak?: boolean;
  mirrorBreak?: boolean;
  act?: boolean;
}

export interface Spin {
  id: number;
  hold: Hold;
  modeAtStart: Mode;
  rushSpin: number | null;
  stageId: string;
  stageSpin: number | null;
  win: boolean;
  rushEntry: boolean;
  digits: [number, number, number];
  overrides: SpinOverrides;
}

export interface GameSnapshot {
  mode: Mode;
  holds: Hold[];
  activeSpin: Spin | null;
  rushSpins: number;
  totalBalls: number;
  normalSpins: number;
  stageId: string;
  stageSpins: number;
}

export type Random = () => number;
