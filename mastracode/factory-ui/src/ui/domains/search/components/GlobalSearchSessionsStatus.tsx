import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RefreshCw } from 'lucide-react';

function repositoryFailureMessage(allFailed: boolean): string {
  if (allFailed) return 'Sessions could not be loaded from any linked repository.';
  return 'Some linked repositories could not be searched.';
}

function LoadingSessionsRow() {
  return (
    <div role="status" aria-label="Loading sessions" className="flex items-center gap-3 py-2">
      <Skeleton className="size-8 shrink-0" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-2.5 w-64 max-w-full" />
      </div>
      <Txt as="span" variant="ui-xs" className="sr-only">
        Loading sessions
      </Txt>
    </div>
  );
}

export function GlobalSearchSessionsStatus({
  pending,
  failedCount,
  allFailed,
  onRetry,
}: {
  pending: boolean;
  failedCount: number;
  allFailed: boolean;
  onRetry: () => void;
}) {
  if (!pending && failedCount === 0) return null;

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {pending && <LoadingSessionsRow />}
      {failedCount > 0 && (
        <Notice
          variant={allFailed ? 'destructive' : 'warning'}
          action={
            <Notice.Button onClick={onRetry}>
              Retry <RefreshCw />
            </Notice.Button>
          }
        >
          {repositoryFailureMessage(allFailed)}
        </Notice>
      )}
    </div>
  );
}
