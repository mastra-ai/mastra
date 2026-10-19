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
 * (one `w-4` rail column per level, dot centred on the name line, caption name stacked over the meta duration, `w-8` toggle slot) —
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
          <div key={idx} className="flex min-h-8 items-start pl-1">
            {/* One rail column per level, then the dot column centred on the name line. */}
            {Array.from({ length: depth }, (_, level) => (
              <div key={level} className="w-4 shrink-0" />
            ))}
            <div className="flex min-w-0 flex-1 flex-col">
              {/* Line boxes of the caption name (18px) and meta duration (16px). */}
              <div className="flex items-center py-1">
                <div className="flex w-4 shrink-0 justify-center">
                  <Skeleton className="size-2 rounded-full" />
                </div>
                <div className="flex h-[18px] min-w-0 flex-1 items-center pl-1.5">
                  <Skeleton className="h-3" style={{ width }} />
                </div>
              </div>
              <div className="flex h-5 items-center pb-1 pl-5.5">
                <Skeleton className="h-2.5 w-10" />
              </div>
            </div>
            <div className="w-8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
