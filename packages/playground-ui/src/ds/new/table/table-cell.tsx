import type { ComponentProps } from 'react';
import { tableAlignClasses } from './table-align';
import type { TableAlign } from './table-align';
import { cn } from '@/lib/utils';

export type TableCellTone = 'ink' | 'muted';

export type TableCellProps = Omit<ComponentProps<'td'>, 'align'> & {
  align?: TableAlign;
  tone?: TableCellTone;
};

const tableCellToneClasses: Record<TableCellTone, string> = {
  ink: 'text-foreground',
  muted: 'text-muted-foreground',
};

export function TableCell({ align = 'start', tone = 'ink', className, ...props }: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'h-9 border-transparent bg-background bg-clip-padding px-2 py-1 align-middle whitespace-nowrap first:pl-3 last:pr-3',
        'group-data-column-dividers/table:border-l group-data-column-dividers/table:px-3',
        tableAlignClasses[align],
        tableCellToneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
