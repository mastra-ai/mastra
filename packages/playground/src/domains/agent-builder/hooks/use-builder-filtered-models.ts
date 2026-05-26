import type { BuilderModelPolicy, Provider } from '@mastra/client-js';
import { isModelAllowed } from '@mastra/core/agent-builder/ee';
import { useMemo } from 'react';
import type { ModelInfo } from '../../llm/hooks/use-filtered-models';

/**
 * Returns the subset of providers that have at least one model allowed by the
 * given policy. Pass-through when `policy.active === false` or `policy.allowed`
 * is unset / empty (mirrors the server-side `isModelAllowed` contract).
 */
export const useBuilderFilteredProviders = (providers: Provider[], policy: BuilderModelPolicy): Provider[] => {
  return useMemo(() => {
    if (!policy.active || !policy.allowed || policy.allowed.length === 0) {
      return providers;
    }

    return providers
      .map(provider => ({
        ...provider,
        models: provider.models.filter(modelId => isModelAllowed(policy.allowed, { provider: provider.id, modelId })),
      }))
      .filter(provider => provider.models.length > 0);
  }, [providers, policy]);
};

/**
 * Returns the subset of flattened models allowed by the given policy.
 * Pass-through when `policy.active === false` or `policy.allowed` is unset / empty.
 */
export const useBuilderFilteredModels = (models: ModelInfo[], policy: BuilderModelPolicy): ModelInfo[] => {
  return useMemo(() => {
    if (!policy.active || !policy.allowed || policy.allowed.length === 0) {
      return models;
    }

    return models.filter(m => isModelAllowed(policy.allowed, { provider: m.provider, modelId: m.model }));
  }, [models, policy]);
};
