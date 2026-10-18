import type { ReactNode } from 'react';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import type { IntakeFeed, IntakeSource } from '../boardCandidates';
import { SKELETON_ROW_CLASS } from '../boardLayout';
import type { BoardLayout } from '../boardLayout';
import type { BoardKind } from '../boardStages';
import type { BoardStageId } from '../stages';
import { BoardColumnEmptyState } from './BoardColumnEmptyState';
import { IntakeColumnExtras } from './IntakeColumnExtras';
import { IntakeFeedNotice } from './IntakeFeedNotice';

export function BoardStageCards({
  stage,
  isInitialPhase,
  layout,
  kind,
  loading,
  taskCount,
  feed,
  intakeSource,
  hasIntakeSource,
  filtersExcludeAll,
  alreadyMaterialized,
  composer,
  emptyStateActions,
  children,
}: {
  stage: { id: BoardStageId; label: string };
  isInitialPhase: boolean;
  layout: BoardLayout;
  kind: BoardKind;
  loading: boolean;
  taskCount: number;
  feed?: IntakeFeed;
  intakeSource?: IntakeSource;
  hasIntakeSource: boolean;
  filtersExcludeAll: boolean;
  alreadyMaterialized: number;
  composer?: ReactNode;
  emptyStateActions?: ReactNode;
  children: ReactNode;
}) {
  const showEmptyState = !loading && !composer && taskCount === 0 && !feed?.error;
  return (
    <>
      {composer}
      {children}
      {loading && (
        <SkeletonRows label={`Loading ${stage.label} column`} rows={3} rowClassName={SKELETON_ROW_CLASS[layout]} />
      )}
      {showEmptyState && (
        <BoardColumnEmptyState
          stage={stage.id}
          isInitialPhase={isInitialPhase}
          kind={kind}
          hasIntakeSource={hasIntakeSource}
          filtersExcludeAll={filtersExcludeAll}
          alreadyMaterialized={alreadyMaterialized}
          layout={layout}
          actionSlot={emptyStateActions}
        />
      )}
      {feed && <IntakeFeedNotice source={intakeSource} feed={feed} />}
      {feed && <IntakeColumnExtras feed={feed} currentColumnLength={taskCount} layout={layout} />}
    </>
  );
}
