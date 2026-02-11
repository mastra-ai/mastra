import { getItemListColumnTemplate } from './shared';
import { type ItemListColumn } from './types';

import { cn } from '@/lib/utils';

export type ItemListHeaderProps = {
  columns?: ItemListColumn[];
  children?: React.ReactNode;
};

export function ItemListHeader({ columns, children }: ItemListHeaderProps & { children?: React.ReactNode }) {
  return (
    <div className={cn('sticky top-0 bg-surface3 z-10 rounded-lg px-4 mb-4')}>
      <div
        className={cn('grid gap-6 text-left items-center uppercase py-3 text-neutral3 tracking-widest text-ui-xs')}
        style={{ gridTemplateColumns: getItemListColumnTemplate(columns) }}
      >
        {children}
      </div>
    </div>
  );
}
