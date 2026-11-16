import { Txt } from '@mastra/playground-ui/components/Txt';

import type { InstalledBoardInfo } from '../../../../api/types';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { boardName, phaseName } from '../ruleTargets';

/** Where a rule moves the card: the phase, prefixed with its board when that is another board. */
export function RuleTarget({
  boards,
  ownBoard,
  boardKey,
  phaseKey,
}: {
  boards: readonly InstalledBoardInfo[];
  ownBoard: string;
  boardKey: string;
  phaseKey: string | null;
}) {
  const board = boards.find(candidate => candidate.id === boardKey);
  if (!board) {
    return (
      <Txt as="span" variant="caption" tone="muted">
        {boardKey} (not installed)
      </Txt>
    );
  }
  const key = phaseKey ?? board.initialPhase;
  const phase = board.phases.find(candidate => candidate.id === key);
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {board.id !== ownBoard && (
        <>
          <Txt as="span" variant="caption" className="truncate">
            {boardName(board)}
          </Txt>
          <Txt as="span" variant="caption" tone="muted">
            ›
          </Txt>
        </>
      )}
      {phase && <BoardStageIcon stage={phase.id} kind={phaseIconKind(board.id, phase.kind)} decorative />}
      <Txt as="span" variant="caption" className="truncate">
        {phaseName(board, key) ?? key}
      </Txt>
    </span>
  );
}
