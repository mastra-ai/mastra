import type { IntakeFeed } from '../boardCandidates';
import { LoadMoreSentinel } from './LoadMoreSentinel';

/**
 * Pagination for the browsed candidate feed. A failed feed renders nothing: the
 * sentinel auto-loads when it scrolls into view, which would retry forever.
 */
export function IntakeColumnExtras({ feed }: { feed?: IntakeFeed }) {
  if (!feed || feed.error) return null;

  return (
    <LoadMoreSentinel
      hasNextPage={Boolean(feed.hasNextPage)}
      isFetchingNextPage={Boolean(feed.isFetchingNextPage)}
      onLoadMore={() => void feed.fetchNextPage()}
      label="Load more candidates"
    />
  );
}
