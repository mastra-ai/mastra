import { Fragment, useState } from 'react';
import type { ElementType } from 'react';
import { ScrollArea } from '@/ds/components/ScrollArea/scroll-area';
import { cn } from '@/lib/utils';

type Column<T> = {
  label: string;
  value: (row: T) => string | number;
  highlight?: boolean;
};

export function MetricsDataTable<T extends { key: string }>({
  columns,
  data,
  className,
  getRowHref,
  LinkComponent = 'a',
}: {
  columns: Column<T>[];
  data: T[];
  className?: string;
  /** If provided and returns a non-null string, the row is rendered as a link to that URL. */
  getRowHref?: (row: T) => string | undefined;
  /** Override how `getRowHref` links are rendered. Receives `href`, `className`,
   *  `onFocus`, `onBlur`, `onMouseEnter`, `onMouseLeave`, and `children`.
   *  Defaults to a plain `<a>`; pass an adapter (e.g. for react-router or
   *  next/link) to keep navigation in-app. */
  LinkComponent?: ElementType;
}) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  if (columns.length === 0) return null;

  return (
    <ScrollArea className={cn('w-full h-full', className)} maxHeight="20rem" orientation="both">
      <div
        className="grid items-center"
        style={{
          gridTemplateColumns: `auto ${columns
            .slice(1)
            .map(() => 'auto')
            .join(' ')}`,
        }}
      >
        {/* Header */}
        {columns.map((col, i) => (
          <span
            key={`${i}-${col.label}`}
            className={cn(
              'h-9 py-1 flex items-center border-b border-surface5 uppercase whitespace-nowrap text-neutral2 tracking-widest text-ui-xs sticky top-0 z-10 bg-surface2',
              i === 0
                ? 'text-left sticky left-0 z-20 bg-surface2 pr-4 after:absolute after:right-1 after:top-1/2 after:-translate-y-1/2 after:h-3/5 after:w-px after:bg-surface5'
                : 'px-4 text-right',
            )}
          >
            {col.label}
          </span>
        ))}

        {/* Data rows */}
        {data.map((row, rowIndex) => {
          const href = getRowHref?.(row);
          const isHovered = hoveredRow === row.key;
          const rowHandlers = href
            ? {
                onMouseEnter: () => setHoveredRow(row.key),
                onMouseLeave: () => setHoveredRow(prev => (prev === row.key ? null : prev)),
              }
            : undefined;
          return (
            <Fragment key={row.key}>
              {columns.map((col, i) => {
                const cellClasses = cn(
                  'h-10 flex items-center text-ui-sm whitespace-nowrap border-t border-surface5',
                  rowIndex === 0 && 'border-t-transparent',
                  i === 0
                    ? 'text-left text-neutral3 sticky left-0 z-10 bg-surface2 pr-4 after:absolute after:right-1 after:top-1/2 after:-translate-y-1/2 after:h-3/5 after:w-px after:bg-surface5'
                    : cn(
                        'px-4 text-right tabular-nums',
                        col.highlight ? 'text-neutral4 font-semibold' : 'text-neutral3',
                      ),
                  href && 'cursor-pointer outline-none transition-colors',
                  href && isHovered && 'bg-surface3',
                );

                if (href) {
                  return (
                    <LinkComponent
                      key={`${row.key}-${i}`}
                      href={href}
                      className={cellClasses}
                      onFocus={() => setHoveredRow(row.key)}
                      onBlur={() => setHoveredRow(prev => (prev === row.key ? null : prev))}
                      {...rowHandlers}
                    >
                      {col.value(row)}
                    </LinkComponent>
                  );
                }
                return (
                  <span key={`${row.key}-${i}`} className={cellClasses}>
                    {col.value(row)}
                  </span>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </ScrollArea>
  );
}
