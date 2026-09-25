import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export type PageHeaderActionProps = ComponentPropsWithoutRef<'div'>;

export function PageHeaderAction({ className, ...props }: PageHeaderActionProps) {
  return (
    <div
      data-slot="page-header-action"
      className={cn('-my-1 ml-auto flex min-h-control-lg shrink-0 items-center self-start', className)}
      {...props}
    />
  );
}
