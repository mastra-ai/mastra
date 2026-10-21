import { FilterBar } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@mastra/playground-ui/components/FilterBar';
import { hueAccentColor } from '@mastra/playground-ui/utils/colors';
import { CheckCircleIcon, DatabaseIcon, SearchIcon } from 'lucide-react';
import { useMemo } from 'react';
import { EXPERIMENT_STATUS_OPTIONS } from './experiments-list-options';
import {
  filterBarItem,
  getFilterBarItemValue,
  targetFromItems,
  targetToItems,
  useTargetFilterFields,
} from '@/domains/shared/hooks/use-target-filter-fields';
import type { TargetFilterValue } from '@/domains/shared/hooks/use-target-filter-fields';

const SEARCH_FIELD_ID = 'search';
const STATUS_FIELD_ID = 'status';
const DATASET_FIELD_ID = 'dataset';

const ALL = 'all';

const OPERATORS: FilterBarOperator[] = [
  { id: 'contains', label: 'contains' },
  { id: 'is', label: 'is' },
];

const STATUS_SUGGESTIONS = EXPERIMENT_STATUS_OPTIONS.filter(option => option.value !== ALL);

export interface ExperimentsFilters extends TargetFilterValue {
  search: string;
  /** `'all'` → every status. */
  statusFilter: string;
  /** `'all'` → every dataset. */
  datasetFilter: string;
}

export interface ExperimentsFilterBarProps extends ExperimentsFilters {
  datasetOptions: Array<{ value: string; label: string }>;
  onChange: (next: ExperimentsFilters) => void;
}

const toItems = ({ search, statusFilter, datasetFilter, targetType, targetId }: ExperimentsFilters) => {
  const items: FilterBarItem[] = [];
  if (search) items.push(filterBarItem(SEARCH_FIELD_ID, search, 'contains'));
  items.push(...targetToItems({ targetType, targetId }));
  if (statusFilter !== ALL) items.push(filterBarItem(STATUS_FIELD_ID, statusFilter));
  if (datasetFilter !== ALL) items.push(filterBarItem(DATASET_FIELD_ID, datasetFilter));
  return items;
};

const fromItems = (items: FilterBarItem[]): ExperimentsFilters => ({
  ...targetFromItems(items),
  search: getFilterBarItemValue(items, SEARCH_FIELD_ID),
  statusFilter: getFilterBarItemValue(items, STATUS_FIELD_ID) || ALL,
  datasetFilter: getFilterBarItemValue(items, DATASET_FIELD_ID) || ALL,
});

/** Typeahead filter bar scoping the experiments list by free text, target, status and dataset. */
export function ExperimentsFilterBar({
  search,
  statusFilter,
  datasetFilter,
  targetType,
  targetId,
  datasetOptions,
  onChange,
}: ExperimentsFilterBarProps) {
  const targetFields = useTargetFilterFields(targetType);

  const fields = useMemo<FilterBarField[]>(
    () => [
      // Listed first so free text lands on it by default.
      { id: SEARCH_FIELD_ID, label: 'Search', icon: SearchIcon, search: true, operators: ['contains'] },
      ...targetFields,
      {
        id: STATUS_FIELD_ID,
        label: 'Status',
        icon: CheckCircleIcon,
        color: hueAccentColor('orange'),
        operators: ['is'],
        strict: true,
        suggestions: STATUS_SUGGESTIONS,
      },
      {
        id: DATASET_FIELD_ID,
        label: 'Dataset',
        icon: DatabaseIcon,
        color: hueAccentColor('blue'),
        operators: ['is'],
        strict: true,
        suggestions: datasetOptions.filter(option => option.value !== ALL),
      },
    ],
    [targetFields, datasetOptions],
  );

  const value = useMemo(
    () => toItems({ search, statusFilter, datasetFilter, targetType, targetId }),
    [search, statusFilter, datasetFilter, targetType, targetId],
  );

  return (
    <FilterBar
      fields={fields}
      operators={OPERATORS}
      value={value}
      onValueChange={(items: FilterBarItem[]) => onChange(fromItems(items))}
      // Items are rebuilt from state with `id: fieldId`; keep the draft on the same id so the chip survives.
      createItemId={fieldId => fieldId}
      aria-label="Experiments filters"
      className="min-w-64 flex-1"
    >
      <FilterBar.Chips />
      <FilterBar.Input placeholder="Filter experiments…" />
    </FilterBar>
  );
}
