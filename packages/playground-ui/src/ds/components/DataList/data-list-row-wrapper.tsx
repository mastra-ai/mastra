import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { DataListRowWrapperContext } from './data-list-row-wrapper-context';
import { dataListRowOuterStyles } from './shared';
import { cn } from '@/lib/utils';

export type DataListRowWrapperProps = ComponentPropsWithoutRef<'div'>;

/**
 * Non-interactive grid wrapper. Used to host a leading or trailing cell (e.g. a
 * selection checkbox or row actions) alongside a `DataList.RowButton` so
 * hover/focus/click only apply to the button portion. For standalone
 * interactive rows, use `DataList.RowButton` directly without this wrapper.
 *
 * Carries the row-level border + `.data-list-row` marker so separators and
 * sibling-aware rules behave the same in wrapped and standalone rows.
 */
export const DataListRowWrapper = forwardRef<HTMLDivElement, DataListRowWrapperProps>(
  ({ children, className, ...rest }, ref) => {
    return (
      <DataListRowWrapperContext.Provider value>
        <div
          ref={ref}
          className={cn('grid grid-cols-subgrid gap-0 mx-1', ...dataListRowOuterStyles, className)}
          {...rest}
        >
          {children}
        </div>
      </DataListRowWrapperContext.Provider>
    );
  },
);

DataListRowWrapper.displayName = 'DataListRowWrapper';
