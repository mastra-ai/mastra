import { useAgents } from '@mastra/react/hooks/agents';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import type { TargetType } from './target-selector';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

/**
 * Lists the agents, workflows or scorers an experiment can run against, as combobox options.
 */
export function useTargetOptions(targetType: TargetType | '') {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows({});
  const { data: scorers, isLoading: scorersLoading } = useScorers();

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

  const isLoading =
    (targetType === 'agent' && agentsLoading) ||
    (targetType === 'workflow' && workflowsLoading) ||
    (targetType === 'scorer' && scorersLoading);

  return { targetOptions, isLoading };
}
