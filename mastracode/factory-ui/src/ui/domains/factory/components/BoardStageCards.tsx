import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

import type { BoardLayout } from '../boardLayout';
import type { BoardStageId } from '../stages';
import { BoardColumnEmptyState } from './BoardColumnEmptyState';
import type { IntakeSetup } from './BoardColumnEmptyState';
import { BoardItemsSkeleton } from './BoardItemsSkeleton';

export function BoardStageCards({
  stage,
  isInitialPhase,
  layout,
  loading,
  taskCount,
  intakeSetup,
  intakeFailure,
  filtersExcludeAll,
  composer,
  emptyStateActions,
  children,
}: {
  stage: { id: BoardStageId; label: string };
  isInitialPhase: boolean;
  layout: BoardLayout;
  loading: boolean;
  taskCount: number;
  intakeSetup?: IntakeSetup;
  /** Why the column cannot tell what files onto it, shown instead of its empty state. */
  intakeFailure?: { message: string; retry: () => void };
  filtersExcludeAll: boolean;
  composer?: ReactNode;
  emptyStateActions?: ReactNode;
  children: ReactNode;
}) {
  const showEmptyState = !loading && !composer && taskCount === 0 && !intakeFailure;
  return (
    <>
      {composer}
      {children}
      {loading && <BoardItemsSkeleton label={`Loading ${stage.label} column`} layout={layout} />}
      {showEmptyState && (
        <BoardColumnEmptyState
          stage={stage.id}
          isInitialPhase={isInitialPhase}
          intakeSetup={intakeSetup}
          filtersExcludeAll={filtersExcludeAll}
          layout={layout}
          actionSlot={emptyStateActions}
        />
      )}
      {intakeFailure && (
        <div className="flex flex-col items-start gap-2 p-1">
          <Txt as="p" role="alert" variant="meta" className="text-destructive-foreground m-0">
            {intakeFailure.message}
          </Txt>
          <Button size="sm" onClick={intakeFailure.retry}>
            Retry
          </Button>
        </div>
      )}
    </>
  );
}
