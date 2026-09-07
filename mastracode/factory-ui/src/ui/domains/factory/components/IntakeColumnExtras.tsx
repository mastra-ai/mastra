import type { IntakeFeed } from '../boardCandidates';
import { LoadMoreSentinel } from './LoadMoreSentinel';

/**
 * Pagination for the browsed candidate feed. A failed feed renders nothing: the
 * sentinel auto-loads when it scrolls into view, which would retry forever.
 * Board filters only see the loaded pages, so a filtered column keeps the
 * sentinel in view and would walk the whole repository: it pages on click.
 */
export function IntakeColumnExtras({ feed, filtersActive }: { feed?: IntakeFeed; filtersActive: boolean }) {
  if (!feed || feed.error) return null;

  return (
    <LoadMoreSentinel
      hasNextPage={Boolean(feed.hasNextPage)}
      isFetchingNextPage={Boolean(feed.isFetchingNextPage)}
      onLoadMore={() => void feed.fetchNextPage()}
      autoLoad={!filtersActive}
      label="Load more candidates"
    />
  );
}
