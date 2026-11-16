import { Skeleton } from '@/ds/components/Skeleton';
import { cn } from '@/lib/utils';

/**
 * The header of a card with one large chart (an explorer, a detail page): the label over a large
 * value, the change against the previous period beside it. Cards in a grid use the compact title
 * and `MetricsCard.Total` instead. A skeleton while loading, at the value's own trimmed height.
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
        <span
          className={cn(
            'text-title text-foreground tabular-nums [text-box:trim-both_cap_alphabetic]',
            isLoading && 'relative min-w-24',
          )}
        >
          {isLoading ? (
            // Hidden text keeps the value's trimmed height, so the row (and the actions centred on
            // it) doesn't move when the value arrives; the bar covers it.
            <>
              <span className="invisible">0</span>
              <Skeleton className="absolute inset-0" />
            </>
          ) : (
            value
          )}
        </span>
        {!isLoading &&
          change && (
            // Trimmed like the value, so its line box doesn't make the row taller than while loading.
            <span className="text-body-sm text-muted-foreground tabular-nums [text-box:trim-both_cap_alphabetic]">
              {change} vs previous
            </span>
          )}
      </span>
    </div>
  );
}
