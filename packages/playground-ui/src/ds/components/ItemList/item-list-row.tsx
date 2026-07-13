import { getItemListColumnTemplate } from './shared';
import type { ItemListColumn } from './types';
import { transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type ItemListRowProps = {
  isSelected?: boolean;
  children?: React.ReactNode;
  columns?: ItemListColumn[];
};

export function ItemListRow({ isSelected, children, columns }: ItemListRowProps) {
  return (
    <li
      className={cn(
        'flex overflow-hidden rounded-lg border border-transparent border-t-border1 py-[3px] pb-[2px] text-ui-md text-neutral5 first:border-t-transparent',
        '[&:last-child>button]:rounded-b-lg',
        '[&.selected-row]:border [&.selected-row]:border-dashed [&.selected-row]:border-white/50 [&.selected-row]:pr-[3px] [&.selected-row]:first:border-t',
        '[&:has(+.selected-row)]:rounded-b-none [&:has(+.selected-row)]:border-b-transparent',
        '[.selected-row+&]:rounded-t-none',
        transitions.colors,
        {
          'selected-row': isSelected,
          'grid px-4 gap-4 ': columns,
        },
      )}
      style={{ gridTemplateColumns: getItemListColumnTemplate(columns) }}
    >
      {children}
    </li>
  );
}
