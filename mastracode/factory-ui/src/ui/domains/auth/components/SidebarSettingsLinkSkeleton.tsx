import { Sidebar, useSidebar } from '@mastra/playground-ui/components/Sidebar';
import { Skeleton, SkeletonText } from '@mastra/playground-ui/components/Skeleton';
import { IconSettingsSliderHor } from '@mastra/playground-ui/icons/central/IconSettingsSliderHor';

export function SidebarSettingsLinkSkeleton() {
  const { state: sidebarState } = useSidebar();

  return (
    <Sidebar.NavLink
      render={
        <div aria-hidden className="pointer-events-none">
          <Skeleton className="size-icon-md shrink-0 rounded-full motion-reduce:before:animate-none" />
          <Sidebar.NavLabel>
            <SkeletonText line="text-label" className="w-24 max-w-full motion-reduce:before:animate-none" />
          </Sidebar.NavLabel>
          {sidebarState !== 'collapsed' && <IconSettingsSliderHor aria-hidden="true" />}
        </div>
      }
    />
  );
}
