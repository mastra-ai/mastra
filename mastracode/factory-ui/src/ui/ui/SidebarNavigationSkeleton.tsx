import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import type { ComponentProps } from 'react';

import { SkeletonRows } from './SkeletonRows';

export function SidebarNavigationSkeleton({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <SkeletonRows label={label} rows={rows} className="gap-0.5">
      <SidebarNavListSkeleton />
    </SkeletonRows>
  );
}

export function SidebarNavListSkeleton() {
  return (
    <Sidebar.NavList aria-hidden className="pointer-events-none">
      <SidebarNavRowSkeleton />
    </Sidebar.NavList>
  );
}

export function SidebarNavRowSkeleton(props: Omit<ComponentProps<typeof Sidebar.NavLink>, 'render'>) {
  return (
    <Sidebar.NavLink
      {...props}
      render={
        <div>
          <Skeleton className="size-4 shrink-0 motion-reduce:before:animate-none" />
          <Sidebar.NavLabel>
            <Skeleton className="h-3 w-3/4 max-w-40 motion-reduce:before:animate-none" />
          </Sidebar.NavLabel>
        </div>
      }
    />
  );
}
