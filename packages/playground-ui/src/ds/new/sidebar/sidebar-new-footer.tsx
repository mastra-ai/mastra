import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type SidebarNewFooterProps = ComponentPropsWithoutRef<'footer'>;

export function SidebarNewFooter({ className, children, ...props }: SidebarNewFooterProps) {
  return (
    <footer
      data-slot="sidebar-new-footer"
      className={cn('mt-auto flex shrink-0 flex-col gap-1.5 pb-1', className)}
      {...props}
    >
      {children}
    </footer>
  );
}
