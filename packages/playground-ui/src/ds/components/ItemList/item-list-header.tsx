import { getColumnTemplate } from './shared';
import { Column } from './types';

import { cn } from '@/lib/utils';

export type ItemListHeaderProps = {
  columns?: Column[];
  children?: React.ReactNode;
};

export function ItemListHeader({ columns, children }: ItemListHeaderProps & { children?: React.ReactNode }) {
  return (
    <div className={cn('sticky top-0 bg-surface3 z-10 rounded-lg px-4 mb-4')}>
      <div
        className={cn('grid gap-6 text-left uppercase py-3 text-neutral3 tracking-widest text-ui-xs')}
        style={{ gridTemplateColumns: getColumnTemplate(columns) }}
      >
        {children}
        {/*
         {columns?.map(col => (
          <span key={col.name}>{col.label || col.name}</span>
        ))} 
         */}
      </div>
    </div>
  );
}
