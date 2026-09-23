import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export type PageHeaderActionProps = ComponentPropsWithoutRef<'div'>;

export function PageHeaderAction({ className, ...props }: PageHeaderActionProps) {
  return (
    <div
      data-slot="page-header-action"
      className={cn('col-start-[action] row-start-1 self-center justify-self-end', className)}
      {...props}
    />
  );
}
