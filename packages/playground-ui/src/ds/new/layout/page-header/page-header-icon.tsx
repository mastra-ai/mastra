import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export type PageHeaderIconProps = ComponentPropsWithoutRef<'div'>;

export function PageHeaderIcon({ className, ...props }: PageHeaderIconProps) {
  return (
    <div
      data-slot="page-header-icon"
      className={cn('col-start-1 row-start-1 flex items-center self-center text-neutral3 [&>svg]:size-6', className)}
      {...props}
    />
  );
}
