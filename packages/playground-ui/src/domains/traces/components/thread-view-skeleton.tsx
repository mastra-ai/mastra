import { TraceMessagesSkeleton } from './trace-messages-skeleton';
import { TraceSpanTreeSkeleton } from './trace-span-tree-skeleton';
import { Card } from '@/ds/components/Card';
import { Skeleton } from '@/ds/components/Skeleton';
import { controlSizeClasses } from '@/ds/primitives/control-size';
import { cn } from '@/lib/utils';

const ROWS = [0, 1, 2];

export interface ThreadViewSkeletonProps {
  /** Mirrors the resolved rows: adds the Feedback tab between Messages and Scores. */
  withFeedback?: boolean;
}

/**
 * Same geometry as the resolved `ThreadTrace` rows — the `ThreadTraceDivider` grid with the trace link and tabs
 * centered over the messages column, then the `px-4` messages column next to a details card that is clamped to it
 * (`h-0 min-h-full`) and holds the span tree — so the panel does not reflow once the thread's traces arrive.
 *
 * The whole skeleton waits 500ms before fading in, so fast responses swap straight to content without a flash.
 */
export function ThreadViewSkeleton({ withFeedback = false }: ThreadViewSkeletonProps) {
  const tabWidths = withFeedback ? ['w-24', 'w-22', 'w-18'] : ['w-24', 'w-18'];

  return (
    <div
      role="status"
      aria-label="Loading thread"
      className="min-h-0 animate-in overflow-hidden delay-500 duration-200 fade-in-0 fill-mode-backwards"
    >
      {ROWS.map(idx => (
        <div key={idx} className="flex flex-col pb-4">
          <div data-slot="thread-trace-divider-skeleton" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 items-center gap-3 py-3 pl-4">
              <span className="h-px flex-1 bg-border" />
              <div className="flex shrink-0 items-center gap-2">
                <Skeleton className={cn('w-26 rounded-md', controlSizeClasses.sm)} />
                <span className="h-4 w-px bg-border" />
                <div className="flex items-center gap-0.5">
                  {tabWidths.map(width => (
                    <Skeleton
                      key={width}
                      data-slot="thread-tab-skeleton"
                      className={cn('rounded-full', controlSizeClasses.sm, width)}
                    />
                  ))}
                </div>
              </div>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex items-center pr-4">
              <span className="h-px flex-1 bg-border" />
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div data-slot="thread-messages-skeleton" className="min-w-0 px-4">
              <TraceMessagesSkeleton delayed={false} />
            </div>
            <Card elevation="raised" className="mx-4 h-0 min-h-full min-w-0 overflow-hidden">
              <div className="px-4 pt-2 pb-4">
                <TraceSpanTreeSkeleton />
              </div>
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
}
