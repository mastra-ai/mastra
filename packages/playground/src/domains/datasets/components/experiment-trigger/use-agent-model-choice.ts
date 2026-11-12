import { useState } from 'react';
import type { AgentModel } from './experiment-trigger-options';

const sameModel = (a: AgentModel, b?: AgentModel) => a.provider === b?.provider && a.modelId === b?.modelId;

/**
 * Which model an agent target runs on. Shows the agent's own model until another one is picked; only a full
 * provider + model pick that differs from it becomes an override.
 */
export function useAgentModelChoice(defaultModel?: AgentModel) {
  const [picked, setPicked] = useState<AgentModel | null>(null);
  const shown = picked ?? defaultModel ?? { provider: '', modelId: '' };
  const agentModel = picked?.provider && picked.modelId && !sameModel(picked, defaultModel) ? picked : undefined;

  return {
    provider: shown.provider,
    modelId: shown.modelId,
    /** A new provider drops the model, which belongs to the previous provider. */
    setProvider: (nextProvider: string) => {
      if (nextProvider === shown.provider) return;
      setPicked({ provider: nextProvider, modelId: '' });
    },
    setModelId: (modelId: string) => setPicked({ provider: shown.provider, modelId }),
    reset: () => setPicked(null),
    canReset: picked !== null && !sameModel(picked, defaultModel),
    agentModel,
  };
}
