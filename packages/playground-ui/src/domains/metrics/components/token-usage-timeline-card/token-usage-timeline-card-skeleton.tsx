import { Skeleton } from '../../../../ds/components/Skeleton';

/** Body-sized placeholder matching the tabs + chart footprint. */
export function TokenUsageTimelineCardSkeleton() {
  return (
    <div role="status" aria-label="Loading token usage timeline" className="flex h-full flex-col gap-3">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="flex-1" />
    </div>
  );
}
