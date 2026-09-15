export interface EventData {
  id: string;
  name: string;
  groupId: "campus";
  weight: number;
  expectedLevel: number;
  animationType: string;
  predictionEligible: boolean;
  passingSlots: 12 | 16 | 20;
  stageExit: { kind: "result"; announcementChance: number } | { kind: "spins"; requiredSpins: number };
}

export const CAMPUS_EVENT_GROUP = { id: "campus", name: "学内イベント" } as const;
export const RESULT_ANNOUNCEMENT_CHANCE = 0.18;
export const COUNT_STAGE_SPINS = 12;

export const CAMPUS_EVENTS: EventData[] = [
  { id: "omiya", name: "大宮祭", groupId: "campus", weight: 16, expectedLevel: 2, animationType: "festival", predictionEligible: true, passingSlots: 16, stageExit: { kind: "result", announcementChance: RESULT_ANNOUNCEMENT_CHANCE } },
  { id: "teiki", name: "定期演奏会", groupId: "campus", weight: 12, expectedLevel: 1, animationType: "concert", predictionEligible: false, passingSlots: 12, stageExit: { kind: "spins", requiredSpins: COUNT_STAGE_SPINS } },
  { id: "summer", name: "夏ライ", groupId: "campus", weight: 16, expectedLevel: 2, animationType: "live", predictionEligible: true, passingSlots: 16, stageExit: { kind: "result", announcementChance: RESULT_ANNOUNCEMENT_CHANCE } },
  { id: "shibaura", name: "芝浦祭", groupId: "campus", weight: 10, expectedLevel: 3, animationType: "festival", predictionEligible: true, passingSlots: 20, stageExit: { kind: "result", announcementChance: RESULT_ANNOUNCEMENT_CHANCE } },
  { id: "winter", name: "冬ライ", groupId: "campus", weight: 12, expectedLevel: 1, animationType: "live", predictionEligible: false, passingSlots: 12, stageExit: { kind: "spins", requiredSpins: COUNT_STAGE_SPINS } },
  { id: "christmas", name: "クリライ", groupId: "campus", weight: 12, expectedLevel: 1, animationType: "concert", predictionEligible: false, passingSlots: 12, stageExit: { kind: "spins", requiredSpins: COUNT_STAGE_SPINS } },
  { id: "spring", name: "春ライ", groupId: "campus", weight: 16, expectedLevel: 2, animationType: "live", predictionEligible: true, passingSlots: 16, stageExit: { kind: "result", announcementChance: RESULT_ANNOUNCEMENT_CHANCE } }
];

export const PREDICTION_EVENTS = CAMPUS_EVENTS.filter((event) => event.predictionEligible);

export function campusEventById(id: string): EventData | undefined {
  return CAMPUS_EVENTS.find((event) => event.id === id);
}

export function nextCampusEvent(id: string): EventData {
  const index = CAMPUS_EVENTS.findIndex((event) => event.id === id);
  return CAMPUS_EVENTS[(index + 1) % CAMPUS_EVENTS.length];
}
