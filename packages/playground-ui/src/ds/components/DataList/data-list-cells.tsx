import { format, isToday } from 'date-fns';
import { Children, cloneElement, isValidElement } from 'react';
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { dataListStickyStartStyles } from './shared';
import type { DataListSticky } from './shared';
import { Checkbox } from '@/ds/components/Checkbox';
import { cn } from '@/lib/utils';

export type DataListCellProps = {
  children?: ReactNode;
  className?: string;
  height?: 'default' | 'compact';
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

export function DataListCell({ children, className, height = 'default', as, sticky, ...rest }: DataListCellProps) {
  const Component = as || 'span';
  return (
    <Component
      className={cn(
        'relative grid max-w-full min-w-0 items-center overflow-hidden text-ui-md whitespace-nowrap text-neutral3 empty:before:text-neutral2 empty:before:content-["—"]',
        height === 'compact' ? 'py-1.5' : 'py-2.5',
        sticky === 'start' && dataListStickyStartStyles,
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

const dataListTruncateContentStyles =
  'block min-w-0 max-w-full truncate empty:before:content-["—"] empty:before:text-neutral2 [&>*]:min-w-0 [&>*]:max-w-full [&>*]:overflow-hidden [&>*]:text-ellipsis [&>*]:whitespace-nowrap';
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

export function DataListTextCell({ children, className, ...rest }: DataListCellProps) {
  return (
    <DataListCell className={className} {...rest}>
      <span className={dataListTruncateContentStyles}>
        <DataListTruncatedCellContent>{children}</DataListTruncatedCellContent>
      </span>
    </DataListCell>
  );
}

export function DataListNameCell({ children, className }: DataListCellProps) {
  return (
    <DataListCell className={cn('text-left text-neutral4', className)}>
      <span className={dataListTruncateContentStyles}>
        <DataListTruncatedCellContent>{children}</DataListTruncatedCellContent>
      </span>
    </DataListCell>
  );
}

export function DataListDescriptionCell({ children, className }: DataListCellProps) {
  return (
    <DataListCell className={cn('text-neutral2', className)}>
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
        'data-list-row-header -mr-4 -ml-5 w-auto max-w-none rounded-l-md pr-4 pl-5 text-left text-ui-sm font-semibold tracking-tight text-neutral2',
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
   * Emphasizes the value with a brighter tone and semibold weight — use for the
   * primary metric in a row (e.g. a total or headline number).
   */
  highlight?: boolean;
};

/**
 * Right-aligned numeric cell with tabular figures, for metric and summary
 * tables. Defaults to `compact` height to match those layouts; pass `highlight`
 * for the emphasized column.
 */
export function DataListNumberCell({
  children,
  className,
  highlight,
  height = 'compact',
  ...rest
}: DataListNumberCellProps) {
  return (
    <DataListCell
      height={height}
      className={cn(
        'justify-items-end text-right text-ui-sm tabular-nums',
        highlight ? 'font-semibold text-neutral4' : 'text-neutral3',
        className,
      )}
      {...rest}
    >
      {children}
    </DataListCell>
  );
}

function getShortId(id: string | undefined): string {
  if (!id) return '';
  return id.length > 8 ? id.slice(0, 8) : id;
}

export interface DataListIdCellProps {
  id: string;
}

export function DataListIdCell({ id }: DataListIdCellProps) {
  return (
    <DataListCell height="compact" className="font-mono text-ui-smd text-neutral3">
      {getShortId(id)}
    </DataListCell>
  );
}

export interface DataListSelectCellProps {
  checked: boolean;
  /**
   * Called when the checkbox is clicked. Receives the click event's `shiftKey`
   * so callers can implement range-select. The event's propagation is stopped
   * before `onToggle` runs, so the host row's `onClick` doesn't fire.
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
      height="compact"
      className={cn(
        'size-8 justify-items-center self-center overflow-visible px-0 py-0!',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
      onClick={e => e.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={() => {}} // no-op: selection handled by onClick to capture shiftKey
        onClick={e => {
          e.stopPropagation();
          // Base UI's Checkbox.Root is a `<span>`, so clicks still fire while
          // disabled — guard here instead of relying on `:disabled` semantics.
          if (disabled) return;
          onToggle(e.shiftKey);
        }}
        aria-label={rest['aria-label']}
      />
    </DataListCell>
  );
}

export interface DataListMonoCellProps {
  children: ReactNode;
  /** Override classes on the inner span (e.g. swap the default `text-neutral3` tone). */
  className?: string;
  /** Cell vertical padding. Defaults to `compact` to match other identifier cells. */
  height?: 'default' | 'compact';
}

/**
 * Mono-typography cell with truncation. Shared by any column that
 * shows code-like text (input previews, JSON summaries, identifiers, etc.).
 */
export function DataListMonoCell({ children, className, height = 'compact' }: DataListMonoCellProps) {
  return (
    <DataListCell height={height}>
      <span
        className={cn(
          'block max-w-full min-w-0 truncate font-mono text-ui-smd text-neutral3 empty:before:content-["—"]',
          className,
        )}
      >
        {children}
      </span>
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
    <DataListCell height="compact" className="text-ui-smd text-neutral2">
      {date ? (isToday(date) ? 'Today' : format(date, 'MMM dd')) : null}
    </DataListCell>
  );
}

export interface DataListTimeCellProps {
  timestamp: Date | string;
}

/** Compact monospace time cell — `HH:mm:ss.SSS` with the millisecond portion tinted. */
export function DataListTimeCell({ timestamp }: DataListTimeCellProps) {
  const date = toDate(timestamp);
  return (
    <DataListCell height="compact" className="flex font-mono text-ui-smd text-neutral3">
      {date ? (
        <>
          {format(date, 'HH:mm:ss')}
          <span className="text-neutral2">.{String(date.getMilliseconds()).padStart(3, '0')}</span>
        </>
      ) : null}
    </DataListCell>
  );
}
