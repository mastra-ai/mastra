import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { DataListTopCell } from './data-list-top-cell';
import type { DataListTopCellProps } from './data-list-top-cell';
import { focusRing, transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type DataListSortDirection = 'ascending' | 'descending';

const sortIcons = {
  ascending: ArrowUp,
  descending: ArrowDown,
  none: ArrowUpDown,
};

function getNextDirection(
  sortDirection: DataListSortDirection | undefined,
  defaultSortDirection: DataListSortDirection,
) {
  if (!sortDirection) return defaultSortDirection;
  return sortDirection === 'ascending' ? 'descending' : 'ascending';
}

export type DataListSortableTopCellProps = Omit<
  DataListTopCellProps,
  'aria-sort' | 'as' | 'children' | 'onClick' | 'role'
> & {
  children: ReactNode;
  sortDirection?: DataListSortDirection;
  defaultSortDirection?: DataListSortDirection;
  onSortChange: (direction: DataListSortDirection) => void;
  align?: 'start' | 'end';
};

export function DataListSortableTopCell({
  children,
  sortDirection,
  defaultSortDirection = 'ascending',
  onSortChange,
  align = 'start',
  className,
  ...props
}: DataListSortableTopCellProps) {
  const nextDirection = getNextDirection(sortDirection, defaultSortDirection);
  const SortIcon = sortIcons[sortDirection ?? 'none'];
  const currentDirection = sortDirection ? `, sorted ${sortDirection}` : ', not sorted';

  return (
    <DataListTopCell
      as="div"
      data-sort-direction={sortDirection ?? 'none'}
      className={cn('overflow-visible py-0', className)}
      {...props}
    >
      <button
        type="button"
        onClick={() => onSortChange(nextDirection)}
        className={cn(
          'relative flex h-10 w-full touch-manipulation items-center gap-1 overflow-visible rounded-sm outline-none',
          align === 'start' ? 'justify-start text-left' : 'justify-end text-right',
          sortDirection ? 'text-neutral4' : 'text-neutral3',
          'hover:text-neutral4',
          transitions.colors,
          focusRing.visible,
        )}
      >
        <span className="min-w-0 truncate">{children}</span>
        <span className="sr-only">
          {currentDirection}, sort {nextDirection}
        </span>
        <SortIcon aria-hidden="true" className="size-3 shrink-0" />
      </button>
    </DataListTopCell>
  );
}
