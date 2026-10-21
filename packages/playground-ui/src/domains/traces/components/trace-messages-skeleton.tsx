import { Skeleton } from '@/ds/components/Skeleton';
import { cn } from '@/utils/cn';

export interface TraceMessagesSkeletonProps {
  className?: string;
  /**
   * Hold the skeleton invisible for its first 500ms (`delay-500` + `fill-mode-backwards`) so cached or fast
   * responses swap straight to content without a flash. Turn off when a parent skeleton already handles the delay.
   */
  delayed?: boolean;
}

/** One `text-body` line box (14px × 143% ≈ 20px) holding a bar. */
function BodyLine({ width }: { width: string }) {
  return (
    <div className="flex h-5 items-center">
      <Skeleton className="h-3.5" style={{ width }} />
    </div>
  );
}

/**
 * Same layout as `TraceThreadItemView` once it resolves — `p-4`, `max-w-3xl`, a user bubble on the right
 * (`Message`: `px-4 py-2` + border around one body line, `my-3` with the leading margin stripped), assistant
 * body lines, then a one-line tool activity (`py-1` + caption line) — so the column keeps its shape while spans load.
 */
export function TraceMessagesSkeleton({ className, delayed = true }: TraceMessagesSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading messages"
      className={cn(
        'min-w-0 p-4',
        delayed && 'animate-in delay-500 duration-200 fade-in-0 fill-mode-backwards',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col">
        <Skeleton className="mb-3 ml-auto h-[38px] w-[60%] max-w-[70%] rounded-xl" />
        <BodyLine width="90%" />
        <BodyLine width="75%" />
        <BodyLine width="85%" />
        <BodyLine width="40%" />
        <Skeleton className="my-2.5 h-7 w-[55%] rounded-md" />
        <BodyLine width="80%" />
        <BodyLine width="50%" />
      </div>
    </div>
  );
}
