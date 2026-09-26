import type { ComponentPropsWithoutRef } from 'react';

import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type PageHeaderEyebrowProps = ComponentPropsWithoutRef<'div'>;

export function PageHeaderEyebrow({ className, ...props }: PageHeaderEyebrowProps) {
  return (
    <Txt
      as="div"
      variant="caption"
      tone="muted"
      data-slot="page-header-eyebrow"
      className={cn(
        'flex min-w-0 items-center',
        '*:inline-flex *:items-center *:gap-1 *:rounded-sm *:transition-colors *:hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}
