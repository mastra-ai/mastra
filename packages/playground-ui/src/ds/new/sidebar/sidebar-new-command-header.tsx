import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useMainSidebar } from '@/ds/components/MainSidebar/main-sidebar-context';
import { cn } from '@/lib/utils';

export type SidebarNewCommandHeaderProps = ComponentPropsWithoutRef<'header'>;

export const SidebarNewCommandHeader = forwardRef<HTMLElement, SidebarNewCommandHeaderProps>(
  function SidebarNewCommandHeader({ className, children, ...props }, ref) {
    const { state } = useMainSidebar();

    return (
      <header
        ref={ref}
        data-slot="sidebar-new-command-header"
        data-state={state}
        className={cn(
          'flex h-header-default shrink-0 items-center gap-1 overflow-hidden px-3',
          state === 'collapsed' && '[&_[data-slot=sidebar-new-search-trigger]]:hidden',
          className,
        )}
        {...props}
      >
        {children}
      </header>
    );
  },
);
