import { format, isToday } from 'date-fns';
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';
import { Checkbox } from '@/ds/components/Checkbox';
import { cn } from '@/lib/utils';

export type DataListCellProps = {
  children: ReactNode;
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
        'relative grid items-center text-ui-md whitespace-nowrap text-neutral3',
        height === 'compact' ? 'py-2' : 'py-3',
        className,
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function DataListTextCell({ children, className }: DataListCellProps) {
  return <DataListCell className={className}>{children}</DataListCell>;
}

export function DataListNameCell({ children, className }: DataListCellProps) {
  return (
    <DataListCell className={cn('text-left text-neutral4', className)}>
      <span className="truncate">{children}</span>
    </DataListCell>
  );
}

export function DataListDescriptionCell({ children, className }: DataListCellProps) {
  return (
    <DataListCell className={cn('text-neutral2', className)}>
      <span className="truncate">{children}</span>
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
      className="cursor-pointer justify-items-center rounded-lg transition-colors duration-200 hover:bg-surface4 px-4"
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
    <DataListCell height={height} className="min-w-0">
      <span className={cn('block text-ui-smd font-mono text-neutral3 truncate', className)}>{children}</span>
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
      {date ? (isToday(date) ? 'Today' : format(date, 'MMM dd')) : '-'}
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
      ) : (
        '-'
      )}
    </DataListCell>
  );
}
