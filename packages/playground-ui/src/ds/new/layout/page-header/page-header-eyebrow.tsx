import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export type PageHeaderEyebrowProps = ComponentPropsWithoutRef<'div'>;

export function PageHeaderEyebrow({ className, ...props }: PageHeaderEyebrowProps) {
  return (
    <div
      data-slot="page-header-eyebrow"
      {...props}
      className={cn(
        'text-caption text-muted-foreground',
        'flex min-w-0 items-center',
        '*:inline-flex *:items-center *:gap-1 *:rounded-sm *:transition-colors *:hover:text-foreground',
        className,
      )}
    />
  );
}
