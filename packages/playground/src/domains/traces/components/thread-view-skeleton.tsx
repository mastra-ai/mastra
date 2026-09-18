import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

import { TraceMessagesSkeleton } from './trace-messages-skeleton';

const ROWS = [0, 1, 2];

/**
 * Same geometry as the resolved `ThreadTrace` rows — the rail gutter on the left, a `24rem`
 * messages column, then the bordered details column with its tab header — so the panel
 * does not reflow once the thread's traces arrive.
 */
export function ThreadViewSkeleton() {
  return (
    <div role="status" aria-label="Loading thread" className="min-h-0 overflow-hidden">
      {ROWS.map(idx => (
        <div key={idx} className="grid grid-cols-[24rem_minmax(0,1fr)] pr-4 pl-14">
          <TraceMessagesSkeleton className="pr-4 pl-0" />
          <div
            className={cn(
              'min-w-0 overflow-hidden border-x border-b border-border1',
              idx === 0 && 'rounded-t-xl border-t',
              idx === ROWS.length - 1 && 'rounded-b-xl',
            )}
          >
            <div className="min-h-header-default border-border1 flex items-center gap-2 border-b px-2 py-1.5">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <div className="flex flex-col gap-px p-2">
              {[0, 1, 2, 1, 0].map((depth, row) => (
                <div key={row} className="flex min-h-8 items-center gap-2" style={{ paddingLeft: `${depth}rem` }}>
                  <Skeleton className="size-4 shrink-0 rounded" />
                  <Skeleton className="h-3.5 flex-1 rounded" style={{ maxWidth: `${60 - depth * 12}%` }} />
                  <Skeleton className="ml-auto h-3 w-10 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
