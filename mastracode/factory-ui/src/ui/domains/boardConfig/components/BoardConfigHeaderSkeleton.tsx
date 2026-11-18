import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

import type { InstalledBoardInfo } from '../../../../api/types';
import { BoardStageIcon, phaseIconKind } from '../../factory/components/BoardIcons';
import { ConfigHeaderLayout, KindBadge } from './BoardConfigHeader';
import { BoardDeleteButton } from './BoardDeleteButton';
import { BoardResetButton } from './BoardResetButton';
import { InlineText } from './InlineText';

const BAR = 'motion-reduce:before:animate-none';

export function BoardConfigHeaderSkeleton({
  boardId,
  phaseKey,
  board,
}: {
  boardId: string;
  phaseKey: string | undefined;
  board: InstalledBoardInfo | undefined;
}) {
  const phase = phaseKey ? board?.phases.find(candidate => candidate.id === phaseKey) : undefined;
  const known = phaseKey ? phase : board;
  const boardName = board?.name ?? board?.title ?? '';

  return (
    <div role="status" aria-label={phaseKey ? 'Loading phase name' : 'Loading board name'} inert>
      <ConfigHeaderLayout
        icon={
          phaseKey &&
          (phase ? (
            <BoardStageIcon stage={phase.id} kind={phaseIconKind(boardId, phase.kind)} decorative />
          ) : (
            <Skeleton className={cn('size-4 shrink-0 rounded-full', BAR)} />
          ))
        }
        title={
          known ? (
            (known.name ?? known.title)
          ) : (
            <SkeletonText line="text-heading" className={cn(phaseKey ? 'w-18' : 'w-40', BAR)} />
          )
        }
        meta={
          phaseKey &&
          (phase ? <KindBadge kind={phase.kind} /> : <Skeleton className={cn('h-5 w-16 rounded-full', BAR)} />)
        }
        description={
          known ? (
            <InlineText
              value={known.description ?? ''}
              label={phaseKey ? 'Phase description' : 'Board description'}
              placeholder="Add a description"
              multiline
              readOnly={false}
              variant="caption"
              tone="muted"
              className="zoom-safe-text w-full"
              onChange={() => undefined}
            />
          ) : (
            <SkeletonText line="text-caption" className={cn('w-72 max-w-full', BAR)} />
          )
        }
        actions={
          !phaseKey &&
          (board ? (
            <>
              {board.source !== 'stored' && (
                <BoardResetButton name={boardName} pending={false} onReset={() => undefined} />
              )}
              {board.source !== 'builtin' && (
                <BoardDeleteButton name={boardName} pending={false} onDelete={() => undefined} />
              )}
            </>
          ) : (
            <Skeleton className={cn('h-control-sm w-20 rounded-full', BAR)} />
          ))
        }
      />
    </div>
  );
}
