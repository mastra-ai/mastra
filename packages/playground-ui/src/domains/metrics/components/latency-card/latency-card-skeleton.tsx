import { Skeleton } from '../../../../ds/components/Skeleton';

/** Body-sized placeholder: tab row on top of the chart area. */
export function LatencyCardSkeleton() {
  return (
    <div role="status" aria-label="Loading latency" className="flex h-64 flex-col gap-3">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="flex-1" />
    </div>
  );
}
