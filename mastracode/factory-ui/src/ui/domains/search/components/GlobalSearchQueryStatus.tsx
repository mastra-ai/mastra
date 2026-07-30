import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { RefreshCw } from 'lucide-react';

function repositoryFailureMessage(allRepositoriesFailed: boolean): string {
  if (allRepositoriesFailed) return 'Sessions could not be loaded from any linked repository.';
  return 'Some linked repositories could not be searched.';
}

export function GlobalSearchQueryStatus({
  pending,
  failedCount,
  allRepositoriesFailed,
  workItemsFailed,
  retryRepositories,
  retryWorkItems,
}: {
  pending: boolean;
  failedCount: number;
  allRepositoriesFailed: boolean;
  workItemsFailed: boolean;
  retryRepositories: () => void;
  retryWorkItems: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {pending && (
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
      )}
      {failedCount > 0 && (
        <Notice
          variant={allRepositoriesFailed ? 'destructive' : 'warning'}
          action={
            <Notice.Button onClick={retryRepositories}>
              Retry <RefreshCw />
            </Notice.Button>
          }
        >
          {repositoryFailureMessage(allRepositoriesFailed)}
        </Notice>
      )}
      {workItemsFailed && (
        <Notice
          variant="warning"
          action={
            <Notice.Button onClick={retryWorkItems}>
              Retry <RefreshCw />
            </Notice.Button>
          }
        >
          Session titles could not be loaded. Branch-based results are still available.
        </Notice>
      )}
    </div>
  );
}
