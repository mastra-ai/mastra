import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export interface PageHeaderMetaProps extends ComponentPropsWithoutRef<'div'> {
  beside?: boolean;
}

export function PageHeaderMeta({ beside = false, className, ...props }: PageHeaderMetaProps) {
  return (
    <div
      data-slot="page-header-meta"
      data-placement={beside ? 'beside' : 'below'}
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-2',
        beside ? 'col-start-2 row-start-1 self-center justify-self-start' : 'col-span-3 col-start-1',
        className,
      )}
      {...props}
    />
  );
}
