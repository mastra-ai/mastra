import { useAgents } from '@/domains/agents/hooks/use-agents';
import type { TargetRegistries } from '@/domains/experiments/utils/target-name';
import { useProcessors } from '@/domains/processors/hooks/use-processors';
import { useScorers } from '@/domains/scores/hooks/use-scorers';
import { useWorkflows } from '@/domains/workflows/hooks/use-workflows';

/** Registries needed to resolve an experiment target id into a display name. */
export function useTargetRegistries(): TargetRegistries {
  const { data: agents } = useAgents();
  const { data: workflows } = useWorkflows();
  const { data: scorers } = useScorers();
  const { data: processors } = useProcessors();
  return { agents, workflows, scorers, processors };
}
