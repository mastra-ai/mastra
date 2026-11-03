import { SkeletonText } from '@/ds/components/Skeleton';
import { cn } from '@/lib/utils';

/**
 * The header of a card with one large chart (an explorer, a detail page): the label over a large
 * value, the change against the previous period beside it. Cards in a grid use the compact title
 * and `MetricsCard.Total` instead. A skeleton while loading, in the value's own line box.
 */
export function MetricsCardHeadline({
  label,
  value,
  change,
  isLoading = false,
  className,
}: {
  label: string;
  value: string;
  /** E.g. "+71.4%"; shown as "+71.4% vs previous". */
  change?: string;
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <h3 className="text-body-sm text-muted-foreground">{label}</h3>
      <span className="flex items-baseline gap-2">
        <span className="text-title text-foreground tabular-nums [text-box:trim-both_cap_alphabetic]">
          {isLoading ? <SkeletonText line="text-title" className="w-24" /> : value}
        </span>
        {!isLoading && change && (
          <span className="text-body-sm text-muted-foreground tabular-nums">{change} vs previous</span>
        )}
      </span>
    </div>
  );
}
