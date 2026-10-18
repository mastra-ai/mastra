import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { GROUP_ATTR } from '@/hooks/use-fluid-hover';
import { cn } from '@/lib/utils';

export type DataListGroupProps = ComponentPropsWithoutRef<'section'>;

/** Rows sharing the list's columns; the hover lights them only while the pointer is on or between them. */
export const DataListGroup = forwardRef<HTMLElement, DataListGroupProps>(({ className, ...rest }, ref) => {
  return (
    <section
      ref={ref}
      {...{ [GROUP_ATTR]: '' }}
      className={cn('col-span-full grid grid-cols-subgrid gap-y-px [&>:not(.data-list-row)]:col-span-full', className)}
      {...rest}
    />
  );
});

DataListGroup.displayName = 'DataListGroup';
