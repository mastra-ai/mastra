import { useLayoutEffect } from 'react';
import type { ReactNode } from 'react';
import { FilterBarDraftSegment } from './animation/filter-bar-draft-segment';
import type { FilterDraftMotion } from './animation/use-filter-draft-motion';
import { FilterBarFieldLabel, fieldSegmentAccentStyle } from './filter-bar-chip';
import type { FilterBarField, FilterBarOperator } from './types';

export type FilterBarDraftChipProps = {
  field: FilterBarField | undefined;
  operator: FilterBarOperator | undefined;
  selectedValueLabel?: string;
  children: ReactNode;
  motion: FilterDraftMotion;
};

export function FilterBarDraftChip({ field, operator, selectedValueLabel, children, motion }: FilterBarDraftChipProps) {
  useLayoutEffect(() => motion.play(), [field, operator, selectedValueLabel, motion]);
  return (
    <div
      ref={motion.registerRoot}
      data-slot="filter-bar-inline-draft"
      className="flex max-w-full min-w-0 items-stretch"
    >
      {field && (
        <span aria-hidden data-slot="filter-bar-draft-chip" className="flex min-w-0 items-stretch">
          <FilterBarDraftSegment
            ref={element => motion.registerSegment('field', element)}
            style={fieldSegmentAccentStyle(field)}
          >
            <FilterBarFieldLabel field={field} />
          </FilterBarDraftSegment>
          {operator && (
            <FilterBarDraftSegment ref={element => motion.registerSegment('operator', element)} joined>
              <span className="truncate">{operator.label}</span>
            </FilterBarDraftSegment>
          )}
          {selectedValueLabel !== undefined && (
            <FilterBarDraftSegment ref={element => motion.registerSegment('value', element)} joined>
              <span className="truncate">{selectedValueLabel}</span>
            </FilterBarDraftSegment>
          )}
        </span>
      )}
      {children}
    </div>
  );
}
