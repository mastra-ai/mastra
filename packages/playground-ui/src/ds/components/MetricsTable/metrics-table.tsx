import { useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { FOCUS, MetricsTableHeaderLabel } from './metrics-table-header';
import type { MetricsTableColumn, MetricsTableProps, MetricsTableSort } from './metrics-table-types';
import { ScrollArea } from '@/ds/components/ScrollArea/scroll-area';
import { Skeleton } from '@/ds/components/Skeleton';
import { TablePagination } from '@/ds/components/Table/table-pagination';
import { cn } from '@/lib/utils';

/**
 * Full-width lines that fade over their last 6px. A hovered row covers the lines above and below
 * it, which then fade over 24px so they read as part of the hover; the header line does the same
 * when the first row is hovered. Written out in full so Tailwind finds every class.
 */
const HEADER_LINE =
  'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border after:[mask-image:linear-gradient(to_right,transparent,black_6px,black_calc(100%-6px),transparent)] [&:has(+:hover)]:after:[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]';
const ROW_LINE =
  'isolate before:absolute before:inset-x-0 before:-top-px before:bottom-0 before:-z-10 before:rounded hover:before:bg-fill-subtle after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border last:after:hidden after:[mask-image:linear-gradient(to_right,transparent,black_6px,black_calc(100%-6px),transparent)] hover:after:[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)] [&:has(+:hover)]:after:[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]';

/**
 * Clicks on a column cycle its first direction, the other one, then off: off goes back to the
 * table's default order. Another column starts at its own first direction.
 */
function nextSort<Row>(
  current: MetricsTableSort | undefined,
  column: MetricsTableColumn<Row>,
): MetricsTableSort | undefined {
  const first = column.firstDirection ?? 'desc';
  if (current?.column !== column.id) return { column: column.id, direction: first };
  return current.direction === first ? { column: column.id, direction: first === 'desc' ? 'asc' : 'desc' } : undefined;
}

/** Controls a cell can hold; their own clicks and keys don't count as the row's. */
const CONTROLS = 'a, button, input, select, textarea, label, [role="button"], [role="link"], [contenteditable]';

/** Whether an event started on a control inside the row rather than on the row itself. */
const fromControl = (event: MouseEvent | KeyboardEvent) => {
  const control = event.target instanceof Element ? event.target.closest(CONTROLS) : null;
  return control !== null && event.currentTarget.contains(control);
};

/**
 * A column's grid track. Figures take a share of the spare width, like an HTML table's auto
 * layout: never narrower than their values, wider when the card has room.
 */
const columnWidth = <Row,>(column: MetricsTableColumn<Row>) =>
  column.width ?? (column.align === 'end' ? 'minmax(max-content,1fr)' : 'max-content');

/**
 * Rows are 34.5px: 7px above 13px text (a 19.5px line) and 8px below, one more pixel for the
 * separator drawn in the row's last pixel, so text sits centered between the lines. The column gap
 * is the least space between columns: most of the room between figures comes from their `fr`
 * share, so it grows and shrinks with the card.
 */
const ROW_PADDING = 'pt-1.75 pb-2';

/** Skeleton widths for the first column's names, so loading rows don't look stamped. */
const SKELETON_NAMES = ['w-32', 'w-24', 'w-36', 'w-20', 'w-28'];

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

function sortRows<Row>(rows: Row[], columns: MetricsTableColumn<Row>[], sort: MetricsTableSort | undefined) {
  const by = columns.find(c => c.id === sort?.column)?.sortValue;
  if (!sort || !by) return rows;
  return [...rows].sort((a, b) => {
    const x = by(a);
    const y = by(b);
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1;
    const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return sort.direction === 'desc' ? -d : d;
  });
}

/**
 * A table for the numbers behind a chart: one row per series or group, columns for its figures,
 * separated by lines that fade at the ends. With `SeriesMark` and `Sparkline` cells and the row
 * hover and click hooks it doubles as the chart's legend; without them it's a plain data table.
 * With `pageSize` it pages long lists. For a share of a total, a compact `ShareBar` fits better.
 */
export function MetricsTable<Row>({
  columns,
  rows,
  getRowKey,
  sort,
  defaultSort,
  onSortChange,
  onRowClick,
  onRowHover,
  isRowDimmed,
  isRowActive,
  rowTitle,
  empty,
  pageSize,
  isLoading = false,
  'aria-label': ariaLabel,
  className,
}: MetricsTableProps<Row>) {
  const [ownSort, setOwnSort] = useState(defaultSort);
  const [page, setPage] = useState(0);
  const current = sort ?? ownSort;
  const sorted = sortRows(rows, columns, current);
  const pageCount = pageSize ? Math.ceil(sorted.length / pageSize) : 1;
  // Fewer rows than before (a narrower filter) keeps the last page rather than an empty one.
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const shown = pageSize ? sorted.slice(safePage * pageSize, (safePage + 1) * pageSize) : sorted;
  const template = { gridTemplateColumns: columns.map(columnWidth).join(' ') };

  const sortBy = (column: MetricsTableColumn<Row>) => {
    const next = nextSort(current, column) ?? defaultSort;
    setOwnSort(next);
    setPage(0);
    onSortChange?.(next);
  };

  return (
    <div className={cn('grid min-w-0 gap-3', className)}>
      {/* Narrower than its content (a phone), the table scrolls sideways instead of squeezing columns or the page. */}
      <ScrollArea orientation="horizontal">
        {/* One set of column tracks for the header and every row (each row is a subgrid), so a column's
            width follows its widest cell in the whole table and headers sit over their cells. */}
        <div
          role="table"
          aria-label={ariaLabel}
          // min-content, not max-content: a long name would otherwise grow every `fr` column with it.
          className="grid min-w-min gap-x-4"
          style={template}
        >
          <div
            role="row"
            className={cn(
              'relative col-span-full grid grid-cols-subgrid items-end px-3 text-body-sm font-medium text-placeholder',
              'pb-1.5',
              HEADER_LINE,
            )}
          >
            {columns.map(column => {
              const sorted = current?.column === column.id ? current.direction : undefined;
              const end = column.align === 'end';
              return (
                <div
                  key={column.id}
                  role="columnheader"
                  aria-sort={sorted && ARIA_SORT[sorted]}
                  className={cn('flex min-w-0 items-center gap-1', end && 'justify-end text-right')}
                >
                  <MetricsTableHeaderLabel
                    header={column.header}
                    description={column.description}
                    sorted={sorted}
                    onSort={column.sortValue ? () => sortBy(column) : undefined}
                  />
                </div>
              );
            })}
          </div>
          {isLoading &&
            Array.from({ length: pageSize ?? 5 }, (_, i) => (
              <div
                key={i}
                role="row"
                aria-busy
                className={cn(
                  'relative col-span-full grid grid-cols-subgrid items-center px-3 text-body-sm',
                  ROW_PADDING,
                  ROW_LINE,
                )}
              >
                {columns.map((column, c) => (
                  <div
                    key={column.id}
                    role="cell"
                    className={cn('relative flex min-w-0', column.align === 'end' && 'justify-end')}
                  >
                    {/* A zero-width space gives the cell a real line box, so loading rows match loaded ones. */}
                    {'\u200b'}
                    <Skeleton
                      className={cn(
                        'absolute top-1/2 h-3.5 -translate-y-1/2',
                        column.align === 'end' ? 'right-0 w-10' : 'left-0',
                        column.align !== 'end' && (c === 0 ? SKELETON_NAMES[i % SKELETON_NAMES.length] : 'w-16'),
                      )}
                    />
                  </div>
                ))}
              </div>
            ))}
          {!isLoading &&
            shown.map(row => {
              const onClick = (e: MouseEvent) => {
                if (!fromControl(e)) onRowClick?.(row);
              };
              const onKeyDown = (e: KeyboardEvent) => {
                // Only while the row itself has focus, so a cell's link or input keeps its keys.
                if (e.target !== e.currentTarget) return;
                if (e.key !== 'Enter' && e.key !== ' ') return;
                // Space would also scroll the page.
                e.preventDefault();
                onRowClick?.(row);
              };
              return (
                <div
                  key={getRowKey(row)}
                  role="row"
                  aria-current={isRowActive?.(row) || undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  title={rowTitle?.(row)}
                  onClick={onRowClick ? onClick : undefined}
                  onKeyDown={onRowClick ? onKeyDown : undefined}
                  onMouseEnter={onRowHover ? () => onRowHover(row) : undefined}
                  onMouseLeave={onRowHover ? () => onRowHover(undefined) : undefined}
                  className={cn(
                    // The separator is drawn inside the row's bottom edge; one more pixel below keeps the
                    // content centered between the lines above and below it.
                    'relative col-span-full grid grid-cols-subgrid items-center rounded px-3 text-body-sm text-foreground transition-opacity duration-150',
                    ROW_PADDING,
                    ROW_LINE,
                    onRowClick && cn('cursor-pointer', FOCUS),
                    isRowActive?.(row) && 'before:bg-fill-subtle',
                    isRowDimmed?.(row) && 'opacity-40',
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
            })}
          {!isLoading && shown.length === 0 && empty !== undefined && empty !== null ? (
            <div role="row" className="col-span-full">
              <p role="cell" className="py-8 text-center text-body-sm text-muted-foreground">
                {empty}
              </p>
            </div>
          ) : null}
        </div>
      </ScrollArea>
      {!isLoading && pageCount > 1 && <TablePagination page={safePage} pageCount={pageCount} onPageChange={setPage} />}
    </div>
  );
}
