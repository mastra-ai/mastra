import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { CONNECTED_ROW, ROW_TITLE } from './ProviderRows';

export function ProviderRowsSkeleton() {
  return Array.from({ length: 2 }, (_, index) => (
    <li key={index} aria-hidden className={CONNECTED_ROW}>
      <Skeleton className="size-icon-md shrink-0 motion-reduce:before:animate-none" />
      <span className={ROW_TITLE}>
        <SkeletonText line="text-caption" className="w-28 motion-reduce:before:animate-none" />
      </span>
      <SkeletonText line="text-meta" className="w-16 motion-reduce:before:animate-none" />
      <span className="size-control-sm shrink-0" />
    </li>
  ));
}
