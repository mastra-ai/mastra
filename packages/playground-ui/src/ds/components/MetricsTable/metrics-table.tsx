import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { MetricsTableColumn, MetricsTableProps, MetricsTableSort } from './metrics-table-types';
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

const FOCUS =
  'focus-visible:outline-1 focus-visible:outline-solid focus-visible:outline-border-focus focus-visible:-outline-offset-1';

function sortRows<Row>(rows: Row[], columns: MetricsTableColumn<Row>[], sort: MetricsTableSort | undefined) {
  const by = columns.find(c => c.id === sort?.column)?.sortValue;
  if (!sort || !by) return rows;
  return [...rows].sort((a, b) => {
    const x = by(a);
    const y = by(b);
    const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
    return sort.direction === 'desc' ? -d : d;
  });
}

/**
 * A table for the numbers behind a chart: one row per series or group, columns for its figures,
 * separated by lines that fade at the ends. With `SeriesMark` and `Sparkline` cells and the row
 * hover and click hooks it doubles as the chart's legend; without them it's a plain data table.
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
  rowTitle,
  empty,
  'aria-label': ariaLabel,
  className,
}: MetricsTableProps<Row>) {
  const [ownSort, setOwnSort] = useState(defaultSort);
  const current = sort ?? ownSort;
  const shown = sortRows(rows, columns, current);
  const template = { gridTemplateColumns: columns.map(c => c.width ?? 'max-content').join(' ') };

  const sortBy = (column: MetricsTableColumn<Row>) => {
    const direction =
      current?.column === column.id
        ? current.direction === 'desc'
          ? 'asc'
          : 'desc'
        : (column.firstDirection ?? 'desc');
    const next = { column: column.id, direction } as const;
    setOwnSort(next);
    onSortChange?.(next);
  };

  return (
    <div role="table" aria-label={ariaLabel} className={cn('grid', className)}>
      <div
        role="row"
        className={cn('relative grid items-end gap-3 px-3 pb-2 text-body-sm font-medium text-placeholder', HEADER_LINE)}
        style={template}
      >
        {columns.map(column => {
          const sorted = current?.column === column.id ? current.direction : undefined;
          const end = column.align === 'end';
          return (
            <div
              key={column.id}
              role="columnheader"
              aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
              className={cn('flex min-w-0', end && 'justify-end text-right')}
            >
              {column.sortValue ? (
                <button
                  type="button"
                  onClick={() => sortBy(column)}
                  className={cn('flex items-center gap-1 rounded whitespace-nowrap hover:text-muted-foreground', FOCUS)}
                >
                  {column.header}
                  {sorted === 'desc' ? (
                    <ArrowDownIcon aria-hidden className="size-3" />
                  ) : sorted === 'asc' ? (
                    <ArrowUpIcon aria-hidden className="size-3" />
                  ) : null}
                </button>
              ) : (
                <span className="whitespace-nowrap">{column.header}</span>
              )}
            </div>
          );
        })}
      </div>
      {shown.map(row => {
        const onKeyDown = (e: KeyboardEvent) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          // Space would also scroll the page.
          e.preventDefault();
          onRowClick?.(row);
        };
        return (
          <div
            key={getRowKey(row)}
            role="row"
            tabIndex={onRowClick ? 0 : undefined}
            title={rowTitle?.(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={onRowClick ? onKeyDown : undefined}
            onMouseEnter={onRowHover ? () => onRowHover(row) : undefined}
            onMouseLeave={onRowHover ? () => onRowHover(undefined) : undefined}
            className={cn(
              'relative grid items-center gap-3 rounded px-3 py-2 text-body-sm text-foreground transition-opacity duration-150',
              ROW_LINE,
              onRowClick && cn('cursor-pointer', FOCUS),
              isRowDimmed?.(row) && 'opacity-40',
            )}
            style={template}
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
      {shown.length === 0 && empty ? (
        <p className="py-8 text-center text-body-sm text-muted-foreground">{empty}</p>
      ) : null}
    </div>
  );
}
