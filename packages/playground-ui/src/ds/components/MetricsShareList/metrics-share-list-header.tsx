import type { MetricsShareListHeaderProps, MetricsShareListSort } from './metrics-share-list-types';
import { cn } from '@/lib/utils';

/** Column headers, right-aligned to the list's number columns. Sortable when given `onSortChange`. */
export function MetricsShareListHeader({
  columns = [],
  valueLabel,
  valueWidth = 'w-14',
  valueSortKey,
  sort,
  onSortChange,
  className,
}: MetricsShareListHeaderProps) {
  const sortable = Boolean(onSortChange);
  const cell = (label: string, width: string, sortKey?: string) => {
    if (!sortable) {
      return (
        <span key={label} className={cn('shrink-0 text-right', width)}>
          {label}
        </span>
      );
    }
    return (
      <SortHeader key={label} label={label} width={width} sortKey={sortKey} sort={sort} onSortChange={onSortChange} />
    );
  };
  return (
    <div
      aria-hidden={sortable ? undefined : true}
      role={sortable ? 'row' : undefined}
      className={cn('flex shrink-0 items-center gap-3 text-column text-placeholder', className)}
    >
      {columns.map(c => cell(c.label, c.width ?? 'w-16', c.sortKey))}
      {cell('Share', 'w-12')}
      {cell(valueLabel, valueWidth, valueSortKey)}
    </div>
  );
}

function SortHeader({
  label,
  width,
  sortKey,
  sort,
  onSortChange,
}: {
  label: string;
  width: string;
  sortKey?: string;
  sort?: MetricsShareListSort;
  onSortChange?: (sort: MetricsShareListSort) => void;
}) {
  const active = sortKey !== undefined && sort?.key === sortKey;
  const direction = active ? sort.direction : undefined;
  if (!sortKey || !onSortChange) {
    return (
      <span role="columnheader" className={cn('shrink-0 text-right', width)}>
        {label}
      </span>
    );
  }
  const next: MetricsShareListSort = {
    key: sortKey,
    direction: direction === 'descending' ? 'ascending' : 'descending',
  };
  return (
    <span role="columnheader" aria-sort={direction ?? 'none'} className={cn('shrink-0 text-right', width)}>
      <button
        type="button"
        onClick={() => onSortChange(next)}
        className={cn('w-full text-right hover:text-muted-foreground', active && 'text-muted-foreground')}
      >
        {label}
        {direction && <span aria-hidden>{direction === 'descending' ? ' ↓' : ' ↑'}</span>}
      </button>
    </span>
  );
}
