import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { DataListTopCell } from './data-list-top-cell';
import type { DataListTopCellProps } from './data-list-top-cell';
import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

export type DataListSort = 'asc' | 'desc';

const sortIcons = {
  asc: ArrowUp,
  desc: ArrowDown,
  none: ArrowUpDown,
};

const sortLabels = {
  asc: 'ascending',
  desc: 'descending',
};

const sortAnimations = {
  asc: 'animate-sort-arrow-up',
  desc: 'animate-sort-arrow-down',
};

const sortTooltips = {
  asc: 'Asc',
  desc: 'Desc',
  none: 'Sort',
};

export type DataListSortableTopCellProps = Omit<DataListTopCellProps, 'aria-sort' | 'as' | 'children' | 'onClick'> & {
  children: ReactNode;
  sortKey: string;
  sort?: DataListSort;
  onSortChange: (sort: DataListSort, key: string) => void;
  align?: 'start' | 'end';
};

export function DataListSortableTopCell({
  children,
  sortKey,
  sort,
  onSortChange,
  align = 'start',
  className,
  ...props
}: DataListSortableTopCellProps) {
  const next: DataListSort = sort === 'asc' ? 'desc' : 'asc';
  const SortIcon = sortIcons[sort ?? 'none'];
  const label = typeof children === 'string' ? children : sortKey;
  const current = sort ? `sorted ${sortLabels[sort]}` : 'not sorted';

  return (
    <DataListTopCell
      data-sort={sort ?? 'none'}
      className={cn('gap-1 overflow-visible', align === 'end' && 'flex-row-reverse', className)}
      {...props}
    >
      <span className="min-w-0 truncate">{children}</span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`${label}, ${current}, sort ${sortLabels[next]}`}
        tooltip={sortTooltips[sort ?? 'none']}
        onClick={() => onSortChange(next, sortKey)}
        className={cn('shrink-0', sort ? 'text-foreground' : 'text-muted-foreground')}
      >
        <SortIcon key={sort ?? 'none'} className={sort && sortAnimations[sort]} />
      </Button>
    </DataListTopCell>
  );
}
