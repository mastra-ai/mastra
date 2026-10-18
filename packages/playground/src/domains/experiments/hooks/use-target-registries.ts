import { useAgents } from '@mastra/react/hooks/agents';
import { useProcessors } from '@mastra/react/hooks/processors';
import { useWorkflows } from '@mastra/react/hooks/workflows';
import type { TargetRegistries } from '@/domains/experiments/utils/target-name';
import { useScorers } from '@/domains/scores/hooks/use-scorers';

/** Registries needed to resolve an experiment target id into a display name. */
export function useTargetRegistries(): TargetRegistries {
  const { data: agents } = useAgents();
  const { data: workflows } = useWorkflows();
  const { data: scorers } = useScorers();
  const { data: processors } = useProcessors();
  return { agents, workflows, scorers, processors };
}
