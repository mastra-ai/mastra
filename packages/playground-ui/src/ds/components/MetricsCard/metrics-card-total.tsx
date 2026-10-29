import { SkeletonText } from '@/ds/components/Skeleton';
import { cn } from '@/lib/utils';

/**
 * A compact card's total, right of the title in the same type (14px, medium). Always the top
 * bar's last item. A skeleton while loading, in the value's own line box.
 */
export function MetricsCardTotal({
  value,
  isLoading = false,
  className,
}: {
  value: string;
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('order-last shrink-0 text-body font-medium text-foreground tabular-nums', className)}>
      {isLoading ? <SkeletonText line="text-body" className="h-4 w-14" /> : value}
    </span>
  );
}
