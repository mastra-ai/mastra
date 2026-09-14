import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export type PageHeaderIconSize = 'sm' | 'lg';

export interface PageHeaderIconProps extends ComponentPropsWithoutRef<'div'> {
  size?: PageHeaderIconSize;
}

export function PageHeaderIcon({ className, size = 'sm', ...props }: PageHeaderIconProps) {
  return (
    <div
      data-slot="page-header-icon"
      data-size={size}
      className={cn(
        'absolute right-full mr-2 flex items-center text-neutral3',
        size === 'lg' ? 'top-1 [&>svg]:size-10' : '-top-0.5 [&>svg]:size-6',
        className,
      )}
      {...props}
    />
  );
}
