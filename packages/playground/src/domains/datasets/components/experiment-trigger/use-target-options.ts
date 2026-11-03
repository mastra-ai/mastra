import { cleanProviderId } from '@mastra/playground-ui/domains/llm';
import { useAgents } from '@mastra/react/hooks/agents';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import { toTargetValue } from './experiment-trigger-options';
import type { AgentModel, TargetOption, TargetType } from './experiment-trigger-options';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

const toTargetOption = (type: TargetType, id: string, label: string, defaultModel?: AgentModel): TargetOption => ({
  value: toTargetValue(type, id),
  label,
  type,
  id,
  defaultModel,
});

function toAgentModel(provider?: string, modelId?: string): AgentModel | undefined {
  if (!provider || !modelId) return undefined;
  return { provider: cleanProviderId(provider), modelId };
}

/** Agents, workflows and scorers in one list, so picking a target is one choice instead of two. */
export function useTargetOptions() {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows({});
  const { data: scorers, isLoading: scorersLoading } = useScorers();

  const options: TargetOption[] = [
    ...Object.entries(agents ?? {}).map(([id, agent]) =>
      toTargetOption('agent', id, agent.name || id, toAgentModel(agent.provider, agent.modelId)),
    ),
    ...Object.entries(workflows ?? {}).map(([id, workflow]) => toTargetOption('workflow', id, workflow.name || id)),
    ...Object.entries(scorers ?? {}).map(([id, scorer]) =>
      toTargetOption('scorer', id, scorer.scorer?.config?.name || id),
    ),
  ];

  return { options, isLoading: agentsLoading || workflowsLoading || scorersLoading };
}
