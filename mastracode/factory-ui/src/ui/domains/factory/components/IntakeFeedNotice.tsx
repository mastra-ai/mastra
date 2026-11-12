import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { IntakeFeed, IntakeSource } from '../boardCandidates';
import { BOARD_SOURCE_OPTIONS } from '../boardSourceFilters';

/**
 * Why a column has no candidates when its feed failed, or why the ones it shows may be behind.
 * Without it the column falls back to its empty state and reads as an empty backlog.
 */
export function IntakeFeedNotice({ source, feed }: { source?: IntakeSource; feed: IntakeFeed }) {
  const label = BOARD_SOURCE_OPTIONS.find(option => option.value === source?.split('-')[0])?.label;
  if (!feed.error) {
    // Nothing to retry from here: the server reads the source again on its own.
    return feed.stale ? (
      <Txt as="p" variant="meta" tone="muted" className="m-0 p-1">
        {label ?? 'A source'} could not be read. This list may be out of date.
      </Txt>
    ) : null;
  }

  return (
    // A page that failed is not stored, so only fetchNextPage requests it again.
    <FeedFailureNotice
      message={label ? `${label}: ${feed.error.message}` : feed.error.message}
      onRetry={() => void (feed.isFetchNextPageError ? feed.fetchNextPage() : feed.refetch())}
    />
  );
}

function FeedFailureNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 p-1">
      <Txt as="p" role="alert" variant="meta" className="text-destructive-foreground m-0">
        {message}
      </Txt>
      <Button size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
