import type { Spin } from "../game/types";
import type { SpinPlan } from "./plan";
import { SoundPlayer } from "./audio";
import { GameUI } from "./ui";
import { GameEngine } from "../game/engine";
import type { EventData } from "../data/events.ts";

export class PresentationRunner {
  private bonusDigits: [number, number, number] | null = null;
  constructor(private engine: GameEngine, private ui: GameUI, private sound: SoundPlayer) {}

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, this.ui.fastMode.checked ? Math.max(120, ms * 0.22) : ms));
  }

  private async pushPrompt(timeout = 1900): Promise<void> {
    this.ui.setPush(true);
    this.ui.cue("PUSH", "押せ！", "最後の一音を届けろ", "PUSHボタンを押してください");
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.ui.onPush = null;
        this.ui.setPush(false);
        resolve();
      };
      this.ui.onPush = () => {
        this.sound.play("push");
        finish();
      };
      window.setTimeout(finish, this.ui.fastMode.checked ? 350 : timeout);
    });
  }

  async run(spin: Spin, plan: SpinPlan): Promise<void> {
    this.ui.setMuted(false);
    this.ui.setBlackout(false);
    this.ui.setReachDevelopment(null);
    this.ui.setCampusScoreboard(null);
    if (plan.route === "campus") await this.campusSpin(spin, plan);
    else if (plan.route === "akasupi") await this.akasupiSpin(spin, plan);
    else if (spin.modeAtStart === "RUSH_HIGH_SPEED") await this.highSpeedSpin(spin, plan);
    else await this.rushSpin(spin, plan);
    if (plan.nextStage && plan.stageAdvanceReason) {
      await this.showStageTransition(plan.stage, plan.nextStage, plan.stageAdvanceReason);
      this.engine.advanceStage(spin.id, plan.stageAdvanceReason);
    }
    if (spin.win) this.bonusDigits = plan.mirrorRevival || spin.modeAtStart === "RUSH_HIGH_SPEED"
      ? [7, 7, 7] : spin.digits;
    this.engine.finishSpin(spin.id);
  }

  private async stopOuterReels(digits: [number, number, number]): Promise<void> {
    this.ui.lockLeft(digits[0]);
    this.sound.play("stop");
    await this.wait(260);
    this.ui.lockRight(digits[2]);
    this.sound.play("stop");
    await this.wait(310);
  }

  private async wallChance(plan: SpinPlan): Promise<void> {
    if (!plan.wallBreak) return;
    this.sound.play("crack");
    this.ui.showCrack("wall");
    this.ui.cue("強チャンスアップ", "バキッ！", "壁割れ発生", "このステージで決着");
    await this.wait(1100);
  }

  private async campusSpin(spin: Spin, plan: SpinPlan): Promise<void> {
    const event = plan.event!;
    this.ui.setStage(event.name);
    this.ui.setVisualType(event.animationType);
    this.ui.cue(event.name + " STAGE", event.name, "NewToneの一音を響かせよう", "液晶タップで保留を追加");
    this.ui.startRolling();
    await this.wait(850);

    if (!plan.resultAnnouncement) {
      await this.wallChance(plan);
      await this.stopOuterReels(plan.finalDigits);
      if (plan.campusChance) {
        this.sound.play("reach");
        this.ui.cue(event.name + " チャンス", "テンパイ！", "このステージで決着", "PUSHへ");
        await this.wait(850);
        if (!plan.mirrorRevival) await this.pushPrompt();
      }
      await this.resolveNormalResult(spin, plan, event.name + " 変動終了");
      return;
    }
    const audition = plan.audition!;

    if (plan.prediction) {
      const prediction = plan.prediction;
      this.ui.cue(event.name + " / 内ステ通過バンド数予告", event.name,
        "内ステ通過バンド  " + prediction.songs + "曲",
        prediction.songs === 20 && event.id === "shibaura" ? "芝浦祭 × 20曲  激アツ" : "12 ＜ 16 ＜ 20");
      await this.wait(1250);
    }

    await this.wallChance(plan);
    await this.stopOuterReels(plan.finalDigits);
    if (plan.campusChance) {
      this.sound.play("reach");
      this.ui.cue(event.name + " チャンス", "テンパイ！", event.name + "の採点へ", "結果発表に注目");
      await this.wait(650);
    }
    this.ui.stopRolling();
    this.ui.setCampusScoreboard(audition.scores);
    this.ui.setTelopFocus(true);
    this.ui.cue(event.name + " オーディション", "採点開始", event.name + "の結果を発表", "各項目10〜40点");
    await this.wait(800);

    for (const [index, score] of audition.scores.entries()) {
      this.ui.cue(event.name + " 採点 " + (index + 1) + " / 4", score.name,
        "採点中……", "ハーモニー / リズム / ステージング / 表現力");
      await this.wait(380);
      this.sound.play("stop");
      this.ui.revealCampusScore(index, score.points);
      this.ui.cue(event.name + " 採点 " + (index + 1) + " / 4", score.name,
        score.points + "点", "次の項目へ");
      await this.wait(700);
    }

    this.ui.cue(event.name + " 集計", "合計", audition.total + "点 / 160点満点", event.name);
    await this.wait(1050);
    this.ui.cue(event.name + " 通過基準", "通過枠 " + audition.passingSlots + "曲",
      audition.passingSlots + "位以内なら通過", "全30組中の順位を発表");
    await this.wait(850);
    if (plan.campusChance) await this.pushPrompt(1750);

    this.ui.cue(event.name + " 順位発表", "順位", audition.rank + "位 / 30組", "通過枠 " + audition.passingSlots + "曲");
    await this.wait(900);
    this.ui.cue(event.name + " 結果発表", audition.passed ? "通過！" : "不通過……",
      audition.rank + "位 / 通過枠 " + audition.passingSlots + "曲",
      audition.passed ? "NewToneの一音が届いた" : "次のステージへ、もう一度");
    this.sound.play(audition.passed ? "reach" : "stop");
    await this.wait(1400);
    this.ui.setCampusScoreboard(null);
    this.ui.setTelopFocus(false);
    await this.resolveNormalResult(spin, plan, event.name + " 結果");
  }

  private async akasupiSpin(spin: Spin, plan: SpinPlan): Promise<void> {
    this.ui.setStage(plan.stage.name);
    this.ui.setVisualType("audition");
    this.ui.cue(plan.stage.name + " / アカスピ予兆", "大会への挑戦", "NewToneの声を全国へ", "液晶タップで保留を追加");
    this.ui.startRolling();
    await this.wait(850);
    await this.wallChance(plan);
    await this.stopOuterReels(plan.finalDigits);

    await this.akasupiDevelopment(plan);
    await this.resolveNormalResult(spin, plan, "変動終了");
  }

  private async showStageTransition(from: EventData, to: EventData, reason: "result" | "spins"): Promise<void> {
    this.ui.stopRolling();
    this.ui.setReachDevelopment(null);
    this.ui.setCampusScoreboard(null);
    this.ui.setTelopFocus(true);
    this.ui.setVisualType("transition");
    this.ui.cue("STAGE CHANGE", from.name + " → " + to.name,
      reason === "result" ? "結果発表を受けて、次のステージへ" : "規定回転数を消化。次のステージへ",
      "ステージ移行中");
    await this.wait(1700);
    this.ui.setBlackout(true);
    await this.wait(300);
    this.ui.setBlackout(false);
    this.ui.setStage(to.name);
    this.ui.setVisualType(to.animationType);
    this.ui.cue("NEXT STAGE", to.name, "NewToneの次の一音が始まる", "液晶タップで保留を追加");
    await this.wait(850);
  }

  private async akasupiDevelopment(plan: SpinPlan): Promise<void> {
    const stages = plan.akasupiStages;
    if (!stages.length) return;
    this.sound.play("reach");
    this.ui.cue("REACH", "テンパイ！", "アカスピ 関東1次審査へ", "通過すれば次の審査へ発展");
    await this.wait(700);
    this.ui.stopRolling();
    this.ui.setReachDevelopment(plan.akasupiDisplayStages);

    for (const [index, stage] of stages.entries()) {
      this.ui.setVisualType(stage.animationType);
      this.ui.setReachStep(index, "judging");
      this.ui.cue("アカスピ発展 " + (index + 1) + " / 4", stage.name + "！",
        "審査中…… NewToneの歌声は届くか", "通過すれば次のステージへ");
      await this.wait(stage.expectedLevel === 4 ? 1600 : 1150);

      const next = stages[index + 1];
      if (next) {
        this.ui.setReachStep(index, "passed");
        this.sound.play("reach");
        this.ui.cue(stage.verdictName + " 審査結果", "通過！",
          "次は " + next.verdictName + " へ発展", "期待度アップ");
        await this.wait(850);
        continue;
      }

      if (stage.id === "national-final") await this.pushPrompt(2200);

      if (plan.akasupiVerdict === "act") {
        this.sound.stop();
        this.ui.setReachStep(index, "act");
        this.ui.cue(stage.verdictName + " 審査結果",
          stage.id === "national-final" ? "全国決勝 審査中ACT" : "審査中ACT",
          stage.id === "national-final" ? "全国まで来てACTかい……" : "関東最終行ったけどACTかい……",
          "実質ハズレ");
        this.ui.setMuted(true);
        await this.wait(1550);
      } else if (plan.akasupiVerdict === "champion") {
        this.ui.setReachStep(index, "champion");
        this.sound.play("jackpot");
        this.ui.cue("全国決勝 審査結果", "優勝！",
          "NewToneの最後の一音が全国に響いた", "大当たり濃厚");
        await this.wait(1550);
      } else {
        this.ui.setReachStep(index, "failed");
        this.ui.cue(stage.verdictName + " 審査結果",
          stage.id === "national-final" ? "優勝ならず……" : "通過ならず……",
          stage.id === "national-final" ? "全国決勝まで届いた。でも最後の一音は……"
            : stage.verdictName + "で惜しくも敗退",
          "審査終了");
        await this.wait(1300);
      }
    }
    this.ui.setReachDevelopment(null);
  }

  private async resolveNormalResult(spin: Spin, plan: SpinPlan, missTag: string): Promise<void> {
    if (plan.mirrorRevival) {
      this.ui.stopRolling([7, 6, 7]);
      this.ui.cue("ハズレ……？", "音が途切れた", "鏡に映る 7・6・7", "");
      await this.wait(900);
      this.ui.setBlackout(true);
      await this.wait(450);
      this.sound.play("mirror");
      this.ui.showCrack("mirror");
      this.ui.setBlackout(false);
      this.ui.cue("復活大当たり", "鏡割れ！", "奥から響く 777", "最後の一音はまだ終わらない");
      this.ui.stopRolling([7, 7, 7], true);
      await this.wait(1700);
    } else if (spin.win) {
      this.ui.stopRolling(spin.digits, true);
      this.ui.cue(plan.route === "campus" ? plan.stage.name + " 大当たり" : "大当たり",
        plan.audition ? "通過！" : spin.digits[0] === 7 ? "7・7・7！" : "響いた！",
        plan.audition ? plan.audition.rank + "位でオーディション通過" : "アカペラの一音が揃った",
        "1500発");
      await this.wait(1250);
    } else {
      this.ui.stopRolling(plan.finalDigits);
      if (!plan.act) this.ui.cue(missTag, plan.audition ? "不通過" : "惜しい！",
        plan.audition ? plan.audition.rank + "位 / 通過枠 " + plan.audition.passingSlots + "曲" : "次の一音に期待",
        "液晶タップで保留を追加");
      await this.wait(plan.act ? 650 : 450);
    }
  }

  private async highSpeedSpin(spin: Spin, plan: SpinPlan): Promise<void> {
    this.ui.setStage("RUSH HIGH SPEED");
    this.ui.setVisualType("speed");
    this.ui.cue("ST " + spin.rushSpin + "回転", "高速ゾーン", "違和感を見逃すな", "即当たり中心");
    this.ui.startRolling();
    await this.wait(420);
    if (spin.win) {
      if (plan.rushGimmick === "blackout") {
        this.ui.setBlackout(true);
        await this.wait(310);
        this.ui.setBlackout(false);
      } else if (plan.rushGimmick === "push") {
        await this.pushPrompt(1300);
      } else if (plan.rushGimmick === "odd") {
        this.ui.cue("違和感", "音が消えた……", "一発告知！", "");
        await this.wait(350);
      }
      this.sound.play("jackpot");
      this.ui.stopRolling([7, 7, 7], true);
      this.ui.cue("即当たり", "突然 777！", "ST120回を再セット", "+1500発");
      await this.wait(950);
    } else {
      this.ui.stopRolling(plan.finalDigits);
      this.ui.cue("高速変動", "次へ", "残り " + (120 - (spin.rushSpin ?? 0)) + "回", "保留は自動消化");
      await this.wait(480);
    }
  }

  private async rushSpin(spin: Spin, plan: SpinPlan): Promise<void> {
    const last = spin.modeAtStart === "RUSH_LAST";
    this.ui.setStage(last ? "アンコール" : "RUSH MAIN");
    this.ui.setVisualType(last ? "encore" : "rush");
    this.ui.cue(last ? "ENCORE" : "RUSH MAIN",
      last ? "残り " + (121 - (spin.rushSpin ?? 101)) + "回転" : "ハーモニーをつなげ",
      last ? "もう一度、最後の一音を" : "先読みからテンパイへ", last ? "テンパイすれば大チャンス" : "ST中の当たり確率 1/73");
    this.ui.startRolling();
    await this.wait(last ? 650 : 820);
    if (plan.lastSpinFinale) {
      this.ui.cue("LAST 120", "最後の一音", "アンコールの幕が降りる、その前に", "ST最終変動");
      await this.wait(1500);
    }
    await this.stopOuterReels(plan.finalDigits);
    if (plan.rushReach) {
      this.sound.play("reach");
      this.ui.cue("テンパイ", last ? "アンコールリーチ！" : "ハーモニーリーチ！",
        last ? "ラストゾーンのテンパイは高期待" : "重なる声、届くか", "PUSHへ");
      await this.wait(1150);
      if (!last) {
        this.ui.cue("RUSH SP", "最後の一音 SP", "声を重ねて、ステージをつなげ", "PUSHで決着");
        await this.wait(850);
      }
      if (!last || spin.win) await this.pushPrompt();
    }
    if (spin.win) {
      this.sound.play("jackpot");
      this.ui.stopRolling(spin.digits, true);
      this.ui.cue("RUSH大当たり", "響いた！", "ST120回を再セット", "+1500発");
      await this.wait(1250);
    } else {
      this.ui.stopRolling(plan.finalDigits);
      this.ui.cue(last ? "アンコール" : "RUSH", plan.lastSpinFinale ? "終演" : "まだ続く",
        plan.lastSpinFinale ? "ST120回を消化。通常へ" : "残り " + (120 - (spin.rushSpin ?? 0)) + "回", "");
      await this.wait(plan.lastSpinFinale ? 1650 : 500);
    }
  }

  async showJackpot(spin: Spin): Promise<void> {
    this.ui.setTelopFocus(false);
    this.ui.setStage("NEW TONE BONUS");
    this.sound.play("jackpot");
    this.ui.stopRolling(this.bonusDigits ?? spin.digits, true);
    this.bonusDigits = null;
    this.ui.cue("NEW TONE BONUS", "1500発！",
      spin.rushEntry ? "RUSH突入！ ST120回のアンコール" : "通常時へ。次の一音を待て",
      spin.rushEntry ? "60% RUSH 突入" : "40% 通常へ");
    await this.wait(2200);
    this.engine.completeJackpot();
  }
}
