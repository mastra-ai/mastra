import React from 'react';

import { Txt } from '../Txt';
import { resolveTableAlign, tableAlignClasses, toNativeAlign } from './table-align';
import type { TableAlign } from './table-align';
import { useTableVariant } from './table-context';
import { cn } from '@/lib/utils';

export type TableCellTone = 'ink' | 'muted';

const tableCellToneClasses: Record<TableCellTone, string> = {
  ink: 'text-foreground',
  muted: 'text-muted-foreground',
};

export interface CellProps extends Omit<React.ComponentProps<'td'>, 'align'> {
  align?: TableAlign | React.TdHTMLAttributes<HTMLTableCellElement>['align'];
  tone?: TableCellTone;
  className?: string;
  children: React.ReactNode;
}

const insetCellClass = cn(
  'h-9 border-transparent bg-row bg-clip-padding px-2 py-1 align-middle whitespace-nowrap first:pl-3 last:pr-3',
  'group-data-column-dividers/table:border-l group-data-column-dividers/table:px-3',
);

export const Cell = ({ className, children, tone = 'ink', align, ...props }: CellProps) => {
  const variant = useTableVariant();
  if (variant === 'inset') {
    return (
      <td
        data-slot="table-cell"
        className={cn(
          insetCellClass,
          tableAlignClasses[resolveTableAlign(align)],
          tableCellToneClasses[tone],
          className,
        )}
        {...props}
      >
        {children}
      </td>
    );
  }
  return (
    <td
      className={cn(tableCellToneClasses[tone], 'first:pl-3 last:pr-3', className)}
      {...props}
      align={toNativeAlign(align)}
    >
      <div className={cn('flex size-full shrink-0 items-center')}>{children}</div>
    </td>
  );
};

export const TxtCell = ({ className, children }: CellProps) => {
  return (
    <Cell className={className}>
      <Txt as="span" variant="body-sm" className="w-full truncate">
        {children}
      </Txt>
    </Cell>
  );
};
