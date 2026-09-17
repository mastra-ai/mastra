import type { ReactNode } from 'react';
import styles from './animation/filter-bar-animation.module.css';
import { FilterBarDraftSegment } from './animation/filter-bar-draft-segment';
import { FilterBarFieldLabel, fieldSegmentAccentStyle } from './filter-bar-chip';
import type { FilterBarField, FilterBarOperator } from './types';
import { cn } from '@/lib/utils';

export type FilterBarDraftChipProps = {
  field: FilterBarField | undefined;
  operator: FilterBarOperator | undefined;
  selectedValueLabel?: string;
  children: ReactNode;
};

export function FilterBarDraftChip({ field, operator, selectedValueLabel, children }: FilterBarDraftChipProps) {
  return (
    <div className={cn('flex min-w-0 grow items-stretch', field ? 'basis-64' : 'basis-32')}>
      {field && (
        <span aria-hidden data-slot="filter-bar-draft-chip" className="flex min-w-0 items-stretch">
          <FilterBarDraftSegment style={fieldSegmentAccentStyle(field)}>
            <FilterBarFieldLabel field={field} />
          </FilterBarDraftSegment>
          {operator && (
            <FilterBarDraftSegment joined>
              <span className="truncate">{operator.label}</span>
            </FilterBarDraftSegment>
          )}
          {selectedValueLabel !== undefined && (
            <FilterBarDraftSegment joined>
              <span className="truncate">{selectedValueLabel}</span>
            </FilterBarDraftSegment>
          )}
        </span>
      )}
      <span className={cn('flex h-form-md min-w-24 flex-1 items-center', field && styles.pendingInput)}>
        {children}
      </span>
    </div>
  );
}
