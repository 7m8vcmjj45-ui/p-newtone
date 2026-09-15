export interface ReachData {
  id: string;
  name: string;
  progressName: string;
  verdictName: string;
  expectedLevel: number;
  lossWeight: number;
  winWeight: number;
  animationType: string;
  allowsAct: boolean;
}

export const REACHES: ReachData[] = [
  { id: "kanto-1", name: "アカスピ関東1次", progressName: "１次", verdictName: "関東1次", expectedLevel: 1, lossWeight: 58, winWeight: 1, animationType: "audition", allowsAct: false },
  { id: "kanto-2", name: "アカスピ関東2次", progressName: "２次", verdictName: "関東2次", expectedLevel: 2, lossWeight: 27, winWeight: 2, animationType: "audition", allowsAct: false },
  { id: "kanto-final", name: "アカスピ関東最終", progressName: "最終", verdictName: "関東最終", expectedLevel: 3, lossWeight: 12, winWeight: 5, animationType: "final", allowsAct: true },
  { id: "national-final", name: "アカスピ全国決勝", progressName: "全国", verdictName: "全国決勝", expectedLevel: 4, lossWeight: 3, winWeight: 92, animationType: "national", allowsAct: true }
];
