import type { IntakeFeed } from '../boardCandidates';
import { SkeletonRows } from '../../../ui/SkeletonRows';
import { LoadMoreSentinel } from './LoadMoreSentinel';

/**
 * Pagination for the browsed candidate feed. A failed feed renders nothing: the
 * sentinel auto-loads when it scrolls into view, which would retry forever.
 */
export function IntakeColumnExtras({ feed, currentColumnLength }: { feed?: IntakeFeed; currentColumnLength: number }) {
  if (!feed || feed.error) return null;

  return (
    <LoadMoreSentinel
      hasNextPage={Boolean(feed.hasNextPage)}
      isFetchingNextPage={Boolean(feed.isFetchingNextPage)}
      onLoadMore={() => void feed.fetchNextPage()}
      label="Load more candidates"
      loadingIndicator={
        currentColumnLength > 0 ? (
          <SkeletonRows label="Loading more candidates" rows={1} rowClassName="h-24 w-full" />
        ) : (
          <span role="status" className="sr-only">
            Loading more candidates
          </span>
        )
      }
    />
  );
}
