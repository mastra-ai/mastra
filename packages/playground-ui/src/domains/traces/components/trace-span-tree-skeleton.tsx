import { Skeleton } from '../../../ds/components/Skeleton';
import { cn } from '../../../lib/utils';
import { SPAN_TREE_INDENT, SPAN_TREE_PAD_Y } from './span-tree-rail';

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
 * (24px per level, badge centred on the name line, name stacked over the duration, `w-8` toggle slot) —
 * so nothing jumps when the spans land.
 */
export function TraceSpanTreeSkeleton({ className }: TraceSpanTreeSkeletonProps) {
  return (
    <div role="status" aria-label="Loading spans" className={cn('flex flex-col', className)}>
      <div data-slot="span-type-legend-skeleton" className="flex flex-wrap items-center gap-1.5 pb-3">
        {LEGEND_WIDTHS.map(width => (
          <Skeleton key={width} className={cn('h-5 rounded-full', width)} />
        ))}
      </div>
      <div className="grid gap-y-px pb-1">
        {ROWS.map(([depth, width], idx) => (
          <div key={idx} className="flex pl-1" style={{ paddingBlock: SPAN_TREE_PAD_Y }}>
            <div className="flex min-w-0 flex-1" style={{ paddingLeft: depth * SPAN_TREE_INDENT }}>
              <div className="flex h-5 w-6 shrink-0 items-center justify-center">
                <Skeleton className="size-5 rounded-md" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col pl-2">
                {/* Line boxes of the body-sm name (20px) and caption duration (16px). */}
                <div className="flex h-5 items-center">
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
