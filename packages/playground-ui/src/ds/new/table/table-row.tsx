import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type TableRowProps = ComponentProps<'tr'>;

const linkedRowStyles = [
  'has-[[data-slot=table-row-link]]:relative',
  'has-[[data-slot=table-row-link]]:hover:*:bg-surface-panel',
  'has-[[data-slot=table-row-link]:focus-visible]:*:bg-surface-panel',
] as const;

export function TableRow({ className, ...props }: TableRowProps) {
  return <tr data-slot="table-row" className={cn(...linkedRowStyles, className)} {...props} />;
}
