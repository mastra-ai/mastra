import type { IntakeFeed } from '../boardCandidates';
import type { BoardLayout } from '../boardLayout';
import { BoardItemsSkeleton } from './BoardItemsSkeleton';
import { LoadMoreSentinel } from './LoadMoreSentinel';

/** Pagination for a healthy candidate feed. A failed feed renders nothing. */
export function IntakeColumnExtras({
  feed,
  currentColumnLength,
  layout,
}: {
  feed?: IntakeFeed;
  currentColumnLength: number;
  layout: BoardLayout;
}) {
  if (!feed || feed.error) return null;

  return (
    <LoadMoreSentinel
      hasNextPage={Boolean(feed.hasNextPage)}
      isFetchingNextPage={Boolean(feed.isFetchingNextPage)}
      onLoadMore={() => void feed.fetchNextPage()}
      label="Load more candidates"
      loadingIndicator={
        currentColumnLength > 0 ? (
          <BoardItemsSkeleton label="Loading more candidates" rows={1} layout={layout} />
        ) : (
          <span role="status" className="sr-only">
            Loading more candidates
          </span>
        )
      }
    />
  );
}
