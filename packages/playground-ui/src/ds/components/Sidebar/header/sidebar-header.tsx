import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { useMaybeSidebarState } from '../root/sidebar-context';
import { SidebarTrigger } from '../root/sidebar-trigger';
import { cn } from '@/lib/utils';

import './sidebar-header.css';

export type SidebarHeaderProps = ComponentPropsWithoutRef<'header'> & {
  collapsedLogo?: ReactNode;
  actions?: ReactNode;
};

const hold = 'animate-[sidebar-hold_var(--resize-dur)] motion-reduce:animate-none';
// The rail's logo and toggle crossfade. Swapping to the toggle waits 60ms, so moving the pointer across the rail
// doesn't trigger it; the way back is immediate.
const crossfade = 'transition-opacity duration-100 ease-out group-hover/sidebar:delay-60 motion-reduce:transition-none';

export function SidebarHeader({ className, children, collapsedLogo, actions, ...props }: SidebarHeaderProps) {
  const sidebar = useMaybeSidebarState();
  const collapsed = sidebar?.state === 'collapsed';
  const isMobile = sidebar?.isMobile ?? false;

  return (
    <header
      data-slot="sidebar-header"
      className={cn(
        'flex h-header-default shrink-0 items-center gap-0.5',
        !collapsed && 'pr-2 pl-3.5',
        // Collapsed, the logo sits on the rail's centre like every icon.
        collapsed && collapsedLogo && 'justify-center px-0',
        collapsed && !collapsedLogo && 'px-1',
        collapsed && actions && 'h-auto flex-col gap-3 py-3',
        !collapsed && !isMobile && 'w-[calc(var(--sidebar-width)-1rem)]',
        className,
      )}
      {...props}
    >
      {collapsed && collapsedLogo ? (
        <div
          data-slot="sidebar-collapsed-logo"
          className="group/collapsed-logo relative grid size-9 shrink-0 place-items-center"
        >
          <span
            className={cn(
              hold,
              crossfade,
              'grid place-items-center [--sidebar-hold-opacity:1] group-focus-within/collapsed-logo:opacity-0 group-hover/sidebar:opacity-0',
            )}
          >
            {collapsedLogo}
          </span>
          {isMobile ? null : (
            <div
              className={cn(
                hold,
                crossfade,
                'absolute inset-0 grid place-items-center opacity-0 [--sidebar-hold-opacity:0] group-hover/sidebar:opacity-100 focus-within:opacity-100',
              )}
            >
              <SidebarTrigger />
            </div>
          )}
        </div>
      ) : (
        children
      )}
      {actions}
    </header>
  );
}
