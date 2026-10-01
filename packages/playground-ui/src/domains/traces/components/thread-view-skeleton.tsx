import { TraceMessagesSkeleton } from './trace-messages-skeleton';
import { Card } from '@/ds/components/Card';
import { Skeleton } from '@/ds/components/Skeleton';

const ROWS = [0, 1, 2];

/**
 * Same geometry as the resolved `ThreadTrace` rows — a divider announcing the turn and its tabs,
 * then the messages column next to the details card — so the panel does not reflow once the
 * thread's traces arrive.
 */
export function ThreadViewSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading thread"
      className="min-h-0 animate-in overflow-hidden delay-500 duration-200 fade-in-0 fill-mode-backwards"
    >
      {ROWS.map(idx => (
        <div key={idx} className="flex flex-col pb-4">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="h-px flex-1 bg-border" />
            <Skeleton className="h-6 w-14 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <span className="h-px flex-[3] bg-border" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <TraceMessagesSkeleton />
            <Card elevation="raised" className="mx-4 min-w-0 overflow-hidden">
              <div className="flex min-h-header-default items-center justify-end border-b border-border px-2 py-1.5">
                <Skeleton className="h-6 w-24 rounded-full" />
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
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
}
