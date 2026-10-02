import type { ReactNode } from 'react';
import { FilterBarFieldLabel, formatValue } from '@/ds/components/FilterBar/filter-bar-chip';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@/ds/components/FilterBar/types';
import { Txt } from '@/ds/components/Txt';

type SavedViewSummaryProps = {
  filters: readonly FilterBarItem[];
  fields: readonly FilterBarField[];
  operators: readonly FilterBarOperator[];
  settings?: ReactNode;
};

export function SavedViewSummary({ filters, fields, operators, settings }: SavedViewSummaryProps) {
  return (
    <div className="flex min-w-48 flex-col gap-2">
      {filters.length === 0 ? (
        <Txt variant="caption" tone="muted">
          No filters
        </Txt>
      ) : (
        <ul aria-label="Filters" className="flex flex-col gap-1.5">
          {filters.map(filter => {
            const field = fields.find(candidate => candidate.id === filter.fieldId);
            const operatorStated = (field?.operators?.length ?? operators.length) > 1;
            const operator = operators.find(candidate => candidate.id === filter.operatorId);
            return (
              <li key={filter.id} className="min-w-0">
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
      )}
      {settings}
    </div>
  );
}
