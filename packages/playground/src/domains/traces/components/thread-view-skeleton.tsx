import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { TraceMessagesSkeleton } from './trace-messages-skeleton';

const ROWS = [0, 1, 2];

/**
 * Same geometry as the resolved `ThreadTrace` rows — the rail gutter on the left, a `24rem`
 * messages column closed by a right border, then the details column with its header, each row
 * underlined — so the panel does not reflow once the thread's traces arrive.
 */
export function ThreadViewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading thread"
      className="animate-in fade-in-0 fill-mode-backwards min-h-0 overflow-hidden delay-500 duration-200"
    >
      {ROWS.map(idx => (
        <div key={idx} className="border-border grid grid-cols-[24rem_minmax(0,1fr)] border-b pr-4 pl-14">
          <TraceMessagesSkeleton className="border-border border-x pr-4 pl-0" />
          <div className="min-w-0 overflow-hidden">
            <div className="min-h-header-default border-border flex items-center gap-2 border-b px-2 py-1.5">
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
