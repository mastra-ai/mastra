import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';

import { SkeletonRows } from './SkeletonRows';

export function SidebarNavigationSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <SkeletonRows label={label} rows={rows} className="gap-0.5">
      <Sidebar.NavList aria-hidden className="pointer-events-none">
        <Sidebar.NavLink
          render={
            <div>
              <Skeleton className="size-4 shrink-0 motion-reduce:before:animate-none" />
              <Sidebar.NavLabel>
                <Skeleton className="h-3 w-3/4 max-w-40 motion-reduce:before:animate-none" />
              </Sidebar.NavLabel>
            </div>
          }
        />
      </Sidebar.NavList>
    </SkeletonRows>
  );
}
