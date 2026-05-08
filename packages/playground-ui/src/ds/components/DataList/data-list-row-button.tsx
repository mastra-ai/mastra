import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { dataListRowStyles } from './shared';
import { cn } from '@/lib/utils';

export type DataListRowButtonProps = ComponentPropsWithoutRef<'button'>;

/**
 * Forwarded ref + spread props so virtualizers (`useVirtualizer.measureElement`)
 * can attach a ref and `data-index` to each rendered row.
 */
export const DataListRowButton = forwardRef<HTMLButtonElement, DataListRowButtonProps>(
  ({ children, className, type = 'button', ...rest }, ref) => {
    return (
      <button ref={ref} type={type} className={cn(...dataListRowStyles, 'text-left', className)} {...rest}>
        {children}
      </button>
    );
  },
);

DataListRowButton.displayName = 'DataListRowButton';
