import { MastraError } from '../../error/index.js';
import type { ExperimentConfig } from './types';

/** `agentModel` swaps an agent's model, so it is meaningless for workflows, scorers and inline tasks. */
export function assertAgentModelTarget(
  config: Pick<ExperimentConfig, 'agentModel' | 'targetType'> & { task?: unknown },
) {
  if (config.agentModel && (config.task || config.targetType !== 'agent')) {
    throw new MastraError({
      id: 'EXPERIMENT_INVALID_AGENT_MODEL',
      domain: 'STORAGE',
      category: 'USER',
      text: 'agentModel is only supported for agent targets (targetType: "agent")',
    });
  }
}
