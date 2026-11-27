import type { LogViewLine } from '../../types';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@/ds/components/FilterBar';

export const LOG_VIEW_SEARCH_FIELD = 'search';
const FIELD_PREFIX = 'field:';

export const logViewFilterOperators: FilterBarOperator[] = [
  { id: 'is', label: 'is' },
  { id: 'contains', label: 'contains', freeText: true },
];

function fieldText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function chipFilters(items: FilterBarItem[]): Array<[string, string]> {
  return items.flatMap(item =>
    item.fieldId.startsWith(FIELD_PREFIX) ? [[item.fieldId.slice(FIELD_PREFIX.length), String(item.value)]] : [],
  );
}

export function logViewSearchText(items: FilterBarItem[]): string {
  return items
    .filter(item => item.fieldId === LOG_VIEW_SEARCH_FIELD)
    .map(item => String(item.value).trim())
    .join(' ');
}

export function filterLogsByFields<T extends LogViewLine>(logs: T[], items: FilterBarItem[]): T[] {
  const chips = chipFilters(items);
  if (chips.length === 0) return logs;
  return logs.filter(log =>
    chips.every(([key, value]) => log.data?.[key] !== undefined && fieldText(log.data[key]) === value),
  );
}

export interface LogViewFilterKinds {
  search: boolean;
  fieldChips: boolean;
}

export function logViewFilterFields(
  logs: LogViewLine[],
  items: FilterBarItem[],
  { search, fieldChips }: LogViewFilterKinds,
): FilterBarField[] {
  const searchField: FilterBarField = {
    id: LOG_VIEW_SEARCH_FIELD,
    label: 'Search',
    search: true,
    operators: ['contains'],
  };
  if (!fieldChips) return search ? [searchField] : [];
  const values = new Map<string, Set<string>>();
  for (const log of logs) {
    for (const [key, value] of Object.entries(log.data ?? {})) {
      values.set(key, (values.get(key) ?? new Set()).add(fieldText(value)));
    }
  }
  for (const [key] of chipFilters(items)) {
    if (!values.has(key)) values.set(key, new Set());
  }
  const chipFields: FilterBarField[] = [...values.keys()].toSorted().map(key => ({
    id: `${FIELD_PREFIX}${key}`,
    label: key,
    operators: ['is'],
    suggestions: [...(values.get(key) ?? [])].toSorted().map(value => ({ value, label: value })),
  }));
  return search ? [searchField, ...chipFields] : chipFields;
}
