import type { FilterBarField, FilterBarItem } from '@mastra/playground-ui/components/FilterBar';
import { hueAccentColor } from '@mastra/playground-ui/utils/colors';
import { useAgents } from '@mastra/react/hooks/agents';
import { useProcessors } from '@mastra/react/hooks/processors';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import { BoxIcon, FingerprintIcon } from 'lucide-react';
import { useMemo } from 'react';
import { DATASET_TARGET_TYPES, isDatasetTargetType } from '@/domains/datasets/components/target-type-options';
import type { DatasetTargetType } from '@/domains/datasets/components/target-type-options';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

export const TARGET_TYPE_FIELD_ID = 'targetType';
export const TARGET_ID_FIELD_ID = 'targetId';

const TARGET_TYPE_LABELS: Record<DatasetTargetType, string> = {
  agent: 'Agent',
  workflow: 'Workflow',
  scorer: 'Scorer',
  processor: 'Processor',
};

export interface TargetFilterValue {
  targetType: DatasetTargetType | '';
  targetId: string;
}

/** Flat filter bars keep one item per field, keyed by the field id, with a single `is` operator. */
export const filterBarItem = (fieldId: string, value: string, operatorId = 'is'): FilterBarItem => ({
  id: fieldId,
  fieldId,
  operatorId,
  value,
});

export const getFilterBarItemValue = (items: FilterBarItem[], fieldId: string): string => {
  const found = items.find(candidate => candidate.fieldId === fieldId);
  return typeof found?.value === 'string' ? found.value : '';
};

export const targetToItems = ({ targetType, targetId }: TargetFilterValue): FilterBarItem[] => {
  const items: FilterBarItem[] = [];
  if (targetType) items.push(filterBarItem(TARGET_TYPE_FIELD_ID, targetType));
  if (targetType && targetId) items.push(filterBarItem(TARGET_ID_FIELD_ID, targetId));
  return items;
};

export const targetFromItems = (items: FilterBarItem[]): TargetFilterValue => {
  const rawType = getFilterBarItemValue(items, TARGET_TYPE_FIELD_ID);
  const targetType = isDatasetTargetType(rawType) ? rawType : '';
  // A target id only makes sense within a type.
  return { targetType, targetId: targetType ? getFilterBarItemValue(items, TARGET_ID_FIELD_ID) : '' };
};

/**
 * `Target type` + `Target` FilterBar fields shared by the list pages scoped to an entity
 * (datasets, experiments, review queue). The target field stays hidden until a type is picked,
 * and only the entities of that type are fetched.
 */
export function useTargetFilterFields(targetType: DatasetTargetType | ''): FilterBarField[] {
  const { data: agents } = useAgents({ queryOptions: { enabled: targetType === 'agent' } });
  const { data: workflows } = useWorkflows({ queryOptions: { enabled: targetType === 'workflow' } });
  const { data: scorers } = useScorers({ enabled: targetType === 'scorer' });
  const { data: processors } = useProcessors({ queryOptions: { enabled: targetType === 'processor' } });

  return useMemo<FilterBarField[]>(() => {
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
        icon: BoxIcon,
        color: hueAccentColor('purple'),
        operators: ['is'],
        strict: true,
        suggestions: DATASET_TARGET_TYPES.map(type => ({ value: type, label: TARGET_TYPE_LABELS[type] })),
      },
      {
        id: TARGET_ID_FIELD_ID,
        label: targetType ? TARGET_TYPE_LABELS[targetType] : 'Target',
        icon: FingerprintIcon,
        color: hueAccentColor('pink'),
        operators: ['is'],
        strict: true,
        // Only offered once a type narrows which entities can be picked.
        hidden: !targetType,
        suggestions: targetOptions,
      },
    ];
  }, [targetType, agents, workflows, scorers, processors]);
}
