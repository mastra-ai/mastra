import { useAgents } from '@mastra/react/hooks/agents';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

export type TargetType = 'agent' | 'workflow' | 'scorer';

/**
 * Lists the agents, workflows or scorers an experiment can run against, as combobox options.
 */
export function useTargetOptions(targetType: TargetType | '') {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows({});
  const { data: scorers, isLoading: scorersLoading } = useScorers();

  if (!targetType) return { targetOptions: [], isLoading: false };

  const optionsByType = {
    agent: Object.entries(agents ?? {}).map(([id, agent]) => ({ value: id, label: agent.name ?? id })),
    workflow: Object.entries(workflows ?? {}).map(([id, workflow]) => ({ value: id, label: workflow.name ?? id })),
    scorer: Object.entries(scorers ?? {}).map(([id, scorer]) => ({
      value: id,
      label: scorer.scorer?.config?.name ?? id,
    })),
  };
  const loadingByType = { agent: agentsLoading, workflow: workflowsLoading, scorer: scorersLoading };

  return { targetOptions: optionsByType[targetType], isLoading: loadingByType[targetType] };
}
