import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';

import { SkeletonRows } from '../../../ui/SkeletonRows';
import { BOARD_CARD_LAYOUT_CLASS, BOARD_LIST_ROW_LAYOUT_CLASS } from '../boardLayout';
import type { BoardLayout } from '../boardLayout';

export function BoardItemsSkeleton({ label, layout, rows = 3 }: { label: string; layout: BoardLayout; rows?: number }) {
  if (layout === 'list') {
    return (
      <SkeletonRows label={label} rows={rows} className="gap-px">
        <div aria-hidden className={cn(BOARD_LIST_ROW_LAYOUT_CLASS, 'max-sm:min-h-13')}>
          <Skeleton className="size-3.5 shrink-0 motion-reduce:before:animate-none" />
          <Skeleton className="h-3 w-14 motion-reduce:before:animate-none max-sm:hidden" />
          <div className="flex min-w-0 items-center justify-between gap-3">
            <Skeleton className="h-3.5 w-3/5 max-w-80 motion-reduce:before:animate-none" />
            <Skeleton className="h-5 w-16 shrink-0 rounded-full motion-reduce:before:animate-none max-sm:hidden" />
          </div>
          <Skeleton className="size-avatar-sm rounded-full motion-reduce:before:animate-none max-sm:hidden" />
          <Skeleton className="h-3 w-10 justify-self-end motion-reduce:before:animate-none" />
        </div>
      </SkeletonRows>
    );
  }

  return (
    <SkeletonRows label={label} rows={rows} className="gap-2.5">
      <div aria-hidden className={BOARD_CARD_LAYOUT_CLASS}>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-20 motion-reduce:before:animate-none" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-3.5 shrink-0 motion-reduce:before:animate-none" />
            <Skeleton className="h-3.5 w-3/4 motion-reduce:before:animate-none" />
          </div>
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full motion-reduce:before:animate-none" />
          <Skeleton className="h-5 w-12 rounded-full motion-reduce:before:animate-none" />
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <Skeleton className="h-control-sm w-20 rounded-full motion-reduce:before:animate-none" />
          <Skeleton className="size-avatar-sm rounded-full motion-reduce:before:animate-none" />
        </div>
      </div>
    </SkeletonRows>
  );
}
