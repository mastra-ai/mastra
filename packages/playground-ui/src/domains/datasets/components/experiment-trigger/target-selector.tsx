import { format } from 'date-fns';
import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useAgentVersions } from '@/domains/agents/hooks/use-agent-versions';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { SelectField } from '@/ds/components/FormFields/select-field';
import { Skeleton } from '@/ds/components/Skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ds/components/Tooltip';
import { useIsCmsAvailable } from '@/domains/cms/hooks/use-is-cms-available';

export type TargetType = 'agent' | 'workflow' | 'scorer';

export interface TargetSelectorProps {
  targetType: TargetType | '';
  setTargetType: (type: TargetType | '') => void;
  targetId: string;
  setTargetId: (id: string) => void;
  targetVersionId: string;
  setTargetVersionId: (id: string) => void;
}

const targetTypeOptions = [
  { value: 'agent', label: 'Agent' },
  { value: 'workflow', label: 'Workflow' },
  { value: 'scorer', label: 'Scorer' },
];

export function TargetSelector({
  targetType,
  setTargetType,
  targetId,
  setTargetId,
  targetVersionId,
  setTargetVersionId,
}: TargetSelectorProps) {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows();
  const { data: scorers, isLoading: scorersLoading } = useScorers();
  const { isCmsAvailable } = useIsCmsAvailable();

  const isAgentSelected = targetType === 'agent' && !!targetId;
  const isStoredAgent = isAgentSelected && agents?.[targetId]?.source === 'stored';
  const showVersionSelector = targetType === 'agent' && isCmsAvailable;
  const { data: versionsData, isLoading: versionsLoading } = useAgentVersions({
    agentId: isStoredAgent ? targetId : '',
  });

  const versionOptions = (versionsData?.versions ?? []).map(v => ({
    value: v.id,
    label: `v${v.versionNumber} — ${format(new Date(v.createdAt), 'MMM d, yyyy')}`,
  }));

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

  // Reset targetId and version when type changes
  const handleTypeChange = (value: string) => {
    setTargetType(value as TargetType);
    setTargetId('');
    setTargetVersionId('');
  };

  const handleTargetChange = (value: string) => {
    setTargetId(value);
    setTargetVersionId('');
  };

  const targetLabel = targetType === 'agent' ? 'Agent' : targetType === 'workflow' ? 'Workflow' : 'Scorer';

  return (
    <div className="grid gap-6">
      <SelectField
        label="Target Type"
        name="target-type"
        value={targetType}
        onValueChange={handleTypeChange}
        options={targetTypeOptions}
        placeholder="Select target type"
        variant="experimental"
        size="default"
      />

      {targetType &&
        (isTargetsLoading ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <SelectField
            label={targetLabel}
            name="target-id"
            value={targetId}
            onValueChange={handleTargetChange}
            options={targetOptions}
            placeholder={`Select ${targetType}`}
            variant="experimental"
            size="default"
          />
        ))}

      {showVersionSelector && isStoredAgent && versionsLoading && <Skeleton className="h-10 w-full" />}

      {showVersionSelector && isStoredAgent && !versionsLoading && (
        <SelectField
          label="Version"
          name="target-version-id"
          value={targetVersionId}
          onValueChange={setTargetVersionId}
          options={versionOptions}
          placeholder="Select a version"
          variant="experimental"
          size="default"
        />
      )}

      {showVersionSelector && !isStoredAgent && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <SelectField
                  label="Version"
                  name="target-version-id"
                  value=""
                  onValueChange={() => {}}
                  options={[]}
                  placeholder="Select a version"
                  variant="experimental"
                  size="default"
                  disabled
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isAgentSelected
                ? 'This agent does not support versions.'
                : 'Select an agent to choose a version.'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
