import { AUDITION_CATEGORIES, MAX_AUDITION_RANK, MAX_CATEGORY_SCORE, MIN_CATEGORY_SCORE } from "../data/audition.ts";
import type { Random } from "../game/types.ts";

export interface CampusAuditionResult {
  scores: { id: string; name: string; points: number }[];
  total: number;
  rank: number;
  passingSlots: number;
  passed: boolean;
}

const TOP_SCORE = 37;
const BOTTOM_SCORE = 16;
const SCORE_VARIATION = 8;

export function createCampusAudition(passingSlots: number, shouldPass: boolean, random: Random): CampusAuditionResult {
  const slots = Math.max(1, Math.min(MAX_AUDITION_RANK - 1, passingSlots));
  const rangeStart = shouldPass ? 1 : slots + 1;
  const rangeSize = shouldPass ? slots : MAX_AUDITION_RANK - slots;
  const rank = rangeStart + Math.floor(random() * rangeSize);
  const baseline = TOP_SCORE - (rank - 1) * (TOP_SCORE - BOTTOM_SCORE) / (MAX_AUDITION_RANK - 1);
  const scores = AUDITION_CATEGORIES.map((category) => ({
    ...category,
    points: Math.max(MIN_CATEGORY_SCORE, Math.min(MAX_CATEGORY_SCORE,
      Math.round(baseline + (random() - 0.5) * SCORE_VARIATION)))
  }));

  return {
    scores,
    total: scores.reduce((sum, score) => sum + score.points, 0),
    rank,
    passingSlots: slots,
    passed: rank <= slots
  };
}
