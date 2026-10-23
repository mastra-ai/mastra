import { useState } from 'react';

/**
 * Which model an agent target runs on. Empty until both a provider and a model are picked; the agent's own
 * model applies meanwhile.
 */
export function useAgentModelChoice() {
  const [provider, setProviderState] = useState('');
  const [modelId, setModelId] = useState('');

  return {
    provider,
    modelId,
    /** A new provider drops the model, which belongs to the previous provider. */
    setProvider: (nextProvider: string) => {
      if (nextProvider === provider) return;
      setProviderState(nextProvider);
      setModelId('');
    },
    setModelId,
    reset: () => {
      setProviderState('');
      setModelId('');
    },
    agentModel: provider && modelId ? { provider, modelId } : undefined,
  };
}
