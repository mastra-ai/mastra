import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { DATASET_TARGET_TYPES, type DatasetTargetType } from '@/domains/datasets/components/target-type-options';
import { useProcessors } from '@/domains/processors/hooks/use-processors';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

export const ALL_TARGETS = 'all';

const TARGET_TYPE_LABELS: Record<DatasetTargetType, string> = {
  agent: 'Agent',
  workflow: 'Workflow',
  scorer: 'Scorer',
  processor: 'Processor',
};

const targetTypeOptions = [
  { value: ALL_TARGETS, label: 'All targets' },
  ...DATASET_TARGET_TYPES.map(type => ({ value: type, label: TARGET_TYPE_LABELS[type] })),
];

export interface TargetFilterProps {
  targetType: DatasetTargetType | '';
  targetId: string;
  onTargetTypeChange: (type: DatasetTargetType | '') => void;
  onTargetIdChange: (id: string) => void;
}

/**
 * Toolbar filter that scopes a list to a target type and, optionally, a single target entity.
 * Empty strings mean "no filter" so callers can map them directly to absent URL params.
 */
export function TargetFilter({ targetType, targetId, onTargetTypeChange, onTargetIdChange }: TargetFilterProps) {
  const { data: agents, isLoading: agentsLoading } = useAgents({ enabled: targetType === 'agent' });
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows({ enabled: targetType === 'workflow' });
  const { data: scorers, isLoading: scorersLoading } = useScorers({ enabled: targetType === 'scorer' });
  const { data: processors, isLoading: processorsLoading } = useProcessors({ enabled: targetType === 'processor' });

  const entityOptions =
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

  const isLoading =
    (targetType === 'agent' && agentsLoading) ||
    (targetType === 'workflow' && workflowsLoading) ||
    (targetType === 'scorer' && scorersLoading) ||
    (targetType === 'processor' && processorsLoading);

  return (
    <>
      <SelectFieldBlock
        label="Target type"
        labelIsHidden
        name="filter-target-type"
        options={targetTypeOptions}
        value={targetType || ALL_TARGETS}
        onValueChange={value => onTargetTypeChange(value === ALL_TARGETS ? '' : (value as DatasetTargetType))}
        className="whitespace-nowrap"
      />
      {targetType && (
        <Combobox
          options={[{ value: ALL_TARGETS, label: `All ${targetType}s` }, ...entityOptions]}
          value={targetId || ALL_TARGETS}
          onValueChange={value => onTargetIdChange(value === ALL_TARGETS ? '' : value)}
          placeholder={isLoading ? `Loading ${targetType}s...` : `Select ${targetType}`}
          searchPlaceholder={`Search ${targetType}s...`}
          emptyText={`No ${targetType}s found.`}
          disabled={isLoading}
          className="w-64"
        />
      )}
    </>
  );
}
