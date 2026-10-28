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
      {...props}
      className={cn(
        'text-meta text-muted-foreground',
        'flex min-w-0 flex-wrap items-center gap-2',
        beside && 'min-h-6 shrink-0',
        className,
      )}
    />
  );
}
