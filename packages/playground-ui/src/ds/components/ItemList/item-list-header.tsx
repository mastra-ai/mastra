import { getItemListColumnTemplate } from './shared';
import type { ItemListColumn } from './types';

import { cn } from '@/lib/utils';

export type ItemListHeaderProps = {
  columns?: ItemListColumn[];
  isSelectionActive?: boolean;
  children?: React.ReactNode;
};

export function ItemListHeader({ columns, isSelectionActive, children }: ItemListHeaderProps) {
  return (
    <div className={cn('sticky top-0 z-10 mb-4 rounded-lg bg-surface3 px-4')}>
      <div
        className={cn('grid items-center gap-4 text-left text-ui-xs  tracking-widest text-neutral3 uppercase', {
          'pl-12 [&>label]:absolute [&>label]:left-0': isSelectionActive,
        })}
        style={{ gridTemplateColumns: getItemListColumnTemplate(columns) }}
      >
        {children}
      </div>
    </div>
  );
}
