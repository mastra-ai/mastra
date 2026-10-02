import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useMainSidebar } from '@/ds/components/MainSidebar/main-sidebar-context';
import { cn } from '@/lib/utils';

export type SidebarNewCommandHeaderProps = ComponentPropsWithoutRef<'header'>;

export const SidebarNewCommandHeader = forwardRef<HTMLElement, SidebarNewCommandHeaderProps>(
  function SidebarNewCommandHeader({ className, children, ...props }, ref) {
    const { state, isMobile } = useMainSidebar();

    return (
      <header
        ref={ref}
        data-slot="sidebar-new-command-header"
        data-state={state}
        className={cn(
          'flex h-header-default shrink-0 items-center gap-1 overflow-hidden',
          state === 'collapsed' ? 'px-3' : 'pr-2 pl-3.5',
          state !== 'collapsed' && !isMobile && 'w-[calc(var(--sidebar-width)-1rem)]',
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
