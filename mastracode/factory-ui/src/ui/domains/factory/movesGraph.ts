import type { InstalledBoardInfo } from '../../../api/types';
import { phaseOf } from './boardFlow';
import { stageStays } from './stageStays';
import type { StageStay } from './stageStays';
import type { WorkItemStageEntry } from './services/workItems';

export interface GraphStay extends StageStay {
  /** The row of the stay's phase, counted from the top. */
  lane: number;
  /** Only a phase the board names as working: an unknown phase never reads as Factory at work. */
  working: boolean;
  /** Where the stay starts on the axis and how much of it the stay covers, both as shares of the axis. */
  start: number;
  width: number;
}

export interface MovesGraphLayout {
  /** The phases the card has been in, in board order, one lane each. */
  lanes: string[];
  /** Every stay, oldest first. A card can sit in several phases at once, so stays can overlap. */
  stays: GraphStay[];
}

export function movesGraph(
  history: readonly WorkItemStageEntry[],
  board: InstalledBoardInfo | undefined,
  now: number,
): MovesGraphLayout {
  const visited = [...new Set(history.map(entry => entry.stage))];
  const phaseCount = board?.phases.length ?? 0;
  // Phases off the board, from an older board, follow the board's own in the order the card met them.
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
      // Stays that all start and end at one moment share the axis evenly, so each still shows.
      return length > 0
        ? { ...stay, lane, working, start: (stay.from - start) / length, width: (stay.to - stay.from) / length }
        : { ...stay, lane, working, start: index / stays.length, width: 1 / stays.length };
    }),
  };
}
