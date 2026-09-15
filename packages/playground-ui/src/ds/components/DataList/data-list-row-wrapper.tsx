import { forwardRef } from 'react';
import type { ComponentPropsWithoutRef, KeyboardEvent, MouseEvent } from 'react';
import { DataListRowWrapperContext } from './data-list-row-wrapper-context';
import { dataListRowOuterStyles, dataListRowStateStyles } from './shared';
import { cn } from '@/lib/utils';

export type DataListRowWrapperProps = ComponentPropsWithoutRef<'div'> & {
  /**
   * Makes the whole wrapper the row's activation target: it becomes focusable
   * (`tabIndex=0` unless overridden, e.g. by `getRowProps`), and a click or
   * Enter on the wrapper itself calls this. Descendants that must not activate
   * the row (the inner link, popover triggers, action buttons) should call
   * `event.stopPropagation()` on their click.
   */
  onSelectRow?: () => void;
};

/**
 * Grid wrapper used to host a leading or trailing cell (e.g. a selection
 * checkbox or row actions) alongside a `DataList.RowButton` / `RowLink`.
 *
 * Without `onSelectRow` it is non-interactive: hover/focus/click only apply to
 * the nested row primitive. With `onSelectRow` the wrapper itself becomes the
 * click / Enter target so the entire row (including trailing cells) activates.
 * For standalone interactive rows, use `DataList.RowButton` directly.
 *
 * Carries the `.data-list-row` marker so root-level row styling behaves the
 * same in wrapped and standalone rows.
 */
export const DataListRowWrapper = forwardRef<HTMLDivElement, DataListRowWrapperProps>(
  ({ children, className, onSelectRow, onClick, onKeyDown, tabIndex, ...rest }, ref) => {
    const isSelectable = onSelectRow !== undefined;

    const handleClick = (event: MouseEvent<HTMLDivElement>) => {
      onClick?.(event);
      if (!isSelectable || event.defaultPrevented) return;
      onSelectRow();
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (!isSelectable || event.defaultPrevented) return;
      // Only when the wrapper itself is focused. A focused descendant (the
      // link) receiving Enter fires its own native click; handling it here too
      // would activate the row twice.
      if (event.key === 'Enter' && event.target === event.currentTarget) {
        event.preventDefault();
        onSelectRow();
      }
    };

    return (
      <DataListRowWrapperContext.Provider value>
        <div
          ref={ref}
          tabIndex={tabIndex ?? (isSelectable ? 0 : undefined)}
          className={cn(
            'grid grid-cols-subgrid gap-0',
            ...dataListRowOuterStyles,
            ...dataListRowStateStyles,
            isSelectable &&
              'cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-accent1 focus-visible:ring-inset',
            className,
          )}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          {...rest}
        >
          {children}
        </div>
      </DataListRowWrapperContext.Provider>
    );
  },
);

DataListRowWrapper.displayName = 'DataListRowWrapper';
