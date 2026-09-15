import { CAMPUS_EVENTS, campusEventById, nextCampusEvent, type EventData } from "../data/events.ts";
import { SONG_PREDICTIONS, type PredictionData } from "../data/predictions.ts";
import { REACHES, type ReachData } from "../data/reaches.ts";
import { isRush, pickWeighted } from "../game/probability.ts";
import type { Random, Spin } from "../game/types";
import { createCampusAudition, type CampusAuditionResult } from "./campusAudition.ts";

export type PresentationRoute = "campus" | "akasupi" | "rush";

export interface SpinPlan {
  route: PresentationRoute;
  stage: EventData;
  event: EventData | null;
  prediction: PredictionData | null;
  audition: CampusAuditionResult | null;
  resultAnnouncement: boolean;
  stageAdvanceReason: "result" | "spins" | null;
  nextStage: EventData | null;
  reach: ReachData | null;
  akasupiStages: ReachData[];
  akasupiDisplayStages: ReachData[];
  akasupiVerdict: "failed" | "act" | "champion" | null;
  campusChance: boolean;
  wallBreak: boolean;
  mirrorRevival: boolean;
  act: boolean;
  rushReach: boolean;
  finalDigits: [number, number, number];
  rushGimmick: "instant" | "blackout" | "push" | "odd";
  lastSpinFinale: boolean;
}

function requestedReach(id: string | undefined): ReachData | null {
  return REACHES.find((reach) => reach.id === id) ?? null;
}

function chooseRoute(spin: Spin, random: Random): PresentationRoute {
  if (isRush(spin.modeAtStart)) return "rush";
  if (spin.overrides.route) return spin.overrides.route;
  if (spin.overrides.resultAnnouncement) return "campus";
  if (spin.overrides.reachId || spin.overrides.act || spin.overrides.wallBreak || spin.overrides.mirrorBreak) return "akasupi";
  return random() < (spin.win ? 0.72 : 0.15) ? "akasupi" : "campus";
}

export function createSpinPlan(spin: Spin, random: Random = Math.random): SpinPlan {
  const stage = campusEventById(spin.stageId) ?? CAMPUS_EVENTS[0];
  const route = chooseRoute(spin, random);
  const rush = isRush(spin.modeAtStart);
  const wallBreak = spin.overrides.wallBreak ?? (!rush && random() < (spin.win ? 0.42 : 0.012));
  const requested = requestedReach(spin.overrides.reachId);
  const forcedReach = spin.overrides.act && requested && !requested.allowsAct ? REACHES[2] : requested;
  let reach: ReachData | null = null;
  if (route === "akasupi") {
    const options = wallBreak ? REACHES.slice(2) : REACHES;
    reach = forcedReach ?? pickWeighted(
      options,
      options.map((item) => spin.win ? item.winWeight : item.lossWeight),
      random
    );
  }
  const act = route === "akasupi" && (
    spin.overrides.act === true ||
    (!spin.win && !!reach?.allowsAct && random() < (reach.id === "national-final" ? 0.36 : 0.28))
  );
  const campusChance = route === "campus" && (spin.win || random() < (wallBreak ? 0.44 : 0.07));
  const rushReach = route === "rush" && spin.modeAtStart !== "RUSH_HIGH_SPEED" &&
    (spin.win || random() < (spin.modeAtStart === "RUSH_LAST" ? 0.035 : 0.19));
  const mirrorRevival = spin.win && (
    spin.overrides.mirrorBreak === true || act ||
    (route === "akasupi" && (reach?.id !== "national-final" || random() < 0.12))
  );
  const akasupiStages = reach ? REACHES.slice(0, reach.expectedLevel) : [];
  const akasupiVerdict = route !== "akasupi" ? null
    : act ? "act"
    : spin.win && !mirrorRevival && reach?.id === "national-final" ? "champion" : "failed";

  const event = route === "campus" ? stage : null;
  const resultAnnouncement = route === "campus" && stage.stageExit.kind === "result" &&
    (spin.overrides.resultAnnouncement ?? random() < stage.stageExit.announcementChance);
  const showPrediction = resultAnnouncement && stage.predictionEligible;
  const prediction = showPrediction
    ? pickWeighted(
      SONG_PREDICTIONS,
      SONG_PREDICTIONS.map((item) => spin.win
        ? item.weight * item.expectedLevel * item.expectedLevel : item.weight
      ),
      random
    )
    : null;
  const audition = resultAnnouncement
    ? createCampusAudition(prediction?.songs ?? stage.passingSlots, spin.win && !mirrorRevival, random)
    : null;
  const stageAdvanceReason = spin.modeAtStart !== "NORMAL" ? null
    : stage.stageExit.kind === "spins" && (spin.stageSpin ?? 0) >= stage.stageExit.requiredSpins ? "spins"
    : resultAnnouncement ? "result" : null;
  const nextStage = stageAdvanceReason ? nextCampusEvent(stage.id) : null;

  const hasVisibleReach = !!reach || campusChance || rushReach;
  const reachSymbol = spin.digits[0] === 7 ? 6 : spin.digits[0];
  const missCenter = spin.digits[1] === reachSymbol
    ? (reachSymbol === 6 ? 5 : reachSymbol + 1) : spin.digits[1];
  const plainDigits: [number, number, number] = spin.digits[0] === spin.digits[2]
    ? [spin.digits[0], spin.digits[1], spin.digits[2] === 7 ? 1 : spin.digits[2] + 1]
    : spin.digits;
  const finalDigits: [number, number, number] = spin.win ? spin.digits
    : hasVisibleReach ? [reachSymbol, missCenter, reachSymbol] : plainDigits;
  const gimmicks: SpinPlan["rushGimmick"][] = ["instant", "blackout", "push", "odd"];

  return {
    route,
    stage,
    event,
    prediction,
    audition,
    resultAnnouncement,
    stageAdvanceReason,
    nextStage,
    reach,
    akasupiStages,
    akasupiDisplayStages: route === "akasupi" ? REACHES : [],
    akasupiVerdict,
    campusChance,
    wallBreak,
    mirrorRevival,
    act,
    rushReach,
    finalDigits,
    rushGimmick: gimmicks[Math.floor(random() * gimmicks.length)],
    lastSpinFinale: spin.rushSpin === 120
  };
}
