import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';

export function SidebarSettingsLinkSkeleton({ label }: { label?: string }) {
  return (
    <Sidebar.NavLink
      role={label ? 'status' : undefined}
      aria-label={label}
      render={
        <div aria-hidden className="pointer-events-none">
          <Skeleton className="size-icon-md shrink-0 rounded-full motion-reduce:before:animate-none" />
          <Sidebar.NavLabel>
            <SkeletonText line="text-label" className="w-24 max-w-full motion-reduce:before:animate-none" />
          </Sidebar.NavLabel>
        </div>
      }
    />
  );
}
