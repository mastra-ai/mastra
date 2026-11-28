import {
  CardStageSummary as SharedCardStageSummary,
  currentItemStage,
  phaseLabel,
  boardPhaseIconKind,
} from '@mastra/playground-ui/domains/factory';

import type { InstalledBoardInfo } from '../../../../api/types';
import type { WorkItem } from '@internal/factory-contract';

export function CardStageSummary({
  item,
  board,
  note,
}: {
  item: WorkItem;
  board: InstalledBoardInfo | undefined;
  note: string;
}) {
  const stage = currentItemStage(item, board);
  if (stage === undefined) return null;
  return (
    <SharedCardStageSummary
      phase={{ id: stage, name: phaseLabel(board, stage), kind: boardPhaseIconKind(board, stage) }}
      note={note}
    />
  );
}
