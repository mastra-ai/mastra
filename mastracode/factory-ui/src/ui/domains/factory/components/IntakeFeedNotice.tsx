import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { IntakeFeed, IntakeSource } from '../boardCandidates';
import { BOARD_SOURCE_OPTIONS } from '../boardSourceFilters';

/**
 * Why a column has no candidates when its feed failed. Without it the column
 * falls back to its empty state and reads as an empty backlog.
 */
export function IntakeFeedNotice({ source, feed }: { source?: IntakeSource; feed: IntakeFeed }) {
  if (!feed.error) return null;
  const label = BOARD_SOURCE_OPTIONS.find(option => option.value === source?.split('-')[0])?.label;

  // A page that failed is not stored, so only fetchNextPage requests it again.
  const retry = () =>
    void (feed.retryFailed ? feed.retryFailed() : feed.isFetchNextPageError ? feed.fetchNextPage() : feed.refetch());

  return (
    <div className="flex flex-col items-start gap-2 p-1">
      <Txt as="p" role="alert" variant="meta" className="text-destructive-foreground m-0">
        {label ? `${label}: ${feed.error.message}` : feed.error.message}
      </Txt>
      <Button size="sm" onClick={retry}>
        Retry
      </Button>
    </div>
  );
}
