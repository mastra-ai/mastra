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
  layout,
  kind,
  loading,
  taskCount,
  feed,
  intakeSource,
  filtersExcludeAll,
  alreadyMaterialized,
  composer,
  children,
}: {
  stage: { id: BoardStageId; label: string };
  layout: BoardLayout;
  kind: BoardKind;
  loading: boolean;
  taskCount: number;
  feed?: IntakeFeed;
  intakeSource?: IntakeSource;
  filtersExcludeAll: boolean;
  alreadyMaterialized: number;
  composer?: ReactNode;
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
          kind={kind}
          hasIntakeSource={intakeSource !== undefined}
          filtersExcludeAll={filtersExcludeAll}
          alreadyMaterialized={alreadyMaterialized}
          layout={layout}
        />
      )}
      {feed && <IntakeFeedNotice source={intakeSource} feed={feed} />}
      {feed && <IntakeColumnExtras feed={feed} currentColumnLength={taskCount} layout={layout} />}
    </>
  );
}
