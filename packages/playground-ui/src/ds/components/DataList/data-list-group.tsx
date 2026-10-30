import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type DataListGroupProps = ComponentPropsWithoutRef<'section'>;

/** Rows sharing the list's columns. */
export const DataListGroup = forwardRef<HTMLElement, DataListGroupProps>(({ className, ...rest }, ref) => {
  return (
    <section
      ref={ref}
      className={cn('col-span-full grid grid-cols-subgrid gap-y-px [&>:not(.data-list-row)]:col-span-full', className)}
      {...rest}
    />
  );
});

DataListGroup.displayName = 'DataListGroup';
