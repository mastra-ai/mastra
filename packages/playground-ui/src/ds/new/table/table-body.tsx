import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type TableBodyProps = ComponentProps<'tbody'>;

const tableBodyStyles = [
  '[&>tr+tr>td]:border-t',
  '[&>tr:first-child>td:first-child]:rounded-tl-lg',
  '[&>tr:first-child>td:last-child]:rounded-tr-lg',
  '[&>tr:first-child_[data-slot=table-row-link]]:after:rounded-t-lg',
  '[&>tr:last-child_[data-slot=table-row-link]]:after:rounded-b-lg',
  '[&_:is(a,button,input,select,textarea):not([data-slot=table-row-link])]:relative',
  '[&_:is(a,button,input,select,textarea):not([data-slot=table-row-link])]:z-1',
] as const;

export function TableBody({ className, ...props }: TableBodyProps) {
  return <tbody data-slot="table-body" className={cn(...tableBodyStyles, className)} {...props} />;
}
