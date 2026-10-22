import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';
import { useTableVariant } from './table-context';
import { tableRowTargetStyles } from './table-row-target';

export type TableRowButtonProps = Omit<ComponentProps<'button'>, 'type'>;

export function TableRowButton({ className, ...props }: TableRowButtonProps) {
  const variant = useTableVariant();
  return (
    <button
      type="button"
      data-slot="table-row-button"
      data-row-target=""
      className={cn('cursor-pointer text-left', ...tableRowTargetStyles(variant), className)}
      {...props}
    />
  );
}
