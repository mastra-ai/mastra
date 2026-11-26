import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';

function LoadingSessionsRow() {
  return (
    <div role="status" aria-label="Loading sessions" className="flex items-start gap-3 px-2.25 py-1.75">
      <Skeleton className="mt-0.5 size-4 shrink-0 motion-reduce:before:animate-none" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <SkeletonText line="text-label" className="h-3 w-40 max-w-full motion-reduce:before:animate-none" />
        <SkeletonText line="text-meta" className="h-2.5 w-64 max-w-full motion-reduce:before:animate-none" />
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
    <>
      {pending && <LoadingSessionsRow />}
      {failed && (
        <div className="px-3 py-2">
          <Notice
            variant="destructive"
            action={
              <Notice.Button onClick={onRetry}>
                Retry <IconArrowRotateClockwise />
              </Notice.Button>
            }
          >
            Sessions could not be loaded.
          </Notice>
        </div>
      )}
    </>
  );
}
