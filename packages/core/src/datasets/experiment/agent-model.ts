import { MastraError } from '../../error/index.js';
import type { MastraModelConfig } from '../../llm/model/shared.types';
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

/** `provider/modelId` label for a model config. Reads only identifying fields, so credentials never leak. */
export function agentModelLabel(model: MastraModelConfig): string {
  if (typeof model === 'string') return model;
  const m = model as { id?: unknown; providerId?: unknown; provider?: unknown; modelId?: unknown };
  if (typeof m.id === 'string') return m.id;
  const provider = m.providerId ?? m.provider;
  return typeof provider === 'string' && typeof m.modelId === 'string'
    ? `${provider}/${m.modelId}`
    : String(m.modelId ?? 'unknown');
}

/** Experiment metadata with the override recorded as `agentModel`, so runs on different models can be told apart. */
export function withAgentModelMetadata(
  metadata: Record<string, unknown> | undefined,
  agentModel: MastraModelConfig | undefined,
): Record<string, unknown> | undefined {
  return agentModel ? { ...metadata, agentModel: agentModelLabel(agentModel) } : metadata;
}
