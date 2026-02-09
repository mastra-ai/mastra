import { useAgents } from '@/domains/agents/hooks/use-agents';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Label } from '@/ds/components/Label';
import { Skeleton } from '@/ds/components/Skeleton';

export type TargetType = 'agent' | 'workflow' | 'scorer';

export interface TargetSelectorProps {
  targetType: TargetType | '';
  setTargetType: (type: TargetType | '') => void;
  targetId: string;
  setTargetId: (id: string) => void;
}

export function TargetSelector({ targetType, setTargetType, targetId, setTargetId }: TargetSelectorProps) {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows();
  const { data: scorers, isLoading: scorersLoading } = useScorers();

  // Get list of targets based on selected type
  const targets =
    targetType === 'agent'
      ? Object.entries(agents ?? {}).map(([id, agent]) => ({
          id,
          name: agent.name ?? id,
        }))
      : targetType === 'workflow'
        ? Object.entries(workflows ?? {}).map(([id, workflow]) => ({
            id,
            name: workflow.name ?? id,
          }))
        : targetType === 'scorer'
          ? Object.entries(scorers ?? {}).map(([id, scorer]) => ({
              id,
              name: scorer.scorer?.config?.name ?? id,
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

  return (
    <div className="grid gap-4">
      {/* Target Type Selection */}
      <div className="grid gap-2">
        <Label htmlFor="target-type">Target Type</Label>
        <Select value={targetType} onValueChange={handleTypeChange}>
          <SelectTrigger id="target-type">
            <SelectValue placeholder="Select target type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
            <SelectItem value="scorer">Scorer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Specific Target Selection */}
      {targetType && (
        <div className="grid gap-2">
          <Label htmlFor="target-id">
            {targetType === 'agent' ? 'Agent' : targetType === 'workflow' ? 'Workflow' : 'Scorer'}
          </Label>
          {isTargetsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger id="target-id">
                <SelectValue placeholder={`Select ${targetType}`} />
              </SelectTrigger>
              <SelectContent>
                {targets.map(target => (
                  <SelectItem key={target.id} value={target.id}>
                    {target.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}
