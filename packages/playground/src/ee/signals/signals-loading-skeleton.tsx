import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

function DistributionSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-border1 bg-surface2 p-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}

export function SignalsLoadingSkeleton() {
  return (
    <div
      aria-label="Loading signal analysis"
      className="space-y-5 p-4 lg:p-6"
      data-testid="signals-loading-skeleton"
      role="status"
    >
      <span className="sr-only">Loading signal analysis</span>
      <div className="space-y-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-7 w-96 max-w-full" />
        <Skeleton className="h-4 w-xl max-w-full" />
      </div>
      <Skeleton className="h-14 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DistributionSkeleton />
        <DistributionSkeleton />
        <DistributionSkeleton />
        <DistributionSkeleton />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}
