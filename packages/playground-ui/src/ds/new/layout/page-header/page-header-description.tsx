import type { ComponentPropsWithoutRef } from 'react';

import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface PageHeaderDescriptionProps extends ComponentPropsWithoutRef<'p'> {
  isLoading?: boolean;
}

export function PageHeaderDescription({ children, className, isLoading, ...props }: PageHeaderDescriptionProps) {
  return (
    <Txt
      as="p"
      variant="caption"
      tone="muted"
      data-slot="page-header-description"
      className={cn(
        'flex max-w-140 flex-wrap gap-x-4 gap-y-1',
        isLoading && 'w-160 max-w-4/5 animate-pulse rounded-md bg-muted',
        className,
      )}
      {...props}
    >
      {isLoading ? <>&nbsp;</> : children}
    </Txt>
  );
}
