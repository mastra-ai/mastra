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
 * reauth notice, and pagination. Only one feed is browsed at a time, so only
 * its states render.
 */
export function IntakeColumnExtras({ source, feed }: { source?: IntakeSource; feed?: IntakeFeed }) {
  const { baseUrl } = useApiConfig();
  if (source === undefined || !feed) return null;

  if (feed.error) {
    const expired = source === 'linear' && isLinearReauthError(feed.error);
    return (
      <div className="flex flex-col items-start gap-2 p-1">
        <Txt as="p" role="alert" variant="ui-xs" className="text-notice-destructive-fg m-0">
          {expired ? 'Linear authorization expired. Reconnect to keep syncing issues.' : feed.error.message}
        </Txt>
        {expired ? (
          <Button size="xs" onClick={() => connectLinear(baseUrl)}>
            Connect Linear
          </Button>
        ) : (
          <Button size="xs" onClick={() => void feed.refetch()}>
            Retry
          </Button>
        )}
      </div>
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
