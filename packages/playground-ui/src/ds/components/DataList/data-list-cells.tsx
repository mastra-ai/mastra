import { format, isToday } from 'date-fns';
import { Children, cloneElement, isValidElement } from 'react';
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { dataListRowActionRevealStyles, dataListStickyStartStyles } from './shared';
import type { DataListSticky } from './shared';
import { Checkbox } from '@/ds/components/Checkbox';
import { cn } from '@/lib/utils';

export type DataListCellProps = {
  children?: ReactNode;
  className?: string;
  /**
   * HTML element rendered for the cell. Defaults to `span`. Use `'label'` when
   * the cell wraps a labelable control (e.g. a Checkbox), so the whole cell
   * area acts as the click/hover target.
   */
  as?: ElementType;
  /**
   * Pins the cell to the horizontal start edge of the list while the list
   * scrolls sideways.
   */
  sticky?: DataListSticky;
} & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'>;

export function DataListCell({ children, className, as, sticky, ...rest }: DataListCellProps) {
  const Component = as || 'span';
  return (
    <Component
      className={cn(
        'relative grid max-w-full min-w-0 items-center overflow-hidden text-body-sm whitespace-nowrap text-muted-foreground empty:before:text-placeholder empty:before:content-["—"]',
        sticky === 'start' && dataListStickyStartStyles,
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

/**
 * Trailing cell for row actions, revealed on row hover or keyboard focus.
 * Sits beside a `DataList.RowButton` inside a `DataList.RowWrapper`.
 */
export function DataListActionsCell({ children, className, ...rest }: DataListCellProps) {
  return (
    <DataListCell className={className} {...rest}>
      <span
        className={cn(
          'flex w-full items-center justify-end gap-1 pr-3 transition-opacity duration-200',
          dataListRowActionRevealStyles,
        )}
      >
        {children}
      </span>
    </DataListCell>
  );
}

const dataListTruncateContentStyles =
  'block min-w-0 max-w-full truncate empty:before:content-["—"] empty:before:text-placeholder [&>*]:min-w-0 [&>*]:max-w-full [&>*]:overflow-hidden [&>*]:text-ellipsis [&>*]:whitespace-nowrap';
const dataListInlineTextTruncateStyles = 'min-w-0 flex-1 truncate';

function DataListInlineText({ children }: { children: string | number }) {
  return <span className={dataListInlineTextTruncateStyles}>{children}</span>;
}

function DataListTruncatedTextNodes({ children }: { children: ReactNode }) {
  return Children.map(children, child => {
    if (typeof child === 'string' || typeof child === 'number') {
      return <DataListInlineText>{child}</DataListInlineText>;
    }

    return child;
  });
}

function DataListTruncatedCellContent({ children }: { children: ReactNode }) {
  return Children.map(children, child => {
    if (!isValidElement<{ children?: ReactNode; className?: string }>(child) || typeof child.type !== 'string') {
      return child;
    }

    return cloneElement(child, {
      className: cn('max-w-full min-w-0 overflow-hidden', child.props.className),
      children: <DataListTruncatedTextNodes>{child.props.children}</DataListTruncatedTextNodes>,
    });
  });
}

export type DataListTextCellProps = DataListCellProps & {
  /**
   * Typeface for the cell text. `mono` is for genuine code — paths, env values,
   * serialized JSON — and drops a size step to match the sans columns optically.
   */
  font?: 'sans' | 'mono';
};

export function DataListTextCell({ children, className, font = 'sans', ...rest }: DataListTextCellProps) {
  return (
    <DataListCell className={cn(font === 'mono' && 'font-mono text-body-sm', className)} {...rest}>
      <span className={dataListTruncateContentStyles}>
        <DataListTruncatedCellContent>{children}</DataListTruncatedCellContent>
      </span>
    </DataListCell>
  );
}

export function DataListNameCell({ children, className }: DataListCellProps) {
  return (
    <DataListCell className={cn('text-left text-label text-foreground', className)}>
      <span className={dataListTruncateContentStyles}>
        <DataListTruncatedCellContent>{children}</DataListTruncatedCellContent>
      </span>
    </DataListCell>
  );
}

export function DataListDescriptionCell({ children, className }: DataListCellProps) {
  return (
    <DataListCell className={cn('text-muted-foreground', className)}>
      <span className={dataListTruncateContentStyles}>
        <DataListTruncatedCellContent>{children}</DataListTruncatedCellContent>
      </span>
    </DataListCell>
  );
}

export type DataListRowHeaderCellProps = Omit<DataListCellProps, 'sticky'>;

export function DataListRowHeaderCell({ children, className, ...rest }: DataListRowHeaderCellProps) {
  return (
    <DataListCell
      sticky="start"
      className={cn(
        'data-list-row-header -mx-3 w-auto max-w-none px-3 text-left text-label text-foreground',
        className,
      )}
      {...rest}
    >
      <span className={cn(dataListTruncateContentStyles, 'relative z-10 w-full')}>
        <DataListTruncatedCellContent>{children}</DataListTruncatedCellContent>
      </span>
    </DataListCell>
  );
}

export type DataListNumberCellProps = DataListCellProps & {
  /**
   * Emphasizes the value with the ink tone and the label role — use for the
   * primary metric in a row (e.g. a total or headline number).
   */
  highlight?: boolean;
  font?: 'sans' | 'mono';
};

/**
 * Right-aligned numeric cell with tabular figures, for metric and summary
 * tables. Pass `highlight` for the emphasized column.
 */
export function DataListNumberCell({
  children,
  className,
  highlight,
  font = 'sans',
  ...rest
}: DataListNumberCellProps) {
  return (
    <DataListCell
      className={cn(
        'justify-items-end text-right text-muted-foreground tabular-nums',
        highlight && 'text-label text-foreground',
        font === 'mono' && 'font-mono',
        className,
      )}
      {...rest}
    >
      {children}
    </DataListCell>
  );
}

function getShortId(id: string | undefined): string {
  return id?.slice(0, 8) ?? '';
}

export interface DataListIdCellProps {
  id: string;
}

export function DataListIdCell({ id }: DataListIdCellProps) {
  return <DataListCell className="tracking-wide text-muted-foreground">{getShortId(id)}</DataListCell>;
}

export interface DataListSelectCellProps {
  checked: boolean;
  /**
   * Called when the checkbox is clicked. Receives the click event's `shiftKey`
   * so callers can implement range-select. The cell stops the click from
   * reaching the host row, so the row's `onClick` doesn't fire.
   */
  onToggle: (shiftKey: boolean) => void;
  /** Disable the checkbox, e.g. while a selection mutation is in flight. */
  disabled?: boolean;
  'aria-label'?: string;
}

export function DataListSelectCell({ checked, onToggle, disabled, ...rest }: DataListSelectCellProps) {
  return (
    <DataListCell
      as="label"
      className={cn(
        'size-8 justify-items-center self-center overflow-visible px-0',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
      onClick={e => e.stopPropagation()}
      data-selected={checked || undefined}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={() => {}} // no-op: selection handled by onClick to capture shiftKey
        // The click still has to bubble to the cell above, which is what keeps it
        // off the host row. Base UI withholds this handler while disabled.
        onClick={e => onToggle(e.shiftKey)}
        aria-label={rest['aria-label']}
      />
    </DataListCell>
  );
}

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

export interface DataListDateCellProps {
  timestamp: Date | string;
}

/** Compact date cell — `Today` or `MMM dd` (e.g. `May 19`). */
export function DataListDateCell({ timestamp }: DataListDateCellProps) {
  const date = toDate(timestamp);
  return (
    <DataListCell className="text-muted-foreground">
      {date ? (isToday(date) ? 'Today' : format(date, 'MMM dd')) : null}
    </DataListCell>
  );
}

export interface DataListCreatedCellProps {
  timestamp: Date | string;
}

/** Compact date + time cell — always `MMM d HH:mm:ss` (e.g. `Aug 31 13:07:47`), 24h, no milliseconds. */
export function DataListCreatedCell({ timestamp }: DataListCreatedCellProps) {
  const date = toDate(timestamp);
  return (
    <DataListCell className="text-muted-foreground tabular-nums">
      {date ? format(date, 'MMM d HH:mm:ss') : null}
    </DataListCell>
  );
}

export interface DataListTimeCellProps {
  timestamp: Date | string;
}

export function DataListTimeCell({ timestamp }: DataListTimeCellProps) {
  const date = toDate(timestamp);
  return (
    <DataListCell className="flex text-muted-foreground tabular-nums">
      {date ? (
        <>
          {format(date, 'h:mm:ss')}
          <span className="text-placeholder">
            .{String(date.getMilliseconds()).padStart(3, '0')} {format(date, 'aaa')}
          </span>
        </>
      ) : null}
    </DataListCell>
  );
}
