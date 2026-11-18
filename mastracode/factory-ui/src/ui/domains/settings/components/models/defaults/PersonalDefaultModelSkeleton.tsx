import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { SkeletonRows } from '../../../../../ui/SkeletonRows';

export function PersonalDefaultModelSkeleton() {
  return (
    <SkeletonRows label="Loading your default model" rows={1} className="gap-2">
      <div aria-hidden className="flex min-w-0 flex-col gap-2">
        <Skeleton className="h-control-sm w-full rounded-full motion-reduce:before:animate-none" />
        <div className="flex gap-2">
          <Skeleton className="h-control-sm w-40 max-w-full rounded-full motion-reduce:before:animate-none" />
          <Skeleton className="h-control-sm w-12 rounded-full motion-reduce:before:animate-none" />
        </div>
      </div>
    </SkeletonRows>
  );
}
