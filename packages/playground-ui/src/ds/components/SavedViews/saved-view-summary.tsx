import type { ReactNode } from 'react';
import { FilterBarFieldLabel, formatValue } from '@/ds/components/FilterBar/filter-bar-chip';
import { countLeaves, isOperatorImplied, operatorsForField } from '@/ds/components/FilterBar/filter-bar-tree';
import { isFilterBarGroup } from '@/ds/components/FilterBar/types';
import type { FilterBarField, FilterBarNode, FilterBarOperator } from '@/ds/components/FilterBar/types';
import { Txt } from '@/ds/components/Txt';

/** Hover preview of a view: compose `SavedViewSummaryFilters` and `SavedViewSummaryRow` inside it. */
export function SavedViewSummary({ children }: { children: ReactNode }) {
  return <div className="flex min-w-48 flex-col gap-2">{children}</div>;
}

export type SavedViewSummaryFiltersProps = {
  filters: readonly FilterBarNode[];
  fields: readonly FilterBarField[];
  operators: readonly FilterBarOperator[];
};

export function SavedViewSummaryFilters({ filters, fields, operators }: SavedViewSummaryFiltersProps) {
  if (filters.length === 0) {
    return (
      <Txt variant="caption" tone="muted">
        No filters
      </Txt>
    );
  }
  return (
    <ul aria-label="Filters" className="flex flex-col gap-1.5">
      {filters.map((filter, index) => {
        if (isFilterBarGroup(filter)) {
          const count = countLeaves(filter);
          return (
            <li key={filter.id || index} className="min-w-0">
              <Txt as="span" variant="body-sm" className="flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-muted-foreground">Advanced filter</span>
                <span className="min-w-0 truncate">
                  {count} {count === 1 ? 'condition' : 'conditions'}
                </span>
              </Txt>
            </li>
          );
        }
        const field = fields.find(candidate => candidate.id === filter.fieldId);
        const operatorStated = !isOperatorImplied(
          field ? operatorsForField(field, operators) : operators,
          filter.operatorId,
        );
        const operator = operators.find(candidate => candidate.id === filter.operatorId);
        return (
          <li key={filter.id || index} className="min-w-0">
            <Txt as="span" variant="body-sm" className="flex min-w-0 items-center gap-1.5">
              <span className="flex min-w-0 shrink-0 items-center gap-1 text-muted-foreground">
                <FilterBarFieldLabel field={field} label={field?.label ?? filter.fieldId} />
              </span>
              {operatorStated && <span className="shrink-0 text-muted-foreground">{operator?.label}</span>}
              <span className="min-w-0 truncate">{formatValue(filter.value, field)}</span>
            </Txt>
          </li>
        );
      })}
    </ul>
  );
}

export type SavedViewSummaryRowProps = {
  label: string;
  /** What the view holds for this setting. */
  value: string;
};

export function SavedViewSummaryRow({ label, value }: SavedViewSummaryRowProps) {
  return (
    <Txt as="p" variant="body-sm" className="flex min-w-0 items-center gap-1.5">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate">{value}</span>
    </Txt>
  );
}
