import { Skeleton } from '@/ds/components/Skeleton';
import { cn } from '@/lib/utils';

/** `[depth, name width]` per row: a root span, then a couple of nested levels, like a typical agent run. */
const ROWS: Array<[number, string]> = [
  [0, '55%'],
  [1, '40%'],
  [1, '60%'],
  [2, '35%'],
  [2, '50%'],
  [1, '45%'],
  [2, '30%'],
  [1, '65%'],
];

const LEGEND_WIDTHS = ['w-14', 'w-12', 'w-16'];

export interface TraceSpanTreeSkeletonProps {
  className?: string;
}

/**
 * Same boxes as the resolved tree — the `SpanTypeLegend` pills, then one `TimelineNameCol` row per span
 * (structure sign for children, top-aligned dot, caption name stacked over the meta duration, `w-8` toggle slot) —
 * so nothing jumps when the spans land.
 */
export function TraceSpanTreeSkeleton({ className }: TraceSpanTreeSkeletonProps) {
  return (
    <div role="status" aria-label="Loading spans" className={cn('flex flex-col', className)}>
      <div data-slot="span-type-legend-skeleton" className="flex flex-wrap items-center gap-1.5 py-3">
        {LEGEND_WIDTHS.map(width => (
          <Skeleton key={width} className={cn('h-5 rounded-full', width)} />
        ))}
      </div>
      <div className="grid gap-y-px pb-1">
        {ROWS.map(([depth, width], idx) => (
          <div key={idx} className="flex min-h-8 items-stretch" style={{ paddingLeft: `${depth}rem` }}>
            {depth > 0 && <div className="w-2 shrink-0" />}
            <div className="flex min-w-0 flex-1 items-start gap-1.5 px-2 py-1">
              <Skeleton className="mt-[5px] size-2 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col">
                {/* Line boxes of the caption name (18px) and meta duration (16px). */}
                <div className="flex h-[18px] items-center">
                  <Skeleton className="h-3" style={{ width }} />
                </div>
                <div className="flex h-4 items-center">
                  <Skeleton className="h-2.5 w-10" />
                </div>
              </div>
            </div>
            <div className="w-8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
