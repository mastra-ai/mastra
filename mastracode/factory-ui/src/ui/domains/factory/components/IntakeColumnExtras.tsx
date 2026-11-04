import type { IntakeFeed } from '../boardCandidates';
import type { BoardLayout } from '../boardLayout';
import { BoardItemsSkeleton } from './BoardItemsSkeleton';
import { LoadMoreSentinel } from './LoadMoreSentinel';

/**
 * Pagination for healthy candidate feeds. A failed single feed renders nothing;
 * combined feeds can still page their healthy providers without retrying errors.
 */
export function IntakeColumnExtras({
  feed,
  currentColumnLength,
  layout,
}: {
  feed?: IntakeFeed;
  currentColumnLength: number;
  layout: BoardLayout;
}) {
  if (!feed || (feed.error && !feed.retryFailed)) return null;

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
