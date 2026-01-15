import { getColumnTemplate } from './shared';
import { Column } from './types';

import { cn } from '@/lib/utils';

export type EntryListHeaderProps = {
  columns?: Column[];
};

export function EntryListHeader({ columns }: EntryListHeaderProps) {
  return (
    <div className={cn('sticky top-0 bg-surface4 z-[1] rounded-t-lg px-[1.5rem]')}>
      <div
        className={cn('grid gap-[1.5rem] text-left uppercase py-[.75rem] text-neutral3 text-ui-sm')}
        style={{ gridTemplateColumns: getColumnTemplate(columns) }}
      >
        {columns?.map(col => (
          <span key={col.name}>{col.label || col.name}</span>
        ))}
      </div>
    </div>
  );
}
