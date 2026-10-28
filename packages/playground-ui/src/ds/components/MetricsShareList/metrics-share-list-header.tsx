import { FIXED_LABEL } from './metrics-share-list-classes';
import type {
  MetricsShareListColumn,
  MetricsShareListHeaderProps,
  MetricsShareListSort,
} from './metrics-share-list-types';
import { InfoTooltip } from '@/ds/components/Tooltip';
import { cn } from '@/lib/utils';

type HeaderCell = Pick<MetricsShareListColumn, 'label' | 'sortKey' | 'align' | 'description'> & { width: string };

/** Column headers, aligned to the list's columns. Sortable when given `onSortChange`. */
export function MetricsShareListHeader({
  columns = [],
  valueLabel,
  valueWidth = 'w-14',
  valueSortKey,
  valueDescription,
  showShare = true,
  showStrip = true,
  sort,
  onSortChange,
  className,
}: MetricsShareListHeaderProps) {
  const sortable = Boolean(onSortChange);
  const left = columns.filter(c => c.align === 'left').map(c => ({ ...c, width: c.width ?? 'w-16' }));
  const cells: HeaderCell[] = [
    ...columns.filter(c => c.align !== 'left').map(c => ({ ...c, width: c.width ?? 'w-16' })),
    ...(showShare ? [{ label: 'Share', width: 'w-12' }] : []),
    { label: valueLabel, width: valueWidth, sortKey: valueSortKey, description: valueDescription },
  ];
  return (
    <div
      aria-hidden={sortable || cells.some(c => c.description !== undefined) ? undefined : true}
      role={sortable ? 'row' : undefined}
      className={cn(
        'flex shrink-0 items-center gap-3 text-column text-placeholder',
        left.length > 0 && 'w-full',
        className,
      )}
    >
      {left.length > 0 && (
        <>
          {/* Under the row's swatch and label, so left-aligned headers sit over their cells. */}
          {showStrip && <span aria-hidden className="size-2 shrink-0" />}
          <span aria-hidden className={FIXED_LABEL} />
          {left.map(cell => (
            <HeaderCellView key={cell.label} cell={cell} sort={sort} onSortChange={onSortChange} />
          ))}
          <span aria-hidden className="flex-1" />
        </>
      )}
      {cells.map(cell => (
        <HeaderCellView key={cell.label} cell={cell} sort={sort} onSortChange={onSortChange} />
      ))}
    </div>
  );
}

function HeaderCellView({
  cell: { label, width, sortKey, align = 'right', description },
  sort,
  onSortChange,
}: {
  cell: HeaderCell;
  sort?: MetricsShareListSort;
  onSortChange?: (sort: MetricsShareListSort) => void;
}) {
  const left = align === 'left';
  const active = sortKey !== undefined && sort?.key === sortKey;
  const direction = active ? sort.direction : undefined;
  return (
    <span
      role={onSortChange ? 'columnheader' : undefined}
      aria-sort={sortKey && onSortChange ? (direction ?? 'none') : undefined}
      className={cn('flex shrink-0 items-center gap-1', left ? 'justify-start' : 'justify-end', width)}
    >
      <HeaderTitle label={label} left={left} sortKey={sortKey} direction={direction} onSortChange={onSortChange} />
      {description && (
        <InfoTooltip aria-label={`About ${label}`} contentClassName="max-w-72">
          {description}
        </InfoTooltip>
      )}
    </span>
  );
}

/** The header's text, or a sort button when the column sorts. */
function HeaderTitle({
  label,
  left,
  sortKey,
  direction,
  onSortChange,
}: {
  label: string;
  left: boolean;
  sortKey?: string;
  direction?: MetricsShareListSort['direction'];
  onSortChange?: (sort: MetricsShareListSort) => void;
}) {
  if (!sortKey || !onSortChange) return label;
  const next: MetricsShareListSort = {
    key: sortKey,
    direction: direction === 'descending' ? 'ascending' : 'descending',
  };
  return (
    <button
      type="button"
      onClick={() => onSortChange(next)}
      className={cn(
        'whitespace-nowrap',
        left ? 'text-left' : 'text-right',
        'hover:text-muted-foreground',
        direction && 'text-muted-foreground',
      )}
    >
      {label}
      {direction && <span aria-hidden>{direction === 'descending' ? ' ↓' : ' ↑'}</span>}
    </button>
  );
}
