import type { ComponentPropsWithoutRef } from 'react';

import { cn } from '@/lib/utils';

export type PageHeaderIconProps = ComponentPropsWithoutRef<'div'>;

export function PageHeaderIcon({ className, ...props }: PageHeaderIconProps) {
  return (
    <div
      data-slot="page-header-icon"
      className={cn(
        'absolute top-1/2 right-full col-start-1 row-start-1 row-end-2 mr-2 flex -translate-y-1/2 items-center text-neutral3 [&>svg]:size-6',
        className,
      )}
      {...props}
    />
  );
}
