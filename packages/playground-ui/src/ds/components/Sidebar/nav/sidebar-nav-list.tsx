import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type SidebarNavListProps = ComponentPropsWithoutRef<'ul'>;

export function SidebarNavList({ className, children, ...props }: SidebarNavListProps) {
  return (
    <ul className={cn('grid grid-cols-[minmax(0,1fr)] content-center items-start gap-0.5', className)} {...props}>
      {children}
    </ul>
  );
}
