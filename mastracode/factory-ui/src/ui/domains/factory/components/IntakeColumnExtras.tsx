import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useApiConfig } from '../../../../api/config';
import type { IntakeSource } from '../boardCandidates';
import { connectLinear, isLinearReauthError } from '../services/linear';
import { LoadMoreSentinel } from './LoadMoreSentinel';

/** What the column tail needs from whichever candidate query is active. */
export interface IntakeFeed {
  error: Error | null;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage: () => unknown;
  refetch: () => unknown;
}

/**
 * Intake column tail for the ACTIVE candidate feed: failure notice, Linear
 * reauth notice, or pagination. Only one feed is browsed at a time, so only
 * its states render.
 */
export function IntakeColumnExtras({ source, feed }: { source?: IntakeSource; feed?: IntakeFeed }) {
  const { baseUrl } = useApiConfig();
  if (source === undefined || !feed) return null;

  if (feed.error) {
    return source === 'linear' && isLinearReauthError(feed.error) ? (
      <LinearReauthNotice onConnect={() => connectLinear(baseUrl)} />
    ) : (
      <FeedFailureNotice message={feed.error.message} onRetry={() => void feed.refetch()} />
    );
  }

  return (
    <LoadMoreSentinel
      hasNextPage={Boolean(feed.hasNextPage)}
      isFetchingNextPage={Boolean(feed.isFetchingNextPage)}
      onLoadMore={() => void feed.fetchNextPage()}
      label="Load more candidates"
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
