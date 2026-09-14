import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export interface PageHeaderMetaProps extends ComponentPropsWithoutRef<'div'> {
  placement?: 'below' | 'beside';
}

export function PageHeaderMeta({ className, placement = 'below', ...props }: PageHeaderMetaProps) {
  return (
    <div
      data-slot="page-header-meta"
      data-placement={placement}
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-2',
        placement === 'beside' ? 'col-start-2 row-start-1 self-center justify-self-start' : 'col-span-3 col-start-1',
        className,
      )}
      {...props}
    />
  );
}
