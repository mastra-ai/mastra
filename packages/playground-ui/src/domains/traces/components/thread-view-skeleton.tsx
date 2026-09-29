import { TraceMessagesSkeleton } from './trace-messages-skeleton';
import { Skeleton } from '@/ds/components/Skeleton';

const ROWS = [0, 1, 2];

/**
 * Same geometry as the resolved `ThreadTrace` rows — the rail gutter on the left, then a centered
 * conversation column where each turn opens with its divider — so the panel does not reflow once
 * the thread's traces arrive.
 */
export function ThreadViewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading thread"
      className="min-h-0 animate-in overflow-hidden delay-500 duration-200 fade-in-0 fill-mode-backwards"
    >
      {ROWS.map(idx => (
        <div key={idx} className="pr-4 pl-14">
          <div className="mx-auto flex w-full max-w-3xl flex-col">
            <div className="flex items-center gap-2 pt-4">
              <Skeleton className="h-3 w-12 rounded" />
              <div className="h-px flex-1 bg-border" />
              <Skeleton className="size-7 rounded" />
            </div>
            <TraceMessagesSkeleton />
          </div>
        </div>
      ))}
    </div>
  );
}
