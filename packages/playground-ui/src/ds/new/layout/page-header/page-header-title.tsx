import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export interface PageHeaderTitleProps extends ComponentPropsWithoutRef<'h1'> {
  isLoading?: boolean;
}

export function PageHeaderTitle({ children, className, isLoading, ...props }: PageHeaderTitleProps) {
  return (
    <h1
      data-slot="page-header-title"
      className={cn(
        'col-start-[title] row-start-1 flex min-w-0 items-center gap-2 self-start',
        'text-heading text-foreground',
        '[&>svg]:size-[1.25em] [&>svg]:opacity-50',
        isLoading && 'w-60 max-w-[50%] animate-pulse rounded-md bg-fill',
        className,
      )}
      {...props}
    >
      {isLoading ? <>&nbsp;</> : children}
    </h1>
  );
}
