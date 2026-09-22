import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

export interface TraceMessagesSkeletonProps {
  className?: string;
}

/**
 * Same layout as `TraceThreadItemView` once it resolves — `p-4`, `max-w-3xl`, a user bubble on
 * the right then assistant text on the left — so the column keeps its shape while spans load.
 *
 * Stays invisible for the first 500ms (`delay-500` + `fill-mode-backwards`) so cached or fast
 * responses swap straight to content without a skeleton flash.
 */
export function TraceMessagesSkeleton({ className }: TraceMessagesSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading messages"
      className={cn('animate-in fade-in-0 fill-mode-backwards p-4 delay-500 duration-200', className)}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Skeleton className="ml-auto h-9 w-[60%] rounded-xl" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-[90%]" />
          <Skeleton className="h-3.5 w-[75%]" />
          <Skeleton className="h-3.5 w-[85%]" />
          <Skeleton className="h-3.5 w-[40%]" />
        </div>
        <Skeleton className="h-8 w-[55%] rounded-lg" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-[80%]" />
          <Skeleton className="h-3.5 w-[50%]" />
        </div>
      </div>
    </div>
  );
}
