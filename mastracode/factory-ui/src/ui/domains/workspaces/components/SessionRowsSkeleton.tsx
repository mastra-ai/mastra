import { SESSION_ROW_WINDOW } from '@mastra/factory/session/session-row-query';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

import { SkeletonRows } from '../../../ui/SkeletonRows';

export function SessionRowsSkeleton({ label, compact }: { label: string; compact: boolean }) {
  return (
    <SkeletonRows label={label} rows={SESSION_ROW_WINDOW} className="gap-0.5">
      <Sidebar.NavList aria-hidden className="pointer-events-none">
        <Sidebar.NavLink
          render={
            <div>
              <Skeleton className="size-icon-sm shrink-0 rounded-full motion-reduce:before:animate-none" />
              <Sidebar.NavLabel
                description={
                  compact ? undefined : (
                    <SkeletonText line="text-meta" className="w-1/2 max-w-28 motion-reduce:before:animate-none" />
                  )
                }
              >
                <SkeletonText line="text-label" className="w-3/4 max-w-40 motion-reduce:before:animate-none" />
              </Sidebar.NavLabel>
            </div>
          }
        />
      </Sidebar.NavList>
    </SkeletonRows>
  );
}
