import type { DatasetExperiment } from '@mastra/client-js';
import { FilterBar } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@mastra/playground-ui/components/FilterBar';
import { useWorkflows } from '@mastra/playground-ui/domains/workflows/hooks/use-workflows';
import { themedHueColor } from '@mastra/playground-ui/utils/colors';
import { BoxIcon, CheckCircleIcon, FingerprintIcon, FlaskConicalIcon, TagIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import type { ReviewListStatus } from './dataset-review';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import {
  DATASET_TARGET_TYPES,
  isDatasetTargetType,
  type DatasetTargetType,
} from '@/domains/datasets/components/target-type-options';
import { getExperimentDisplayName } from '@/domains/experiments/utils/experiment-display-name';
import { useProcessors } from '@/domains/processors/hooks/use-processors';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { usePlaygroundStore } from '@/store/playground-store';

export const TARGET_TYPE_FIELD_ID = 'targetType';
export const TARGET_ID_FIELD_ID = 'targetId';
export const EXPERIMENT_FIELD_ID = 'experiment';
export const STATUS_FIELD_ID = 'status';
export const TAG_FIELD_ID = 'tag';

const TARGET_TYPE_LABELS: Record<DatasetTargetType, string> = {
  agent: 'Agent',
  workflow: 'Workflow',
  scorer: 'Scorer',
  processor: 'Processor',
};

const STATUS_OPTIONS: Array<{ value: ReviewListStatus; label: string }> = [
  { value: 'review', label: 'Review queue' },
  { value: 'completed', label: 'Completed' },
];

// Same hues as the matching trace filter fields so a "Tag" or "Experiment" chip reads alike across pages.
const FIELD_META: Record<string, { icon: LucideIcon; hue: number }> = {
  [TARGET_TYPE_FIELD_ID]: { icon: BoxIcon, hue: 265 },
  [TARGET_ID_FIELD_ID]: { icon: FingerprintIcon, hue: 315 },
  [EXPERIMENT_FIELD_ID]: { icon: FlaskConicalIcon, hue: 160 },
  [STATUS_FIELD_ID]: { icon: CheckCircleIcon, hue: 0 },
  [TAG_FIELD_ID]: { icon: TagIcon, hue: 340 },
};

const fieldBase = (id: string, label: string) => ({
  id,
  label,
  icon: FIELD_META[id].icon,
  color: themedHueColor(FIELD_META[id].hue),
  strict: true,
});

// Every field takes exactly one operator, so chips render as `Field · Value`.
const OPERATORS: FilterBarOperator[] = [{ id: 'is', label: 'is' }];

export interface ReviewQueueFilters {
  targetType: DatasetTargetType | '';
  targetId: string;
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

const item = (fieldId: string, value: string): FilterBarItem => ({ id: fieldId, fieldId, operatorId: 'is', value });

const toItems = ({ targetType, targetId, experimentId, status, tag }: ReviewQueueFilters): FilterBarItem[] => {
  const items: FilterBarItem[] = [];
  if (targetType) items.push(item(TARGET_TYPE_FIELD_ID, targetType));
  if (targetId) items.push(item(TARGET_ID_FIELD_ID, targetId));
  if (experimentId) items.push(item(EXPERIMENT_FIELD_ID, experimentId));
  // "Review queue" is the default view; only the other status shows as a chip.
  if (status !== 'review') items.push(item(STATUS_FIELD_ID, status));
  if (tag) items.push(item(TAG_FIELD_ID, tag));
  return items;
};

const fromItems = (items: FilterBarItem[]): ReviewQueueFilters => {
  const value = (fieldId: string) => {
    const found = items.find(candidate => candidate.fieldId === fieldId);
    return typeof found?.value === 'string' ? found.value : '';
  };
  const rawType = value(TARGET_TYPE_FIELD_ID);
  const targetType = isDatasetTargetType(rawType) ? rawType : '';
  return {
    targetType,
    // A target id only makes sense within a type.
    targetId: targetType ? value(TARGET_ID_FIELD_ID) : '',
    experimentId: value(EXPERIMENT_FIELD_ID),
    status: value(STATUS_FIELD_ID) === 'completed' ? 'completed' : 'review',
    tag: value(TAG_FIELD_ID) || null,
  };
};

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
  const { data: agents } = useAgents({ enabled: targetType === 'agent' });
  const { data: workflows } = useWorkflows({
    requestContext: usePlaygroundStore().requestContext,
    enabled: targetType === 'workflow',
  });
  const { data: scorers } = useScorers({ enabled: targetType === 'scorer' });
  const { data: processors } = useProcessors({ enabled: targetType === 'processor' });

  const fields = useMemo<FilterBarField[]>(() => {
    const targetOptions =
      targetType === 'agent'
        ? Object.entries(agents ?? {}).map(([id, agent]) => ({ value: id, label: agent.name ?? id }))
        : targetType === 'workflow'
          ? Object.entries(workflows ?? {}).map(([id, workflow]) => ({ value: id, label: workflow.name ?? id }))
          : targetType === 'scorer'
            ? Object.entries(scorers ?? {}).map(([id, scorer]) => ({
                value: id,
                label: scorer.scorer?.config?.name ?? id,
              }))
            : targetType === 'processor'
              ? Object.entries(processors ?? {}).map(([id, processor]) => ({ value: id, label: processor.name ?? id }))
              : [];

    return [
      {
        ...fieldBase(TARGET_TYPE_FIELD_ID, 'Target type'),
        suggestions: DATASET_TARGET_TYPES.map(type => ({ value: type, label: TARGET_TYPE_LABELS[type] })),
      },
      {
        ...fieldBase(TARGET_ID_FIELD_ID, targetType ? TARGET_TYPE_LABELS[targetType] : 'Target'),
        // Only offered once a type narrows which entities can be picked.
        hidden: !targetType,
        suggestions: targetOptions,
      },
      {
        ...fieldBase(EXPERIMENT_FIELD_ID, 'Experiment'),
        suggestions: experiments.map(experiment => ({
          value: experiment.id,
          label: getExperimentDisplayName(experiment),
        })),
      },
      {
        ...fieldBase(STATUS_FIELD_ID, 'Status'),
        suggestions: STATUS_OPTIONS,
      },
      {
        ...fieldBase(TAG_FIELD_ID, 'Tag'),
        // Nothing to pick from until the items carry tags.
        hidden: tagOptions.length === 0,
        suggestions: tagOptions,
      },
    ];
  }, [targetType, agents, workflows, scorers, processors, experiments, tagOptions]);

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
