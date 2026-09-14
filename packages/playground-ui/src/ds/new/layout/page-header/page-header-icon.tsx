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
        'absolute top-1/2 right-full col-start-1 row-start-1 row-end-2 mr-2 flex -translate-y-1/2 items-center text-neutral3',
        size === 'lg' ? '[&>svg]:size-10' : '[&>svg]:size-6',
        className,
      )}
      {...props}
    />
  );
}
