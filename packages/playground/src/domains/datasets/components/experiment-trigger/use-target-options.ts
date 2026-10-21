import { useAgents } from '@mastra/react/hooks/agents';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import { toTargetValue } from './experiment-trigger-options';
import type { TargetOption } from './experiment-trigger-options';
import type { TargetType } from './target-selector';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

const toTargetOption = (type: TargetType, id: string, label: string): TargetOption => ({
  value: toTargetValue(type, id),
  label,
  type,
  id,
});

/** Agents, workflows and scorers in one list, so picking a target is one choice instead of two. */
export function useTargetOptions() {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows({});
  const { data: scorers, isLoading: scorersLoading } = useScorers();

  const options: TargetOption[] = [
    ...Object.entries(agents ?? {}).map(([id, agent]) => toTargetOption('agent', id, agent.name || id)),
    ...Object.entries(workflows ?? {}).map(([id, workflow]) => toTargetOption('workflow', id, workflow.name || id)),
    ...Object.entries(scorers ?? {}).map(([id, scorer]) =>
      toTargetOption('scorer', id, scorer.scorer?.config?.name || id),
    ),
  ];

  return { options, isLoading: agentsLoading || workflowsLoading || scorersLoading };
}
