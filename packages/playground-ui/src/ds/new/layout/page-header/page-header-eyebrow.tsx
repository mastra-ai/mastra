import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export type PageHeaderEyebrowProps = ComponentPropsWithoutRef<'div'>;

export function PageHeaderEyebrow({ className, ...props }: PageHeaderEyebrowProps) {
  return (
    <div
      data-slot="page-header-eyebrow"
      className={cn('absolute bottom-full left-0 mb-1 text-ui-xs', className)}
      {...props}
    />
  );
}
