import type { ComponentPropsWithoutRef } from 'react';

import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export interface PageHeaderMetaProps extends ComponentPropsWithoutRef<'div'> {
  beside?: boolean;
}

export function PageHeaderMeta({ beside = false, className, ...props }: PageHeaderMetaProps) {
  return (
    <Txt
      as="div"
      variant="meta"
      tone="muted"
      data-slot="page-header-meta"
      data-placement={beside ? 'beside' : 'below'}
      className={cn('flex min-w-0 flex-wrap items-center gap-2', className)}
      {...props}
    />
  );
}
