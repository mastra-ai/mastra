import type { DatasetExperiment } from '@mastra/client-js';
import { FilterBar } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@mastra/playground-ui/components/FilterBar';
import { hueAccentColor } from '@mastra/playground-ui/utils/colors';
import { CheckCircleIcon, FlaskConicalIcon, TagIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { ReviewListStatus } from './dataset-review';
import { getExperimentDisplayName } from '@/domains/experiments/utils/experiment-display-name';
import {
  filterBarItem,
  getFilterBarItemValue,
  targetFromItems,
  targetToItems,
  useTargetFilterFields,
} from '@/domains/shared/hooks/use-target-filter-fields';
import type { TargetFilterValue } from '@/domains/shared/hooks/use-target-filter-fields';

export const EXPERIMENT_FIELD_ID = 'experiment';
export const STATUS_FIELD_ID = 'status';
export const TAG_FIELD_ID = 'tag';

const STATUS_OPTIONS: Array<{ value: ReviewListStatus; label: string }> = [
  { value: 'review', label: 'Review queue' },
  { value: 'completed', label: 'Completed' },
];

// Every field takes exactly one operator, so chips render as `Field · Value`.
const OPERATORS: FilterBarOperator[] = [{ id: 'is', label: 'is' }];

export interface ReviewQueueFilters extends TargetFilterValue {
  experimentId: string;
  status: ReviewListStatus;
  /** `null` → every tag. */
  tag: string | null;
}

export interface ReviewQueueFilterBarProps extends ReviewQueueFilters {
  experiments: Pick<DatasetExperiment, 'id' | 'name'>[];
  tagOptions: Array<{ value: string; label: string }>;
  onChange: (next: ReviewQueueFilters) => void;
}

const toItems = ({ targetType, targetId, experimentId, status, tag }: ReviewQueueFilters): FilterBarItem[] => {
  const items = targetToItems({ targetType, targetId });
  if (experimentId) items.push(filterBarItem(EXPERIMENT_FIELD_ID, experimentId));
  // "Review queue" is the default view; only the other status shows as a chip.
  if (status !== 'review') items.push(filterBarItem(STATUS_FIELD_ID, status));
  if (tag) items.push(filterBarItem(TAG_FIELD_ID, tag));
  return items;
};

const fromItems = (items: FilterBarItem[]): ReviewQueueFilters => ({
  ...targetFromItems(items),
  experimentId: getFilterBarItemValue(items, EXPERIMENT_FIELD_ID),
  status: getFilterBarItemValue(items, STATUS_FIELD_ID) === 'completed' ? 'completed' : 'review',
  tag: getFilterBarItemValue(items, TAG_FIELD_ID) || null,
});

/**
 * Typeahead filter bar scoping the review queue by target type, target, experiment, status and tag.
 * Values are plain ids; labels come from the loaded entities so chips read as names.
 */
export function ReviewQueueFilterBar({
  targetType,
  targetId,
  experimentId,
  status,
  tag,
  experiments,
  tagOptions,
  onChange,
}: ReviewQueueFilterBarProps) {
  const targetFields = useTargetFilterFields(targetType);

  // Same hues as the matching trace filter fields so a "Tag" or "Experiment" chip reads alike across pages.
  const fields = useMemo<FilterBarField[]>(
    () => [
      ...targetFields,
      {
        id: EXPERIMENT_FIELD_ID,
        label: 'Experiment',
        icon: FlaskConicalIcon,
        color: hueAccentColor('pink'),
        strict: true,
        suggestions: experiments.map(experiment => ({
          value: experiment.id,
          label: getExperimentDisplayName(experiment),
        })),
      },
      {
        id: STATUS_FIELD_ID,
        label: 'Status',
        icon: CheckCircleIcon,
        color: hueAccentColor('orange'),
        strict: true,
        suggestions: STATUS_OPTIONS,
      },
      {
        id: TAG_FIELD_ID,
        label: 'Tag',
        icon: TagIcon,
        color: hueAccentColor('pink'),
        strict: true,
        // Nothing to pick from until the items carry tags.
        hidden: tagOptions.length === 0,
        suggestions: tagOptions,
      },
    ],
    [targetFields, experiments, tagOptions],
  );

  const value = useMemo(
    () => toItems({ targetType, targetId, experimentId, status, tag }),
    [targetType, targetId, experimentId, status, tag],
  );

  return (
    <FilterBar
      fields={fields}
      operators={OPERATORS}
      value={value}
      onValueChange={(items: FilterBarItem[]) => onChange(fromItems(items))}
      // Items are rebuilt from URL params with `id: fieldId`; keep the draft on the same id so the chip survives.
      createItemId={fieldId => fieldId}
      aria-label="Review queue filters"
      className="min-w-64 flex-1"
    >
      <FilterBar.Chips />
      <FilterBar.Input placeholder="Filter review queue…" />
    </FilterBar>
  );
}
