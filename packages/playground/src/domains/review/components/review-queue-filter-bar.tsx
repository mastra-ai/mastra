import type { DatasetExperiment } from '@mastra/client-js';
import { FilterBar } from '@mastra/playground-ui/components/FilterBar';
import type { FilterBarField, FilterBarItem, FilterBarOperator } from '@mastra/playground-ui/components/FilterBar';
import { useMemo } from 'react';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import {
  DATASET_TARGET_TYPES,
  isDatasetTargetType,
  type DatasetTargetType,
} from '@/domains/datasets/components/target-type-options';
import { getExperimentDisplayName } from '@/domains/experiments/utils/experiment-display-name';
import { useProcessors } from '@/domains/processors/hooks/use-processors';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

export const TARGET_TYPE_FIELD_ID = 'targetType';
export const TARGET_ID_FIELD_ID = 'targetId';
export const EXPERIMENT_FIELD_ID = 'experiment';

const TARGET_TYPE_LABELS: Record<DatasetTargetType, string> = {
  agent: 'Agent',
  workflow: 'Workflow',
  scorer: 'Scorer',
  processor: 'Processor',
};

// Every field takes exactly one operator, so chips render as `Field · Value`.
const OPERATORS: FilterBarOperator[] = [{ id: 'is', label: 'is' }];

export interface ReviewQueueFilters {
  targetType: DatasetTargetType | '';
  targetId: string;
  experimentId: string;
}

export interface ReviewQueueFilterBarProps extends ReviewQueueFilters {
  experiments: Pick<DatasetExperiment, 'id' | 'name'>[];
  onChange: (next: ReviewQueueFilters) => void;
}

const toItems = ({ targetType, targetId, experimentId }: ReviewQueueFilters): FilterBarItem[] => {
  const items: FilterBarItem[] = [];
  if (targetType)
    items.push({ id: TARGET_TYPE_FIELD_ID, fieldId: TARGET_TYPE_FIELD_ID, operatorId: 'is', value: targetType });
  if (targetId) items.push({ id: TARGET_ID_FIELD_ID, fieldId: TARGET_ID_FIELD_ID, operatorId: 'is', value: targetId });
  if (experimentId) {
    items.push({ id: EXPERIMENT_FIELD_ID, fieldId: EXPERIMENT_FIELD_ID, operatorId: 'is', value: experimentId });
  }
  return items;
};

const fromItems = (items: FilterBarItem[]): ReviewQueueFilters => {
  const value = (fieldId: string) => {
    const item = items.find(candidate => candidate.fieldId === fieldId);
    return typeof item?.value === 'string' ? item.value : '';
  };
  const rawType = value(TARGET_TYPE_FIELD_ID);
  const targetType = isDatasetTargetType(rawType) ? rawType : '';
  return {
    targetType,
    // A target id only makes sense within a type.
    targetId: targetType ? value(TARGET_ID_FIELD_ID) : '',
    experimentId: value(EXPERIMENT_FIELD_ID),
  };
};

/**
 * Typeahead filter bar scoping the review queue by target type, target and experiment.
 * Values are plain ids; labels come from the loaded entities so chips read as names.
 */
export function ReviewQueueFilterBar({
  targetType,
  targetId,
  experimentId,
  experiments,
  onChange,
}: ReviewQueueFilterBarProps) {
  const { data: agents } = useAgents({ enabled: targetType === 'agent' });
  const { data: workflows } = useWorkflows({ enabled: targetType === 'workflow' });
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
        id: TARGET_TYPE_FIELD_ID,
        label: 'Target type',
        strict: true,
        suggestions: DATASET_TARGET_TYPES.map(type => ({ value: type, label: TARGET_TYPE_LABELS[type] })),
      },
      {
        id: TARGET_ID_FIELD_ID,
        label: targetType ? TARGET_TYPE_LABELS[targetType] : 'Target',
        strict: true,
        // Only offered once a type narrows which entities can be picked.
        hidden: !targetType,
        suggestions: targetOptions,
      },
      {
        id: EXPERIMENT_FIELD_ID,
        label: 'Experiment',
        strict: true,
        suggestions: experiments.map(experiment => ({
          value: experiment.id,
          label: getExperimentDisplayName(experiment),
        })),
      },
    ];
  }, [targetType, agents, workflows, scorers, processors, experiments]);

  const value = useMemo(() => toItems({ targetType, targetId, experimentId }), [targetType, targetId, experimentId]);

  return (
    <FilterBar
      fields={fields}
      operators={OPERATORS}
      value={value}
      onValueChange={items => onChange(fromItems(items))}
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
