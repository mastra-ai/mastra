import type { FilterBarField, FilterBarOperator, FilterBarOption } from '@/ds/components/FilterBar';

export const BOARD_FILTER_OPERATORS: FilterBarOperator[] = [{ id: 'in', label: 'is any of', arity: 'many' }];

export type BoardFilterOption = FilterBarOption & { alsoMatches?: string };

export type BoardFilterField<Id extends string = string> = FilterBarField & {
  id: Id;
  suggestions: BoardFilterOption[];
};

/** The field's options, plus any picked value no longer offered (a disconnected source, a person off the board). */
export function boardFilterOptions(field: BoardFilterField, selected: readonly string[]): BoardFilterOption[] {
  const offered = new Set(field.suggestions.map(option => option.value));
  const Icon = field.icon;
  const orphaned = selected
    .filter(value => !offered.has(value))
    .map((value): BoardFilterOption => ({ value, start: Icon ? <Icon aria-hidden /> : undefined }));
  return [...field.suggestions, ...orphaned];
}

export function boardFilterSummary(field: BoardFilterField, selected: readonly string[]): string {
  if (selected.length > 1) return `${selected.length} selected`;
  const only = boardFilterOptions(field, selected).find(option => option.value === selected[0]);
  return only?.label ?? selected[0] ?? '';
}
