import type { ComponentProps } from 'react';
import { tableRowTargetStyles } from './table-row-target';
import { cn } from '@/lib/utils';

export type TableRowButtonProps = Omit<ComponentProps<'button'>, 'type'>;

export function TableRowButton({ className, ...props }: TableRowButtonProps) {
  return (
    <button
      type="button"
      data-slot="table-row-button"
      data-row-target=""
      className={cn('cursor-pointer text-left', ...tableRowTargetStyles, className)}
      {...props}
    />
  );
}
