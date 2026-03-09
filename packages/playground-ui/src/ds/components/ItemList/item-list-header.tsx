import { getItemListColumnTemplate } from './shared';
import { type ItemListColumn } from './types';

import { cn } from '@/lib/utils';

export type ItemListHeaderProps = {
  columns?: ItemListColumn[];
  isSelectionActive?: boolean;
  children?: React.ReactNode;
};

export function ItemListHeader({ columns, isSelectionActive, children }: ItemListHeaderProps) {
  return (
    <div className={cn('sticky top-0 bg-surface3 z-10 rounded-lg px-4 mb-4')}>
      <div
        className={cn('grid gap-4 text-left items-center uppercase  text-neutral3 tracking-widest text-ui-xs', {
          'pl-12 [&>label]:absolute [&>label]:left-0': isSelectionActive,
        })}
        style={{ gridTemplateColumns: getItemListColumnTemplate(columns) }}
      >
        {children}
      </div>
    </div>
  );
}
