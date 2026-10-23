import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RefreshCw } from 'lucide-react';

function LoadingSessionsRow() {
  return (
    <div role="status" aria-label="Loading sessions" className="flex items-center gap-3 py-2">
      <Skeleton className="size-8 shrink-0" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-2.5 w-64 max-w-full" />
      </div>
      <Txt as="span" variant="meta" className="sr-only">
        Loading sessions
      </Txt>
    </div>
  );
}

export function GlobalSearchSessionsStatus({
  pending,
  failed,
  onRetry,
}: {
  pending: boolean;
  failed: boolean;
  onRetry: () => void;
}) {
  if (!pending && !failed) return null;

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {pending && <LoadingSessionsRow />}
      {failed && (
        <Notice
          variant="destructive"
          action={
            <Notice.Button onClick={onRetry}>
              Retry <RefreshCw />
            </Notice.Button>
          }
        >
          Sessions could not be loaded.
        </Notice>
      )}
    </div>
  );
}
