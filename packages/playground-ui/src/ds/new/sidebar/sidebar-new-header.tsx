import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type SidebarNewHeaderProps = ComponentPropsWithoutRef<'header'>;

export function SidebarNewHeader({ className, children, ...props }: SidebarNewHeaderProps) {
  return (
    <header
      data-slot="sidebar-new-header"
      className={cn('flex h-header-default shrink-0 items-center gap-2 px-1', className)}
      {...props}
    >
      {children}
    </header>
  );
}
