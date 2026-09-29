import type { ComponentPropsWithoutRef } from 'react';

import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface PageHeaderTitleProps extends ComponentPropsWithoutRef<'h1'> {
  isLoading?: boolean;
}

export function PageHeaderTitle({ children, className, isLoading, ...props }: PageHeaderTitleProps) {
  return (
    <Txt
      as="h1"
      variant="heading"
      tone="ink"
      data-slot="page-header-title"
      className={cn(
        'col-start-[title] row-start-1 flex min-w-0 items-center gap-2 self-start',
        '[&>svg]:size-[1.25em] [&>svg]:opacity-50',
        isLoading && 'w-60 max-w-[50%] animate-pulse rounded-md bg-fill',
        className,
      )}
      {...props}
    >
      {isLoading ? <>&nbsp;</> : children}
    </Txt>
  );
}
