import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { SourceDescriptionLoading } from './BoardCardDetails';
import { overviewSectionClass } from './CardOverview';

export function CardOverviewSkeleton() {
  return (
    <div role="status" aria-label="Loading overview" className={overviewSectionClass}>
      <Skeleton aria-hidden className="h-control-sm w-28 rounded-full motion-reduce:before:animate-none" />
      <SourceDescriptionLoading />
    </div>
  );
}
