import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type SidebarNewFooterProps = ComponentPropsWithoutRef<'footer'>;

export function SidebarNewFooter({ className, children, ...props }: SidebarNewFooterProps) {
  return (
    <footer data-slot="sidebar-new-footer" className={cn('mt-auto shrink-0 space-y-1.5 pb-2', className)} {...props}>
      {children}
    </footer>
  );
}
