import type { BuilderModelPolicy, Provider } from '@mastra/client-js';
import { useMemo } from 'react';

import { providerMatches } from './llm/hooks/use-filtered-models';
import type { ModelInfo } from './llm/hooks/use-filtered-models';

export { useBuilderModelPolicy, useBuilderPickerVisibility } from './agent-builder/hooks/use-builder-settings';

const modelAllowed = (policy: BuilderModelPolicy, provider: string, modelId?: string) => {
  if (!policy.active || !policy.allowed?.length) return true;
  return policy.allowed.some(entry => {
    if (!providerMatches(provider, entry.provider)) return false;
    if (!entry.modelId) return true;
    return modelId !== undefined && entry.modelId === modelId;
  });
};

export function useBuilderFilteredProviders(providers: Provider[], policy: BuilderModelPolicy) {
  return useMemo(() => {
    if (!policy.active || !policy.allowed?.length) return providers;
    return providers
      .map(provider => ({
        ...provider,
        models: provider.models.filter(model => modelAllowed(policy, provider.id, model)),
      }))
      .filter(provider => provider.models.length > 0 || modelAllowed(policy, provider.id));
  }, [providers, policy]);
}

export function useBuilderFilteredModels(models: ModelInfo[], policy: BuilderModelPolicy) {
  return useMemo(() => models.filter(model => modelAllowed(policy, model.provider, model.model)), [models, policy]);
}

export function isModelNotAllowedError(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'MODEL_NOT_ALLOWED') {
    return { message: error instanceof Error ? error.message : 'Model is not allowed' };
  }

  return null;
}
