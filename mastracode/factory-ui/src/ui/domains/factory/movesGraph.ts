import {
  movesGraph as layoutMovesGraph,
  phaseOf,
  phaseLabel,
  boardPhaseIconKind,
} from '@mastra/playground-ui/domains/factory';
import type { MovesGraphPhase } from '@mastra/playground-ui/domains/factory';

import type { InstalledBoardInfo } from '../../../api/types';
import type { WorkItemStageEntry } from '@internal/factory-contract';

/**
 * The board's phases as the shared graph reads them, then any stage the card visited that the board no
 * longer has, in visit order, so it keeps its readable name and still sorts after the board's own.
 */
export function movesGraphPhases(
  history: readonly WorkItemStageEntry[],
  board: InstalledBoardInfo | undefined,
): MovesGraphPhase[] {
  const onBoard = new Set(board?.phases.map(phase => phase.id));
  const stages = [
    ...(board?.phases.map(phase => phase.id) ?? []),
    ...new Set(history.map(entry => entry.stage).filter(stage => !onBoard.has(stage))),
  ];
  return stages.map(stage => ({
    id: stage,
    name: phaseLabel(board, stage),
    kind: boardPhaseIconKind(board, stage),
    working: phaseOf(board, stage)?.kind === 'working',
  }));
}

export function movesGraph(history: readonly WorkItemStageEntry[], board: InstalledBoardInfo | undefined, now: number) {
  return layoutMovesGraph(history, movesGraphPhases(history, board), now);
}
