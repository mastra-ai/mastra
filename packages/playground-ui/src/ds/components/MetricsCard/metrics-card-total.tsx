import { SkeletonText } from '@/ds/components/Skeleton';
import { cn } from '@/lib/utils';

/** One of several totals in a card that charts a few series, marked with its series' color. */
export type MetricsCardTotalPart = { label: string; value: string; color: string };

/**
 * A card's total, right of the title in the same type (14px, medium). Always the top
 * bar's last item. A skeleton while loading, in the value's own line box. A card charting a
 * few series of different things (resources, threads) can give one total each, each after a
 * marker in its series' color, like the legend.
 */
export function MetricsCardTotal({
  value,
  isLoading = false,
  className,
}: {
  value: string | readonly MetricsCardTotalPart[];
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('order-last shrink-0 text-body font-medium text-foreground tabular-nums', className)}>
      <TotalValue value={value} isLoading={isLoading} />
    </span>
  );
}

function TotalValue({ value, isLoading }: { value: string | readonly MetricsCardTotalPart[]; isLoading: boolean }) {
  if (isLoading) return <SkeletonText line="text-body" className="h-4 w-14" />;
  if (typeof value === 'string') return value;
  return (
    <span className="inline-flex items-center gap-3">
      {value.map(part => (
        <span key={part.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: part.color }} />
          {/* The marker is decorative; screen readers hear which total this is. */}
          <span className="sr-only">{part.label} </span>
          {part.value}
        </span>
      ))}
    </span>
  );
}
