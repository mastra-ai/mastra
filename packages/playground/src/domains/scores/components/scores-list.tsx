import type { ClientScoreRowData } from '@mastra/client-js';
import { EntityList, Txt, cn } from '@mastra/playground-ui';
import { format, isToday } from 'date-fns';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';

const gridColumns = '4.5rem 6.5rem 1fr 10rem 3rem';

type ScoresListProps = {
  selectedScoreId?: string;
  onScoreClick?: (id: string) => void;
  scores?: ClientScoreRowData[];
  pagination?: {
    total: number;
    hasMore: boolean;
    perPage: number;
    page: number;
  };
  onPageChange?: (page: number) => void;
  errorMsg?: string;
};

export function ScoresList({
  scores,
  pagination,
  onScoreClick,
  onPageChange,
  errorMsg,
  selectedScoreId,
}: ScoresListProps) {
  if (!scores) {
    return null;
  }

  const scoresHasMore = pagination?.hasMore;

  const handleNextPage = () => {
    if (scoresHasMore) {
      onPageChange?.(pagination.page + 1);
    }
  };

  const handlePrevPage = () => {
    if (pagination?.page && pagination.page > 0) {
      onPageChange?.(pagination.page - 1);
    }
  };

  if (errorMsg) {
    return (
      <EntityList columns={gridColumns}>
        <EntityList.Top>
          <EntityList.TopCell>Date</EntityList.TopCell>
          <EntityList.TopCell>Time</EntityList.TopCell>
          <EntityList.TopCell>Input</EntityList.TopCell>
          <EntityList.TopCell>Entity</EntityList.TopCell>
          <EntityList.TopCell>Score</EntityList.TopCell>
        </EntityList.Top>
        <EntityList.NoMatch message={errorMsg} />
      </EntityList>
    );
  }

  if (scores.length === 0) {
    return (
      <EntityList columns={gridColumns}>
        <EntityList.Top>
          <EntityList.TopCell>Date</EntityList.TopCell>
          <EntityList.TopCell>Time</EntityList.TopCell>
          <EntityList.TopCell>Input</EntityList.TopCell>
          <EntityList.TopCell>Entity</EntityList.TopCell>
          <EntityList.TopCell>Score</EntityList.TopCell>
        </EntityList.Top>
        <EntityList.NoMatch message="No scores for this scorer yet" />
      </EntityList>
    );
  }

  return (
    <div className="grid gap-4">
      <EntityList columns={gridColumns}>
        <EntityList.Top>
          <EntityList.TopCell>Date</EntityList.TopCell>
          <EntityList.TopCell>Time</EntityList.TopCell>
          <EntityList.TopCell>Input</EntityList.TopCell>
          <EntityList.TopCell>Entity</EntityList.TopCell>
          <EntityList.TopCell>Score</EntityList.TopCell>
        </EntityList.Top>

        <EntityList.Rows>
          {scores.map(score => {
            const createdAtDate = new Date(score.createdAt);
            const isTodayDate = isToday(createdAtDate);

            return (
              <EntityList.Row
                key={score.id}
                onClick={onScoreClick ? () => onScoreClick(score.id) : undefined}
                selected={selectedScoreId === score.id}
              >
                <EntityList.TextCell>{isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd')}</EntityList.TextCell>
                <EntityList.TextCell>{format(createdAtDate, 'h:mm:ss aaa')}</EntityList.TextCell>
                <EntityList.TextCell>
                  <span className="truncate block">{JSON.stringify(score?.input)}</span>
                </EntityList.TextCell>
                <EntityList.TextCell>
                  <span className="truncate block">{score.entityId}</span>
                </EntityList.TextCell>
                <EntityList.TextCell>
                  <span className="font-mono">{score.score}</span>
                </EntityList.TextCell>
              </EntityList.Row>
            );
          })}
        </EntityList.Rows>
      </EntityList>

      <ScoresListPagination
        currentPage={pagination?.page || 0}
        hasMore={scoresHasMore}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
      />
    </div>
  );
}

function ScoresListPagination({
  currentPage,
  hasMore,
  onNextPage,
  onPrevPage,
}: {
  currentPage?: number;
  hasMore?: boolean;
  onNextPage?: () => void;
  onPrevPage?: () => void;
}) {
  const showNavigation = (typeof currentPage === 'number' && currentPage > 0) || hasMore;

  if (!showNavigation) return null;

  return (
    <div className={cn('flex pt-2 items-center justify-center text-neutral3 text-ui-md gap-8')}>
      <Txt variant="ui-md">
        Page <b>{currentPage ? currentPage + 1 : '1'}</b>
      </Txt>
      <div
        className={cn(
          'flex gap-4',
          '[&>button]:flex [&>button]:items-center [&>button]:gap-2 [&>button]:text-neutral4 [&>button:hover]:text-neutral5 [&>button]:transition-colors [&>button]:border [&>button]:border-border1 [&>button]:p-1 [&>button]:px-2 [&>button]:rounded-md',
          '[&_svg]:w-[1em] [&_svg]:h-[1em] [&_svg]:text-neutral3',
        )}
      >
        {typeof currentPage === 'number' && currentPage > 0 && (
          <button onClick={onPrevPage}>
            <ArrowLeftIcon />
            Previous
          </button>
        )}
        {hasMore && (
          <button onClick={onNextPage}>
            Next
            <ArrowRightIcon />
          </button>
        )}
      </div>
    </div>
  );
}
