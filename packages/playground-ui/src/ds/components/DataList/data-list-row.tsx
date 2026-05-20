import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { dataListRowStyles } from './shared';
import { cn } from '@/lib/utils';

export type DataListRowProps = ComponentPropsWithoutRef<'div'>;

/**
 * Forwarded ref + spread props so virtualizers (`useVirtualizer.measureElement`)
 * can attach a ref and `data-index` to each rendered row.
 */
export const DataListRow = forwardRef<HTMLDivElement, DataListRowProps>(({ children, className, ...rest }, ref) => {
  return (
    <div ref={ref} className={cn(...dataListRowStyles, className)} {...rest}>
      {children}
    </div>
  );
});

DataListRow.displayName = 'DataListRow';
