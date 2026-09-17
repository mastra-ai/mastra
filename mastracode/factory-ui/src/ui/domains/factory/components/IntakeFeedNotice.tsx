import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useApiConfig } from '../../../../api/config';
import type { IntakeFeed, IntakeSource } from '../boardCandidates';
import { connectLinear, isLinearReauthError } from '../services/linear';

/**
 * Why a column has no candidates when its feed failed. Without it the column
 * falls back to its empty state and reads as an empty backlog.
 */
export function IntakeFeedNotice({ source, feed }: { source?: IntakeSource; feed: IntakeFeed }) {
  const { baseUrl } = useApiConfig();
  if (!feed.error) return null;

  return source === 'linear' && isLinearReauthError(feed.error) ? (
    <LinearReauthNotice onConnect={() => connectLinear(baseUrl)} />
  ) : (
    // A page that failed is not stored, so only fetchNextPage requests it again.
    <FeedFailureNotice
      message={feed.error.message}
      onRetry={() => void (feed.isFetchNextPageError ? feed.fetchNextPage() : feed.refetch())}
    />
  );
}

function LinearReauthNotice({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 p-1">
      <Txt as="span" variant="ui-xs" className="text-icon3">
        Linear authorization expired. Reconnect to keep syncing issues.
      </Txt>
      <Button size="xs" onClick={onConnect}>
        Connect Linear
      </Button>
    </div>
  );
}

function FeedFailureNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 p-1">
      <Txt as="p" role="alert" variant="ui-xs" className="text-notice-destructive-fg m-0">
        {message}
      </Txt>
      <Button size="xs" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
