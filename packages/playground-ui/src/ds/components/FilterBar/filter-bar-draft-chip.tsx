import type { ReactNode } from 'react';
import { FilterBarDraftSegment } from './animation/filter-bar-draft-segment';
import { FilterBarFieldLabel, fieldSegmentAccentStyle } from './filter-bar-chip';
import type { FilterBarField, FilterBarOperator } from './types';

export type FilterBarDraftChipProps = {
  field: FilterBarField | undefined;
  operator: FilterBarOperator | undefined;
  selectedValueLabel?: string;
  children: ReactNode;
};

export function FilterBarDraftChip({ field, operator, selectedValueLabel, children }: FilterBarDraftChipProps) {
  return (
    <div className="flex max-w-full min-w-0 items-stretch">
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
      {children}
    </div>
  );
}
