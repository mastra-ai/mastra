import { Button } from '@mastra/playground-ui/components/Button';
import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { useApiConfig } from '../../../../api/config';
import type { IntakeFeed, IntakeSource } from '../boardCandidates';
import { connectLinear, isLinearReauthError } from '../services/linear';
import { isPlatformKeyRejected } from '../services/request';

/**
 * Why a column has no candidates when its feed failed. Without it the column
 * falls back to its empty state and reads as an empty backlog.
 */
export function IntakeFeedNotice({ source, feed }: { source?: IntakeSource; feed: IntakeFeed }) {
  const { baseUrl } = useApiConfig();
  if (!feed.error || isPlatformKeyRejected(feed.error)) return null;

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

export function PlatformKeyRejectedNotice() {
  return (
    <Notice variant="destructive" title="Mastra Platform key rejected">
      <Notice.Message>
        This Factory server's Platform key is invalid or revoked, so the board can't load issues or pull requests.
        Whoever runs the server needs to set a valid <InlineCode>MASTRA_PLATFORM_SECRET_KEY</InlineCode> (or{' '}
        <InlineCode>MASTRA_PLATFORM_ACCESS_TOKEN</InlineCode>) and restart it. The board reloads on its own after.
      </Notice.Message>
    </Notice>
  );
}

function LinearReauthNotice({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 p-1">
      <Txt as="span" variant="meta" className="text-muted-foreground">
        Linear authorization expired. Reconnect to keep syncing issues.
      </Txt>
      <Button size="sm" onClick={onConnect}>
        Connect Linear
      </Button>
    </div>
  );
}

function FeedFailureNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-2 p-1">
      <Txt as="p" role="alert" variant="meta" className="text-destructive-indicator m-0">
        {message}
      </Txt>
      <Button size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
