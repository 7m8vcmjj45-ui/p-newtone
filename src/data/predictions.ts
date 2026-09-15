export interface PredictionData {
  songs: 12 | 16 | 20;
  weight: number;
  expectedLevel: number;
  animationType: string;
}

export const SONG_PREDICTIONS: PredictionData[] = [
  { songs: 12, weight: 60, expectedLevel: 1, animationType: "count" },
  { songs: 16, weight: 30, expectedLevel: 2, animationType: "count" },
  { songs: 20, weight: 10, expectedLevel: 3, animationType: "count" }
];

export const PREDICTION_UPGRADE_STEPS = [12, 16, 20] as const;
