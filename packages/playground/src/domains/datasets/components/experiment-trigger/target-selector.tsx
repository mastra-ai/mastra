import { Combobox } from '@mastra/playground-ui/components/Combobox';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { useWorkflows, useAgents } from '@mastra/react/hooks';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

export type TargetType = 'agent' | 'workflow' | 'scorer';

export interface TargetSelectorProps {
  targetType: TargetType | '';
  setTargetType: (type: TargetType | '') => void;
  targetId: string;
  setTargetId: (id: string) => void;
  container?: React.RefObject<HTMLElement | null>;
}

const targetTypeOptions = [
  { value: 'agent', label: 'Agent' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'scorer', label: 'Scorer' },
];

export function TargetSelector({ targetType, setTargetType, targetId, setTargetId, container }: TargetSelectorProps) {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows({});
  const { data: scorers, isLoading: scorersLoading } = useScorers();

  // Get list of targets based on selected type
  const targetOptions =
    targetType === 'agent'
      ? Object.entries(agents ?? {}).map(([id, agent]) => ({
          value: id,
          label: agent.name ?? id,
        }))
      : targetType === 'workflow'
        ? Object.entries(workflows ?? {}).map(([id, workflow]) => ({
            value: id,
            label: workflow.name ?? id,
          }))
        : targetType === 'scorer'
          ? Object.entries(scorers ?? {}).map(([id, scorer]) => ({
              value: id,
              label: scorer.scorer?.config?.name ?? id,
            }))
          : [];

  const isTargetsLoading =
    (targetType === 'agent' && agentsLoading) ||
    (targetType === 'workflow' && workflowsLoading) ||
    (targetType === 'scorer' && scorersLoading);

  // Reset targetId when type changes
  const handleTypeChange = (value: string) => {
    setTargetType(value as TargetType);
    setTargetId('');
  };

  const targetLabel = targetType === 'agent' ? 'Agent' : targetType === 'workflow' ? 'Workflow' : 'Scorer';

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field>
        <FieldLabel>Target Type</FieldLabel>
        <Combobox
          options={targetTypeOptions}
          value={targetType}
          onValueChange={handleTypeChange}
          placeholder="Select target type"
          searchPlaceholder="Search types..."
          emptyText="No types available"
          container={container}
        />
      </Field>

      {targetType && (
        <Field>
          <FieldLabel>{targetLabel}</FieldLabel>
          <Combobox
            options={targetOptions}
            value={targetId}
            onValueChange={setTargetId}
            placeholder={`Select ${targetType}`}
            searchPlaceholder="Search..."
            emptyText="No targets available"
            disabled={isTargetsLoading}
            container={container}
          />
        </Field>
      )}
    </div>
  );
}
