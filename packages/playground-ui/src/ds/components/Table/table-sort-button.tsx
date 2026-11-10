import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { IconArrowDown } from '@/ds/icons/central/IconArrowDown';
import { IconArrowUp } from '@/ds/icons/central/IconArrowUp';
import { IconSortArrowUpDown } from '@/ds/icons/central/IconSortArrowUpDown';
import { Icon } from '@/ds/icons/Icon';
import { controlStateColorTransition, focusRingOffset } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type TableSortDirection = 'ascending' | 'descending' | 'none';

export type TableSortButtonProps = Omit<ComponentProps<'button'>, 'type'> & {
  direction?: TableSortDirection;
};

const sortIcons = {
  ascending: IconArrowUp,
  descending: IconArrowDown,
  none: IconSortArrowUpDown,
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
