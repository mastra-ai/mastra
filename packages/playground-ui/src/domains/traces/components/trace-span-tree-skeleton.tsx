import { Skeleton } from '@/ds/components/Skeleton';
import { controlSizeClasses } from '@/ds/primitives/control-size';
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

export interface TraceSpanTreeSkeletonProps {
  /** Mirrors `leadingSlot`: the search field rendered above the tree. */
  withSearch?: boolean;
  className?: string;
}

/**
 * Same boxes as the resolved tree — search field, type legend, then one `min-h-8` row per span
 * indented by depth with the dot + name + duration of `TimelineNameCol` — so nothing jumps
 * when the spans land.
 */
export function TraceSpanTreeSkeleton({ withSearch = true, className }: TraceSpanTreeSkeletonProps) {
  return (
    <div role="status" aria-label="Loading spans" className={cn('flex flex-col', className)}>
      {withSearch && <Skeleton className={cn('w-full', controlSizeClasses.sm)} />}
      <div className="flex items-center gap-3 px-2 py-1.5">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-10" />
        <Skeleton className="h-3 w-14" />
      </div>
      <div className="grid gap-y-px py-1">
        {ROWS.map(([depth, width], idx) => (
          <div key={idx} className="flex min-h-8 items-center" style={{ paddingLeft: `${depth}rem` }}>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1">
              <Skeleton className="size-2 shrink-0 rounded-full" />
              <Skeleton className="h-3" style={{ width }} />
              <Skeleton className="ml-auto h-2.5 w-10 shrink-0" />
            </div>
            <div className="w-8 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
