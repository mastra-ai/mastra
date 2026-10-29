import type { KeyboardEvent, MouseEvent } from 'react';
import { FOCUS } from './metrics-table-header';
import type { MetricsTableColumn, MetricsTableProps } from './metrics-table-types';
import { Skeleton } from '@/ds/components/Skeleton';
import { cn } from '@/lib/utils';

/**
 * Full-width lines that fade over their last 6px. A hovered row covers the lines above and below
 * it, which then fade over 24px so they read as part of the hover. Written out in full so Tailwind
 * finds every class.
 */
const ROW_LINE =
  'isolate before:absolute before:inset-x-0 before:-top-px before:bottom-0 before:-z-10 before:rounded hover:before:bg-fill-subtle after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border last:after:hidden after:[mask-image:linear-gradient(to_right,transparent,black_6px,black_calc(100%-6px),transparent)] hover:after:[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)] [&:has(+:hover)]:after:[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]';

/**
 * Rows are 34.5px: 7px above 13px text (a 19.5px line) and 8px below, one more pixel for the
 * separator drawn in the row's last pixel, so text sits centered between the lines.
 */
const ROW = cn('relative col-span-full grid grid-cols-subgrid items-center px-3 pt-1.75 pb-2 text-body-sm', ROW_LINE);

/** Skeleton widths for the first column's names, so loading rows don't look stamped. */
const SKELETON_NAMES = ['w-32', 'w-24', 'w-36', 'w-20', 'w-28'];

/** Controls a cell can hold; their own clicks and keys don't count as the row's. */
const CONTROLS = 'a, button, input, select, textarea, label, [role="button"], [role="link"], [contenteditable]';

/** Whether an event started on a control inside the row rather than on the row itself. */
function fromControl(event: MouseEvent | KeyboardEvent) {
  if (!(event.target instanceof Element)) return false;
  const control = event.target.closest(CONTROLS);
  return Boolean(control && event.currentTarget.contains(control));
}

/** Where a loading cell's bar sits and how wide it is: figures right, the name in varied widths. */
function skeletonBar<Row>(column: MetricsTableColumn<Row>, columnIndex: number, rowIndex: number) {
  if (column.align === 'end') return 'right-0 w-10';
  if (columnIndex > 0) return 'left-0 w-16';
  return cn('left-0', SKELETON_NAMES[rowIndex % SKELETON_NAMES.length]);
}

type RowBehavior<Row> = Pick<
  MetricsTableProps<Row>,
  'onRowClick' | 'onRowHover' | 'isRowDimmed' | 'isRowActive' | 'rowTitle'
>;

export type MetricsTableBodyProps<Row> = RowBehavior<Row> & {
  columns: MetricsTableColumn<Row>[];
  /** The rows on the current page, sorted. */
  rows: Row[];
  getRowKey: (row: Row) => string;
  empty: MetricsTableProps<Row>['empty'];
  /** Rows drawn while loading. */
  skeletonRows: number;
  isLoading: boolean;
};

/** Skeleton rows while loading, the empty message without rows, else the page's rows. */
export function MetricsTableBody<Row>({
  columns,
  rows,
  getRowKey,
  empty,
  skeletonRows,
  isLoading,
  ...behavior
}: MetricsTableBodyProps<Row>) {
  if (isLoading) {
    return Array.from({ length: skeletonRows }, (_, i) => (
      <MetricsTableSkeletonRow key={i} columns={columns} rowIndex={i} />
    ));
  }
  if (rows.length === 0) {
    if (empty === undefined) return null;
    return (
      <div role="row" className="col-span-full">
        <p role="cell" className="py-8 text-center text-body-sm text-muted-foreground">
          {empty}
        </p>
      </div>
    );
  }
  return rows.map(row => <MetricsTableRow key={getRowKey(row)} row={row} columns={columns} {...behavior} />);
}

/** A loading row: the real row's markup with a bar in each cell, so it has the same height. */
function MetricsTableSkeletonRow<Row>({ columns, rowIndex }: { columns: MetricsTableColumn<Row>[]; rowIndex: number }) {
  return (
    <div role="row" aria-busy className={ROW}>
      {columns.map((column, columnIndex) => (
        <div
          key={column.id}
          role="cell"
          className={cn('relative flex min-w-0', column.align === 'end' && 'justify-end')}
        >
          {/* A zero-width space gives the cell a real line box, so loading rows match loaded ones. */}
          {'​'}
          <Skeleton
            className={cn('absolute top-1/2 h-3.5 -translate-y-1/2', skeletonBar(column, columnIndex, rowIndex))}
          />
        </div>
      ))}
    </div>
  );
}

/** One row: its cells, and with `onRowClick` a focusable row that Enter and Space also click. */
function MetricsTableRow<Row>({
  row,
  columns,
  onRowClick,
  onRowHover,
  isRowDimmed,
  isRowActive,
  rowTitle,
}: RowBehavior<Row> & { row: Row; columns: MetricsTableColumn<Row>[] }) {
  const active = isRowActive?.(row) ?? false;
  const dimmed = isRowDimmed?.(row) ?? false;

  const handleClick = (event: MouseEvent) => {
    if (!fromControl(event)) onRowClick?.(row);
  };
  const handleKeyDown = (event: KeyboardEvent) => {
    // Only while the row itself has focus, so a cell's link or input keeps its keys.
    if (event.target !== event.currentTarget) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    // Space would also scroll the page.
    event.preventDefault();
    onRowClick?.(row);
  };

  return (
    <div
      role="row"
      aria-current={active || undefined}
      tabIndex={onRowClick ? 0 : undefined}
      title={rowTitle?.(row)}
      onClick={onRowClick ? handleClick : undefined}
      onKeyDown={onRowClick ? handleKeyDown : undefined}
      onMouseEnter={onRowHover ? () => onRowHover(row) : undefined}
      onMouseLeave={onRowHover ? () => onRowHover(undefined) : undefined}
      className={cn(
        ROW,
        'rounded text-foreground transition-opacity duration-150',
        onRowClick && cn('cursor-pointer', FOCUS),
        active && 'before:bg-fill-subtle',
        dimmed && 'opacity-40',
      )}
    >
      {columns.map(column => (
        <div
          key={column.id}
          role="cell"
          className={cn('flex min-w-0 items-center', column.align === 'end' && 'justify-end text-right')}
        >
          {column.cell(row)}
        </div>
      ))}
    </div>
  );
}
