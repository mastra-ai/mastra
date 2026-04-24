import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type MainSidebarNavListProps = ComponentPropsWithoutRef<'ul'>;

export function MainSidebarNavList({ className, children, ...props }: MainSidebarNavListProps) {
  return (
    <ul className={cn('grid gap-1 items-start content-center', className)} {...props}>
      {children}
    </ul>
  );
}
