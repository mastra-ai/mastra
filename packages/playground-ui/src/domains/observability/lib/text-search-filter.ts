import { SearchIcon } from 'lucide-react';
import { effectiveTextSearch } from './text-search';
import type { FilterBarField, FilterBarItem } from '@/ds/components/FilterBar';

export const TEXT_SEARCH_FIELD: FilterBarField = {
  id: 'textSearch',
  label: 'Contains text',
  icon: SearchIcon,
  operators: ['is'],
  rootOnly: true,
  singleton: true,
  validateInput: value => (effectiveTextSearch(value) ? undefined : 'Enter between 3 and 256 characters to search'),
};

export function textSearchFilterItems(value: string | undefined): FilterBarItem[] {
  return value !== undefined
    ? [{ id: TEXT_SEARCH_FIELD.id, fieldId: TEXT_SEARCH_FIELD.id, operatorId: 'is', value }]
    : [];
}
