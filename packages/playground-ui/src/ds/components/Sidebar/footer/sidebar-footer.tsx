import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type SidebarFooterProps = ComponentPropsWithoutRef<'footer'>;

export function SidebarFooter({ className, children, ...props }: SidebarFooterProps) {
  return (
    <footer data-slot="sidebar-footer" className={cn('mt-auto shrink-0 space-y-1.5', className)} {...props}>
      {children}
    </footer>
  );
}
