import { useState } from 'react';
import { MetricsTableHeaderLabel } from './metrics-table-header';
import { MetricsTableBody } from './metrics-table-rows';
import type { MetricsTableColumn, MetricsTableProps, MetricsTableSort } from './metrics-table-types';
import { ScrollArea } from '@/ds/components/ScrollArea/scroll-area';
import { TablePagination } from '@/ds/components/Table/table-pagination';
import { cn } from '@/lib/utils';

/**
 * A full-width line that fades over its last 6px; over 24px when the first row is hovered, so it
 * reads as part of the hover. Written out in full so Tailwind finds every class.
 */
const HEADER_LINE =
  'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border after:[mask-image:linear-gradient(to_right,transparent,black_6px,black_calc(100%-6px),transparent)] [&:has(+:hover)]:after:[mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]';

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

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
  if (current.direction !== first) return undefined;
  return { column: column.id, direction: first === 'desc' ? 'asc' : 'desc' };
}

/** Ascending order of two present sort values. */
function compareAscending(x: number | string, y: number | string) {
  if (typeof x === 'number' && typeof y === 'number') return x - y;
  return String(x).localeCompare(String(y));
}

function sortRows<Row>(rows: Row[], columns: MetricsTableColumn<Row>[], sort: MetricsTableSort | undefined) {
  const by = columns.find(c => c.id === sort?.column)?.sortValue;
  if (!sort || !by) return rows;
  const sign = sort.direction === 'desc' ? -1 : 1;
  // A row without a value goes last whichever way the column sorts.
  return rows.toSorted((a, b) => {
    const x = by(a);
    const y = by(b);
    if (x === undefined && y === undefined) return 0;
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    return sign * compareAscending(x, y);
  });
}

/**
 * A column's grid track. Figures take a share of the spare width, like an HTML table's auto
 * layout: never narrower than their values, wider when the card has room.
 */
const columnWidth = <Row,>(column: MetricsTableColumn<Row>) =>
  column.width ?? (column.align === 'end' ? 'minmax(max-content,1fr)' : 'max-content');

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
  const showsPagination = !isLoading && pageCount > 1;

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
              'relative col-span-full grid grid-cols-subgrid items-end px-3 pb-1.5 text-body-sm font-medium text-placeholder',
              HEADER_LINE,
            )}
          >
            {columns.map(column => {
              const direction = current?.column === column.id ? current.direction : undefined;
              return (
                <div
                  key={column.id}
                  role="columnheader"
                  aria-sort={direction && ARIA_SORT[direction]}
                  className={cn('flex min-w-0 items-center gap-1', column.align === 'end' && 'justify-end text-right')}
                >
                  <MetricsTableHeaderLabel
                    header={column.header}
                    description={column.description}
                    sorted={direction}
                    onSort={column.sortValue ? () => sortBy(column) : undefined}
                  />
                </div>
              );
            })}
          </div>
          <MetricsTableBody
            columns={columns}
            rows={shown}
            getRowKey={getRowKey}
            onRowClick={onRowClick}
            onRowHover={onRowHover}
            isRowDimmed={isRowDimmed}
            isRowActive={isRowActive}
            rowTitle={rowTitle}
            empty={empty}
            skeletonRows={pageSize ?? 5}
            isLoading={isLoading}
          />
        </div>
      </ScrollArea>
      {showsPagination && <TablePagination page={safePage} pageCount={pageCount} onPageChange={setPage} />}
    </div>
  );
}
