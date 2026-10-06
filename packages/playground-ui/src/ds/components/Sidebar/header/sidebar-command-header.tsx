import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { useSidebar } from '../root/sidebar-context';
import { cn } from '@/lib/utils';

export type SidebarCommandHeaderProps = ComponentPropsWithoutRef<'header'>;

export const SidebarCommandHeader = forwardRef<HTMLElement, SidebarCommandHeaderProps>(function SidebarCommandHeader(
  { className, children, ...props },
  ref,
) {
  const { state, isMobile } = useSidebar();

  return (
    <header
      ref={ref}
      data-slot="sidebar-command-header"
      data-state={state}
      className={cn(
        'flex h-header-default shrink-0 items-center gap-1 overflow-hidden',
        state === 'collapsed' ? 'px-3' : 'pr-2 pl-3.5',
        state !== 'collapsed' && !isMobile && 'w-[calc(var(--sidebar-width)-1rem)]',
        state === 'collapsed' && '[&_[data-slot=sidebar-search-trigger]]:hidden',
        className,
      )}
      {...props}
    >
      {children}
    </header>
  );
});
