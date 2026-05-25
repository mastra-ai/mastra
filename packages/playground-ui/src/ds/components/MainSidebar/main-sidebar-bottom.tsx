import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type MainSidebarBottomProps = ComponentPropsWithoutRef<'div'>;

export function MainSidebarBottom({ className, children, ...props }: MainSidebarBottomProps) {
  return (
    <div className={cn('mt-auto', className)} {...props}>
      {children}
    </div>
  );
}
