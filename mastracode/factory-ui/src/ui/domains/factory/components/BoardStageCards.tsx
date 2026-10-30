import type { ReactNode } from 'react';

import type { IntakeFeed, IntakeSource } from '../boardCandidates';
import type { BoardLayout } from '../boardLayout';
import type { BoardKind } from '../boardStages';
import type { BoardStageId } from '../stages';
import { BoardColumnEmptyState } from './BoardColumnEmptyState';
import { IntakeColumnExtras } from './IntakeColumnExtras';
import { IntakeFeedNotice } from './IntakeFeedNotice';
import type { ArchiveColumn } from '../hooks/useBoardArchive';
import { BoardItemsSkeleton } from './BoardItemsSkeleton';
import { LoadMoreSentinel } from './LoadMoreSentinel';

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
  archive,
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
  /** A Done or Canceled column: its older cards load as it scrolls. */
  archive?: ArchiveColumn;
  children: ReactNode;
}) {
  const showEmptyState = !loading && !composer && taskCount === 0 && !feed?.error;
  return (
    <>
      {composer}
      {children}
      {loading && <BoardItemsSkeleton label={`Loading ${stage.label} column`} layout={layout} />}
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
      {archive && (
        <LoadMoreSentinel
          hasNextPage={archive.hasNextPage}
          isFetchingNextPage={archive.isFetchingNextPage}
          onLoadMore={archive.loadMore}
          label={`Load more ${stage.label} cards`}
          loadingIndicator={<BoardItemsSkeleton label={`Loading more ${stage.label} cards`} rows={1} layout={layout} />}
        />
      )}
    </>
  );
}
