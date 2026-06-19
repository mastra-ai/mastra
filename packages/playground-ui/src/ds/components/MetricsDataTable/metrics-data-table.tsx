import type { ElementType } from 'react';
import { DataListCell, DataListRowHeaderCell } from '@/ds/components/DataList/data-list-cells';
import { DataListRoot } from '@/ds/components/DataList/data-list-root';
import { DataListRowLink } from '@/ds/components/DataList/data-list-row-link';
import { DataListRowStatic } from '@/ds/components/DataList/data-list-row-static';
import { DataListTop } from '@/ds/components/DataList/data-list-top';
import { DataListTopCell } from '@/ds/components/DataList/data-list-top-cell';
import type { LinkComponent as DataListLinkComponent } from '@/ds/types/link-component';
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
  if (columns.length === 0) return null;

  const gridTemplateColumns = columns.map(() => 'auto').join(' ');
  const RowLinkComponent = LinkComponent as DataListLinkComponent;

  return (
    <DataListRoot columns={gridTemplateColumns} variant="lined" className={cn('max-h-80', className)}>
      <DataListTop>
        {columns.map((col, i) => (
          <DataListTopCell
            key={col.label}
            sticky={i === 0 ? 'start' : undefined}
            className={i === 0 ? 'text-left' : 'justify-end text-right'}
          >
            {col.label}
          </DataListTopCell>
        ))}
      </DataListTop>

      {data.map(row => {
        const href = getRowHref?.(row);
        const rowCells = columns.map((col, i) => {
          const value = col.value(row);
          const columnKey = `${row.key}-${col.label}`;
          if (i === 0) {
            return (
              <DataListRowHeaderCell key={columnKey} height="compact" className="text-ui-sm">
                {value}
              </DataListRowHeaderCell>
            );
          }

          return (
            <DataListCell
              key={columnKey}
              height="compact"
              className={cn(
                'justify-items-end text-right text-ui-sm tabular-nums',
                col.highlight ? 'text-neutral4 font-semibold' : 'text-neutral3',
              )}
            >
              {value}
            </DataListCell>
          );
        });

        return href ? (
          <DataListRowLink key={row.key} to={href} LinkComponent={RowLinkComponent}>
            {rowCells}
          </DataListRowLink>
        ) : (
          <DataListRowStatic key={row.key}>{rowCells}</DataListRowStatic>
        );
      })}
    </DataListRoot>
  );
}
