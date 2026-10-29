import { Card, CardContent } from '@mastra/playground-ui/components/Card';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { SkeletonRows } from '../../../../../ui/SkeletonRows';
import { ROUTING_MAP_GRID_CLASS } from './RoutingMapLayout';

export function ModelRoutingSkeleton() {
  return (
    <div role="status" aria-label="Loading model routing" className="@container">
      <div aria-hidden className={ROUTING_MAP_GRID_CLASS}>
        <SkeletonRows label="Loading model sources" rows={2} className="gap-3 self-center">
          <Card>
            <CardContent className="flex items-center gap-3">
              <Skeleton className="size-8 shrink-0 motion-reduce:before:animate-none" />
              <div className="min-w-0 flex-1">
                <SkeletonText line="text-label" className="w-20 motion-reduce:before:animate-none" />
                <SkeletonText line="text-meta" className="w-28 max-w-full motion-reduce:before:animate-none" />
              </div>
            </CardContent>
          </Card>
        </SkeletonRows>
        <div className="hidden @min-[44rem]:block" />
        <SkeletonRows label="Loading model defaults" rows={2} className="min-w-0 gap-3">
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 shrink-0 motion-reduce:before:animate-none" />
                <SkeletonText line="text-label" className="w-32 motion-reduce:before:animate-none" />
              </div>
              <Skeleton className="h-control-sm w-full rounded-full motion-reduce:before:animate-none" />
              <Skeleton className="h-control-sm w-40 max-w-full rounded-full motion-reduce:before:animate-none" />
            </CardContent>
          </Card>
        </SkeletonRows>
      </div>
    </div>
  );
}
