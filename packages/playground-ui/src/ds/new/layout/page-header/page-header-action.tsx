import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export type PageHeaderActionProps = ComponentPropsWithoutRef<'div'>;

export function PageHeaderAction({ className, ...props }: PageHeaderActionProps) {
  return (
    <div data-slot="page-header-action" className={cn('ml-auto shrink-0 self-start pt-0.5', className)} {...props} />
  );
}
