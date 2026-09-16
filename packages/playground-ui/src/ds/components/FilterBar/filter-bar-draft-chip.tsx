import { segmentClass } from './filter-bar-chip';
import type { FilterBarField, FilterBarOperator } from './types';
import { cn } from '@/lib/utils';

export type FilterBarDraftChipProps = {
  field: FilterBarField | undefined;
  operator: FilterBarOperator | undefined;
};

/**
 * The in-progress filter, accumulated inline next to the input as its segments
 * get picked (`Status` → `Status · is`). Purely presentational: the input owns
 * the draft and handles stepping back (Escape / Backspace).
 */
export function FilterBarDraftChip({ field, operator }: FilterBarDraftChipProps) {
  if (!field) return null;
  return (
    <div
      aria-hidden
      data-slot="filter-bar-draft-chip"
      className={cn(
        'flex h-form-sm max-w-full items-stretch divide-x divide-border1 rounded-full border border-border1 bg-surface3 text-neutral5',
        'rounded-r-none',
      )}
    >
      <span className={cn(segmentClass, 'last:rounded-r-none')}>{field.label}</span>
      {operator && <span className={cn(segmentClass, 'last:rounded-r-none')}>{operator.label}</span>}
    </div>
  );
}
