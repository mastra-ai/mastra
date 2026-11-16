import { Txt } from '@mastra/playground-ui/components/Txt';

import type { InstalledBoardInfo } from '../../../../api/types';
import { headerCapsuleClass } from '../../chat/components/chatPageHeader';
import { currentItemStage, phaseLabel } from '../boardStages';
import type { WorkItem } from '../services/workItems';
import { BoardStageIcon, boardPhaseIconKind } from './BoardIcons';

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
    <div role="group" aria-label="Card stage" className={headerCapsuleClass}>
      <span className="flex min-w-0 items-center gap-1.5 px-2 py-1">
        <BoardStageIcon stage={stage} kind={boardPhaseIconKind(board, stage)} decorative />
        <Txt as="span" variant="label" className="truncate">
          {phaseLabel(board, stage)}
        </Txt>
        <Txt as="span" variant="meta" tone="muted" className="truncate">
          {note}
        </Txt>
      </span>
    </div>
  );
}
