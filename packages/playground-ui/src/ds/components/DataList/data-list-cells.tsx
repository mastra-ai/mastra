import { format, isToday } from 'date-fns';
import { Children, cloneElement, isValidElement } from 'react';
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
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
} & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'>;

export function DataListCell({ children, className, height = 'default', as, ...rest }: DataListCellProps) {
  const Component = as || 'span';
  return (
    <Component
      className={cn(
        'relative grid min-w-0 max-w-full items-center overflow-hidden text-ui-md whitespace-nowrap text-neutral3 empty:before:content-["—"] empty:before:text-neutral2',
        height === 'compact' ? 'py-1.5' : 'py-2.5',
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
      className: cn('min-w-0 max-w-full overflow-hidden', child.props.className),
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

function getShortId(id: string | undefined): string {
  if (!id) return '';
  return id.length > 8 ? id.slice(0, 8) : id;
}

export interface DataListIdCellProps {
  id: string;
}

export function DataListIdCell({ id }: DataListIdCellProps) {
  return (
    <DataListCell height="compact" className="text-ui-smd font-mono text-neutral3">
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
  'aria-label'?: string;
}

export function DataListSelectCell({ checked, onToggle, ...rest }: DataListSelectCellProps) {
  return (
    <DataListCell
      as="label"
      height="compact"
      className="h-8 w-8 self-center cursor-pointer justify-items-center overflow-visible px-0 py-0!"
      onClick={e => e.stopPropagation()}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={() => {}} // no-op: selection handled by onClick to capture shiftKey
        onClick={e => {
          e.stopPropagation();
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
          'block min-w-0 max-w-full text-ui-smd font-mono text-neutral3 truncate empty:before:content-["—"]',
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
    <DataListCell height="compact" className="text-ui-smd font-mono text-neutral3 flex">
      {date ? (
        <>
          {format(date, 'HH:mm:ss')}
          <span className="text-neutral2">.{String(date.getMilliseconds()).padStart(3, '0')}</span>
        </>
      ) : null}
    </DataListCell>
  );
}
