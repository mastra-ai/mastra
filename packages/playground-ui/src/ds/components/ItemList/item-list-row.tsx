import { cn } from '@/lib/utils';
import { transitions } from '@/ds/primitives/transitions';
import { ItemListColumn } from './types';
import { getItemListColumnTemplate } from './shared';

export type ItemListRowProps = {
  isSelected?: boolean;
  children?: React.ReactNode;
  columns?: ItemListColumn[];
  className?: string;
};

export function ItemListRow({ isSelected, children, columns, className }: ItemListRowProps) {
  return (
    <li
      className={cn(
        'flex border border-transparent py-[3px] pb-[2px] text-neutral5 border-t-surface5 rounded-lg first:border-t-transparent text-ui-md overflow-hidden',
        '[&:last-child>button]:rounded-b-lg',
        '[&.selected-row]:border-white/50 [&.selected-row]:pr-[3px] [&.selected-row]:border-dashed [&.selected-row]:border [&.selected-row]:first:border-t',
        '[&:has(+.selected-row)]:rounded-b-none [&:has(+.selected-row)]:border-b-transparent',
        '[.selected-row+&]:rounded-t-none',
        transitions.colors,
        {
          'selected-row': isSelected,
          'grid px-4 gap-4 ': columns,
        },
        className,
      )}
      style={{ gridTemplateColumns: getItemListColumnTemplate(columns) }}
    >
      {children}
    </li>
  );
}
