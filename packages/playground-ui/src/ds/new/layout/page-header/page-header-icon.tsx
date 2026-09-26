import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export type PageHeaderIconProps = ComponentPropsWithoutRef<'div'>;

export function PageHeaderIcon({ className, ...props }: PageHeaderIconProps) {
  return (
    <div
      data-slot="page-header-icon"
      className={cn('-my-1 flex min-h-control-lg items-center self-start text-muted-foreground', className)}
      {...props}
    />
  );
}
