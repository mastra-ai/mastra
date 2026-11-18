import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { SkeletonRows } from '../../../../ui/SkeletonRows';

export function FileTreeSkeleton() {
  return (
    <SkeletonRows label="Loading files" rows={8} className="min-h-0 flex-1 gap-0 overflow-hidden p-1.5">
      <div aria-hidden className="flex h-7 min-w-0 shrink-0 items-center gap-1.5 pr-1">
        <span className="size-3 shrink-0" />
        <Skeleton className="size-icon-sm shrink-0 rounded-sm motion-reduce:before:animate-none" />
        <SkeletonText line="text-caption" className="h-3 w-28 max-w-full motion-reduce:before:animate-none" />
      </div>
    </SkeletonRows>
  );
}
