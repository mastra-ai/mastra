import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type DataListTopCellsProps = ComponentPropsWithoutRef<'div'> & {
  /**
   * Drop the group's default left margin. Use when this sits as the second
   * child of a gap-0 `DataList.Top`, beside a `DataList.TopSelectCell` that
   * owns the leading column.
   */
  flushLeft?: boolean;
  /**
   * Place the group starting at this column line, spanning through to the
   * last column. Defaults to the full grid (`col-span-full`). Use when this
   * sits beside a leading cell that owns column 1.
   */
  colStart?: number;
};

/**
 * Non-interactive header equivalent of `DataList.RowButton`. Groups a set of
 * `DataList.TopCell`s with the same horizontal layout (gap, mx, px) as
 * `RowButton`, so columns inside a wrapped `Top` line up cell-for-cell with the
 * columns inside a wrapped `Row`.
 */
export const DataListTopCells = forwardRef<HTMLDivElement, DataListTopCellsProps>(
  ({ children, className, flushLeft, colStart, style, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('grid grid-cols-subgrid gap-8 col-span-full px-5', flushLeft && 'pl-0!', className)}
        style={colStart ? { ...style, gridColumn: `${colStart} / -1` } : style}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

DataListTopCells.displayName = 'DataListTopCells';
