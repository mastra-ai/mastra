import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';
import { Icon } from '../../icons/Icon';
import { controlStateColorTransition, focusRingOffset } from '../../primitives/transitions';

export type TableSortDirection = 'ascending' | 'descending' | 'none';

export type TableSortButtonProps = Omit<ComponentProps<'button'>, 'type'> & {
  direction?: TableSortDirection;
};

const sortIcons = {
  ascending: ArrowUp,
  descending: ArrowDown,
  none: ArrowUpDown,
} satisfies Record<TableSortDirection, LucideIcon>;

export function TableSortButton({ direction = 'none', className, children, ...props }: TableSortButtonProps) {
  const SortIcon = sortIcons[direction];
  const sorted = direction !== 'none';
  return (
    <button
      type="button"
      data-slot="table-sort-button"
      data-sorted={sorted || undefined}
      className={cn(
        'group/sort inline-flex cursor-pointer items-center gap-1 rounded-sm align-middle',
        'group-data-[align=end]/head:flex-row-reverse',
        'hover:text-foreground data-sorted:text-foreground',
        controlStateColorTransition,
        focusRingOffset,
        className,
      )}
      {...props}
    >
      {children}
      <Icon
        size="sm"
        aria-hidden
        className={cn(
          !sorted &&
            'opacity-0 group-hover/sort:opacity-100 group-focus-visible/sort:opacity-100 pointer-coarse:opacity-100',
        )}
      >
        <SortIcon />
      </Icon>
    </button>
  );
}
