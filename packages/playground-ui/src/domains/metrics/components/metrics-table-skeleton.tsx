import { Skeleton } from '../../../ds/components/Skeleton';

export interface MetricsTableSkeletonProps {
  label: string;
}

/** Table-sized placeholder for a metrics table. */
export function MetricsTableSkeleton({ label }: MetricsTableSkeletonProps) {
  return (
    <div role="status" aria-label={label} className="flex h-56 flex-col gap-2 pt-3">
      <Skeleton className="h-6" />
      <Skeleton className="h-6" />
      <Skeleton className="h-6" />
      <Skeleton className="h-6" />
    </div>
  );
}
