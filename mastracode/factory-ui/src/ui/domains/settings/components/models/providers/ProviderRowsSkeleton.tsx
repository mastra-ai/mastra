import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { CONNECTED_ROW, PROVIDER_ROWS, ROW_TITLE } from './ProviderRows';

export function ProviderRowsSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading providers">
      <ul aria-hidden className={PROVIDER_ROWS}>
        {Array.from({ length: rows }, (_, index) => (
          <li key={index} className={CONNECTED_ROW}>
            <Skeleton className="size-icon-md shrink-0 motion-reduce:before:animate-none" />
            <span className={ROW_TITLE}>
              <SkeletonText line="text-caption" className="w-28 motion-reduce:before:animate-none" />
            </span>
            <SkeletonText line="text-meta" className="w-16 motion-reduce:before:animate-none" />
            <span className="size-control-sm shrink-0" />
          </li>
        ))}
        <li className="flex h-10 items-center px-3">
          <SkeletonText line="text-caption" className="w-28 motion-reduce:before:animate-none" />
        </li>
      </ul>
    </div>
  );
}
