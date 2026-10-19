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

export function SidebarHeader({ className, children, collapsedLogo, actions, ...props }: SidebarHeaderProps) {
  const sidebar = useMaybeSidebarState();
  const collapsed = sidebar?.state === 'collapsed';
  const isMobile = sidebar?.isMobile ?? false;

  return (
    <header
      data-slot="sidebar-header"
      className={cn(
        'flex h-header-default shrink-0 items-center gap-2',
        collapsed ? 'px-1' : 'pr-2 pl-3.5',
        collapsed && actions && 'h-auto flex-col gap-3 py-3',
        !collapsed && !isMobile && 'w-[calc(var(--sidebar-width)-1rem)]',
        className,
      )}
      {...props}
    >
      {collapsed && collapsedLogo ? (
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
