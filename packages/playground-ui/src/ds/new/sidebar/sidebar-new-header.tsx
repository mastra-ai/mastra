import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { SidebarNewTrigger } from './sidebar-new-trigger';
import { useMaybeSidebarState } from '@/ds/components/MainSidebar/main-sidebar-context';
import { cn } from '@/lib/utils';

export type SidebarNewHeaderProps = ComponentPropsWithoutRef<'header'> & {
  /** Logo for the collapsed rail. Replaces the children when collapsed and swaps to the toggle on hover. */
  collapsedLogo?: ReactNode;
};

// Holds opacity while the sidebar collapses, so leftover hover doesn't flash the toggle.
const hold = 'animate-[sidebar-hold_var(--resize-dur)] motion-reduce:animate-none';

export function SidebarNewHeader({ className, children, collapsedLogo, ...props }: SidebarNewHeaderProps) {
  const sidebar = useMaybeSidebarState();
  const collapsed = sidebar?.state === 'collapsed';
  const isMobile = sidebar?.isMobile ?? false;

  return (
    <header
      data-slot="sidebar-new-header"
      className={cn(
        'flex h-header-default shrink-0 items-center gap-2',
        collapsed ? 'px-1' : 'pr-2 pl-3.5',
        // Target width, not the animating one, so the title doesn't re-truncate while expanding.
        !collapsed && !isMobile && 'w-[calc(var(--sidebar-width)-1rem)]',
        className,
      )}
      {...props}
    >
      {collapsed && collapsedLogo ? (
        // ml-0.5 instead of mx-auto, so it doesn't jump while the sidebar collapses.
        <div className="group/collapsed-logo relative ml-0.5 grid size-9 shrink-0 place-items-center">
          <span
            className={cn(
              hold,
              'grid place-items-center transition-opacity duration-normal [--sidebar-hold-opacity:1] group-focus-within/collapsed-logo:opacity-0 group-hover/sidebar:opacity-0 motion-reduce:transition-none',
            )}
          >
            {collapsedLogo}
          </span>
          {isMobile ? null : (
            <div
              className={cn(
                hold,
                'absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-normal [--sidebar-hold-opacity:0] group-hover/sidebar:opacity-100 focus-within:opacity-100 motion-reduce:transition-none',
              )}
            >
              <SidebarNewTrigger />
            </div>
          )}
        </div>
      ) : (
        children
      )}
    </header>
  );
}
