import { SkeletonText } from '@/ds/components/Skeleton';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

/** Always the top bar's last item, so action buttons sit to its left and the value hugs the edge. */
export function MetricsCardSummary({
  value,
  label,
  isLoading = false,
  className,
}: {
  value: string;
  label?: string;
  /** Skeletons in the value's and label's own line boxes, so the top bar keeps its height. */
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) {
    return (
      <div className={cn('order-last flex shrink-0 flex-col items-end', className)}>
        <SkeletonText line="text-body" className="h-4 w-14" />
        {label && <SkeletonText line="text-body mt-0.5" className="w-10" />}
      </div>
    );
  }
  return (
    <div className={cn('order-last text-right', className)}>
      <Txt tone="muted" className="tabular-nums">
        {value}
      </Txt>
      {label && (
        <Txt tone="faint" className="mt-0.5">
          {label}
        </Txt>
      )}
    </div>
  );
}
