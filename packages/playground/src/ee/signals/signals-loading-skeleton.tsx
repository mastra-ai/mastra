import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

export function SignalsLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading signal analysis"
      className="flex h-full min-h-0 flex-col gap-6 overflow-hidden p-6"
    >
      <span className="sr-only">Loading signal analysis</span>
      <div className="space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>
      <Skeleton className="min-h-80 flex-1" />
    </div>
  );
}
