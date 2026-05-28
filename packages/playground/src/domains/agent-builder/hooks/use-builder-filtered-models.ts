import type { BuilderModelPolicy, Provider } from '@mastra/client-js';
import { isModelAllowedByPolicy } from '@mastra/core/agent-builder/ee/model-policy';
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

    const registeredProviderIds = new Set(providers.map(provider => provider.id));

    return providers
      .map(provider => ({
        ...provider,
        models: provider.models.filter(modelId =>
          isModelAllowedByPolicy(
            policy.allowed,
            { provider: provider.id, modelId },
            {
              isProviderRegistered: registeredProviderIds.has.bind(registeredProviderIds),
            },
          ),
        ),
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

    const registeredProviderIds = new Set(models.map(model => model.provider));

    return models.filter(m =>
      isModelAllowedByPolicy(
        policy.allowed,
        { provider: m.provider, modelId: m.model },
        {
          isProviderRegistered: registeredProviderIds.has.bind(registeredProviderIds),
        },
      ),
    );
  }, [models, policy]);
};
