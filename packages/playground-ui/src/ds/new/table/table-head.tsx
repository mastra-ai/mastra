import type { ComponentProps } from 'react';
import { tableAlignClasses } from './table-align';
import type { TableAlign } from './table-align';
import { cn } from '@/lib/utils';

export type TableHeadProps = Omit<ComponentProps<'th'>, 'align'> & {
  align?: TableAlign;
};

export function TableHead({ align = 'start', className, ...props }: TableHeadProps) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'h-10 px-2 align-middle text-column whitespace-nowrap text-muted-foreground first:pl-3 last:pr-3',
        'border-transparent group-data-column-dividers/table:border-l group-data-column-dividers/table:px-3',
        tableAlignClasses[align],
        className,
      )}
      {...props}
    />
  );
}
