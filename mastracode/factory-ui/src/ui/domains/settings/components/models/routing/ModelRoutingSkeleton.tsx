import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';

import { PersonalDefaultModelSkeleton } from '../defaults/PersonalDefaultModelSkeleton';
import { ORG_SCOPE_AUDIENCE } from '../providers/ProviderList';
import { ProviderRows } from '../providers/ProviderRows';
import { ProviderRowsSkeleton } from '../providers/ProviderRowsSkeleton';
import { DefaultsCard } from './DefaultsCard';
import { LaneCard } from './LaneCard';
import { RoutingMapLayout } from './RoutingMapLayout';

const LANE_DESTINATION_SKELETON = (
  <span aria-hidden>
    <SkeletonText line="text-meta" className="w-24 motion-reduce:before:animate-none" />
  </span>
);

export function ModelRoutingSkeleton() {
  return (
    <div role="status" aria-label="Loading model routing">
      <RoutingMapLayout
        lanes={
          <>
            <LaneCard lane="chats" destination={LANE_DESTINATION_SKELETON} />
            <LaneCard lane="runs" destination={LANE_DESTINATION_SKELETON} />
          </>
        }
        defaults={
          <>
            <DefaultsCard
              defaults="personal"
              inUse
              model={<PersonalDefaultModelSkeleton />}
              providers={<ProviderRows addInert />}
            />
            <DefaultsCard
              defaults="factory"
              inUse
              model={
                <Skeleton aria-hidden className="h-control-sm w-full rounded-full motion-reduce:before:animate-none" />
              }
              providers={
                <div className="flex flex-col gap-2">
                  <ProviderRows addInert>
                    <ProviderRowsSkeleton rows={1} />
                  </ProviderRows>
                  <Txt as="p" variant="caption" tone="muted">
                    {ORG_SCOPE_AUDIENCE}
                  </Txt>
                </div>
              }
            />
          </>
        }
      />
    </div>
  );
}
