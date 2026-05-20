import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { dataListRowStyles } from './shared';
import type { DataListRowSharedProps } from './shared';
import { cn } from '@/lib/utils';

export type DataListRowButtonProps = ComponentPropsWithoutRef<'button'> & DataListRowSharedProps;

/**
 * Forwarded ref + spread props so virtualizers (`useVirtualizer.measureElement`)
 * can attach a ref and `data-index` to each rendered row.
 */
export const DataListRowButton = forwardRef<HTMLButtonElement, DataListRowButtonProps>(
  ({ children, className, type = 'button', flushLeft, colStart, featured, style, ...rest }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(...dataListRowStyles, 'text-left', flushLeft && 'ml-0!', featured && 'bg-surface4', className)}
        style={colStart ? { ...style, gridColumn: `${colStart} / -1` } : style}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

DataListRowButton.displayName = 'DataListRowButton';
