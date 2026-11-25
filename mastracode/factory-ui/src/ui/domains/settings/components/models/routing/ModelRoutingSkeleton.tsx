import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { SkeletonRows } from '../../../../../ui/SkeletonRows';

export function ModelRoutingSkeleton() {
  return (
    <SkeletonRows label="Loading model defaults" rows={2} className="gap-3">
      <Card aria-hidden>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 motion-reduce:before:animate-none" />
            <div className="min-w-0 flex-1">
              <SkeletonText line="text-label" className="w-32 motion-reduce:before:animate-none" />
              <SkeletonText line="text-meta" className="w-40 max-w-full motion-reduce:before:animate-none" />
            </div>
          </div>
          <Skeleton className="h-control-sm w-full rounded-full motion-reduce:before:animate-none" />
          <Skeleton className="h-control-sm w-40 max-w-full rounded-full motion-reduce:before:animate-none" />
        </CardContent>
      </Card>
    </SkeletonRows>
  );
}
