import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export type PageHeaderActionProps = ComponentPropsWithoutRef<'div'>;

export function PageHeaderAction({ className, ...props }: PageHeaderActionProps) {
  return (
    <div
      data-slot="page-header-action"
      className={cn('col-start-4 row-start-1 justify-self-end', className)}
      {...props}
    />
  );
}
