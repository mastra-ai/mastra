import { getColumnTemplate } from './shared';
import { EntryListColumn } from './types';

import { cn } from '@/lib/utils';

export type EntryListHeaderProps = {
  columns?: EntryListColumn[];
};

export function EntryListHeader({ columns }: EntryListHeaderProps) {
  return (
    <div className={cn('sticky top-0 bg-surface4 z-10 rounded-t-lg px-6')}>
      <div
        className={cn('grid gap-6 text-left uppercase py-3 text-neutral3 text-ui-sm')}
        style={{ gridTemplateColumns: getColumnTemplate(columns) }}
      >
        {columns?.map(col => (
          <span key={col.name}>{col.label || col.name}</span>
        ))}
      </div>
    </div>
  );
}
