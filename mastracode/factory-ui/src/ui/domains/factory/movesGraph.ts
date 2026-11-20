import type { InstalledBoardInfo } from '../../../api/types';
import { phaseOf } from './boardFlow';
import { stageStays } from './stageStays';
import type { StageStay } from './stageStays';
import type { WorkItemStageEntry } from './services/workItems';

interface GraphStay extends StageStay {
  lane: number;
  working: boolean;
  start: number;
  width: number;
}

interface MovesGraphLayout {
  lanes: string[];
  stays: GraphStay[];
}

export function movesGraph(
  history: readonly WorkItemStageEntry[],
  board: InstalledBoardInfo | undefined,
  now: number,
): MovesGraphLayout {
  const visited = [...new Set(history.map(entry => entry.stage))];
  const phaseCount = board?.phases.length ?? 0;
  const order = (stage: string) => {
    const index = board?.phases.findIndex(phase => phase.id === stage) ?? -1;
    return index === -1 ? phaseCount + visited.indexOf(stage) : index;
  };
  const lanes = visited.toSorted((a, b) => order(a) - order(b));

  const stays = stageStays(history, now);
  const start = stays[0]?.from ?? now;
  const length = Math.max(0, ...stays.map(stay => stay.to - start));

  return {
    lanes,
    stays: stays.map((stay, index) => {
      const working = phaseOf(board, stay.entry.stage)?.kind === 'working';
      const lane = lanes.indexOf(stay.entry.stage);
      return length > 0
        ? { ...stay, lane, working, start: (stay.from - start) / length, width: (stay.to - stay.from) / length }
        : { ...stay, lane, working, start: index / stays.length, width: 1 / stays.length };
    }),
  };
}
