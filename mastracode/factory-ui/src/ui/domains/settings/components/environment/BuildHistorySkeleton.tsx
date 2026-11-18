import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { SettingsContainer } from '@mastra/playground-ui/new/settings';

import { BUILD_HISTORY_ROW } from './BuildHistoryBlock';

export function BuildHistorySkeleton() {
  return (
    <SettingsContainer role="status" aria-label="Loading build history">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} aria-hidden className={BUILD_HISTORY_ROW}>
          <Skeleton className="size-icon-sm shrink-0 motion-reduce:before:animate-none" />
          <Skeleton className="h-5 w-16 rounded-full motion-reduce:before:animate-none" />
          <SkeletonText line="text-meta" className="w-32 motion-reduce:before:animate-none" />
          <SkeletonText line="text-meta" className="ml-auto w-24 motion-reduce:before:animate-none" />
        </div>
      ))}
    </SettingsContainer>
  );
}
