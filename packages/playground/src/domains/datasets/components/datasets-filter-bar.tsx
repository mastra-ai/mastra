import { FilterBar } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@mastra/playground-ui/components/FilterBar';
import { hueAccentColor } from '@mastra/playground-ui/utils/colors';
import { FlaskConicalIcon, SearchIcon, TagIcon } from 'lucide-react';
import { useMemo } from 'react';
import { DATASET_EXPERIMENT_OPTIONS } from './datasets-list/helpers';
import {
  filterBarItem,
  getFilterBarItemValue,
  targetFromItems,
  targetToItems,
  useTargetFilterFields,
} from '@/domains/shared/hooks/use-target-filter-fields';
import type { TargetFilterValue } from '@/domains/shared/hooks/use-target-filter-fields';

const SEARCH_FIELD_ID = 'search';
const EXPERIMENTS_FIELD_ID = 'experiments';
const TAG_FIELD_ID = 'tag';

const ALL = 'all';

const OPERATORS: FilterBarOperator[] = [
  { id: 'contains', label: 'contains' },
  { id: 'is', label: 'is' },
];

const EXPERIMENTS_SUGGESTIONS = DATASET_EXPERIMENT_OPTIONS.filter(option => option.value !== ALL);

export interface DatasetsFilters extends TargetFilterValue {
  search: string;
  /** `'all'` → with or without experiments. */
  experimentFilter: string;
  /** `'all'` → every tag. */
  tagFilter: string;
}

export interface DatasetsFilterBarProps extends DatasetsFilters {
  tagOptions: Array<{ value: string; label: string }>;
  onChange: (next: DatasetsFilters) => void;
}

const toItems = ({ search, experimentFilter, tagFilter, targetType, targetId }: DatasetsFilters) => {
  const items: FilterBarItem[] = [];
  if (search) items.push(filterBarItem(SEARCH_FIELD_ID, search, 'contains'));
  items.push(...targetToItems({ targetType, targetId }));
  if (experimentFilter !== ALL) items.push(filterBarItem(EXPERIMENTS_FIELD_ID, experimentFilter));
  if (tagFilter !== ALL) items.push(filterBarItem(TAG_FIELD_ID, tagFilter));
  return items;
};

const fromItems = (items: FilterBarItem[]): DatasetsFilters => ({
  ...targetFromItems(items),
  search: getFilterBarItemValue(items, SEARCH_FIELD_ID),
  experimentFilter: getFilterBarItemValue(items, EXPERIMENTS_FIELD_ID) || ALL,
  tagFilter: getFilterBarItemValue(items, TAG_FIELD_ID) || ALL,
});

/** Typeahead filter bar scoping the datasets list by free text, target, experiments and tag. */
export function DatasetsFilterBar({
  search,
  experimentFilter,
  tagFilter,
  targetType,
  targetId,
  tagOptions,
  onChange,
}: DatasetsFilterBarProps) {
  const targetFields = useTargetFilterFields(targetType);

  const fields = useMemo<FilterBarField[]>(() => {
    const tagSuggestions = tagOptions.filter(option => option.value !== ALL);
    return [
      // Listed first so free text lands on it by default.
      { id: SEARCH_FIELD_ID, label: 'Search', icon: SearchIcon, search: true, operators: ['contains'] },
      ...targetFields,
      {
        id: EXPERIMENTS_FIELD_ID,
        label: 'Experiments',
        icon: FlaskConicalIcon,
        color: hueAccentColor('pink'),
        operators: ['is'],
        strict: true,
        suggestions: EXPERIMENTS_SUGGESTIONS,
      },
      {
        id: TAG_FIELD_ID,
        label: 'Tag',
        icon: TagIcon,
        color: hueAccentColor('pink'),
        operators: ['is'],
        strict: true,
        // Nothing to pick from until the datasets carry tags.
        hidden: tagSuggestions.length === 0,
        suggestions: tagSuggestions,
      },
    ];
  }, [targetFields, tagOptions]);

  const value = useMemo(
    () => toItems({ search, experimentFilter, tagFilter, targetType, targetId }),
    [search, experimentFilter, tagFilter, targetType, targetId],
  );

  return (
    <FilterBar
      fields={fields}
      operators={OPERATORS}
      value={value}
      onValueChange={(items: FilterBarItem[]) => onChange(fromItems(items))}
      // Items are rebuilt from state with `id: fieldId`; keep the draft on the same id so the chip survives.
      createItemId={fieldId => fieldId}
      aria-label="Datasets filters"
      className="min-w-64 flex-1"
    >
      <FilterBar.Chips />
      <FilterBar.Input placeholder="Filter datasets…" />
    </FilterBar>
  );
}
