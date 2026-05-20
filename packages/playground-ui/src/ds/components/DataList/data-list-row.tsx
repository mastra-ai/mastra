import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type DataListRowProps = ComponentPropsWithoutRef<'div'>;

/**
 * Non-interactive grid wrapper. Used to host a leading cell (e.g. a selection
 * checkbox) alongside a `DataList.RowButton` so hover/focus/click only apply to
 * the button portion. For standalone interactive rows, use `DataList.RowButton`
 * directly without this wrapper.
 */
export const DataListRow = forwardRef<HTMLDivElement, DataListRowProps>(({ children, className, ...rest }, ref) => {
  return (
    <div ref={ref} className={cn('grid grid-cols-subgrid gap-0 col-span-full ml-1', className)} {...rest}>
      {children}
    </div>
  );
});

DataListRow.displayName = 'DataListRow';
