import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type MainSidebarNavListProps = ComponentPropsWithoutRef<'ul'>;

export function MainSidebarNavList({ className, children, ...props }: MainSidebarNavListProps) {
  return (
    <ul className={cn('grid grid-cols-[minmax(0,1fr)] gap-1 items-start content-center', className)} {...props}>
      {children}
    </ul>
  );
}
