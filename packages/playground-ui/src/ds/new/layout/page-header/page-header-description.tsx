import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export interface PageHeaderDescriptionProps extends ComponentPropsWithoutRef<'p'> {
  isLoading?: boolean;
}

export function PageHeaderDescription({ children, className, isLoading, ...props }: PageHeaderDescriptionProps) {
  return (
    <p
      data-slot="page-header-description"
      className={cn(
        'max-w-140 col-[title/end] flex flex-wrap gap-x-4 gap-y-1 text-ui-sm text-muted-foreground',
        isLoading && 'w-160 max-w-[80%] animate-pulse rounded-md bg-muted',
        className,
      )}
      {...props}
    >
      {isLoading ? <>&nbsp;</> : children}
    </p>
  );
}
