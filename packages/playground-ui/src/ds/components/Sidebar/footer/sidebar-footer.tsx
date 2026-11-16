import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type SidebarFooterProps = ComponentPropsWithoutRef<'footer'>;

export function SidebarFooter({ className, children, ...props }: SidebarFooterProps) {
  // 2px in from the panel's padding, like the nav's rows: the footer's cards and buttons line up with the rows.
  return (
    <footer data-slot="sidebar-footer" className={cn('mt-auto shrink-0 space-y-1.5 px-0.5', className)} {...props}>
      {children}
    </footer>
  );
}
