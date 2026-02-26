import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';
import { ItemListColumn } from './types';
import { getItemListColumnTemplate } from './shared';

export type ItemListRowProps = {
  isSelected?: boolean;
  children?: React.ReactNode;
  columns?: ItemListColumn[];
};

export function ItemListRow({ isSelected, children, columns }: ItemListRowProps) {
  return (
    <li
      className={cn(
        'flex border border-transparent py-[3px] pb-[2px] text-neutral5 border-t-border1 rounded-lg first:border-t-transparent text-ui-md overflow-hidden',
        '[&:last-child>button]:rounded-b-lg',
        '[&.selected-row]:border-white/50 [&.selected-row]:pr-[3px] [&.selected-row]:border-dashed [&.selected-row]:border [&.selected-row]:first:border-t',
        '[&:has(+.selected-row)]:rounded-b-none [&:has(+.selected-row)]:border-b-transparent',
        '[.selected-row+&]:rounded-t-none',
        transitions.colors,
        {
          'selected-row': isSelected,
          grid: columns,
        },
      )}
      style={{ gridTemplateColumns: getItemListColumnTemplate(columns) }}
    >
      {children}
    </li>
  );
}
