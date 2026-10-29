import { SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { SkeletonRows } from '../../../../ui/SkeletonRows';

export function KnowledgeFlyoutSkeleton() {
  return (
    <div role="status" aria-label="Loading knowledge node" className="flex min-h-0 flex-col">
      <div aria-hidden className="px-4 pb-3">
        <SkeletonText line="text-body-sm" className="w-full motion-reduce:before:animate-none" />
        <SkeletonText line="text-body-sm" className="w-4/5 motion-reduce:before:animate-none" />
      </div>
      <SkeletonRows label="Loading knowledge properties" rows={4} className="gap-1 px-4 pb-4">
        <div aria-hidden className="flex items-center justify-between gap-4">
          <SkeletonText line="text-caption" className="w-16 motion-reduce:before:animate-none" />
          <SkeletonText line="text-caption" className="w-28 motion-reduce:before:animate-none" />
        </div>
      </SkeletonRows>
    </div>
  );
}
