import type { BuilderModelPolicy, Provider } from '@mastra/client-js';
import { useMemo } from 'react';
import type { ModelInfo } from '../../llm/hooks/use-filtered-models';
import { providerMatches } from '../../llm/hooks/use-filtered-models';
import { useAgentBuilderAllowedModels } from './use-agent-builder-allowed-models';

/**
 * Build a `Set` of `provider:model` keys that the active builder policy allows.
 * The membership data comes from `GET /editor/builder/models/available`, which
 * applies the authoritative server-side allowlist (including the deny-all rule
 * for unknown providers), so no EE matcher runs in the browser.
 */
const useAllowedModels = (): ModelInfo[] => {
  const { models } = useAgentBuilderAllowedModels();
  return useMemo(() => models, [models]);
};

const providersMatch = (provider: string, allowedProvider: string): boolean =>
  providerMatches(provider, allowedProvider) || providerMatches(allowedProvider, provider);

const isAllowed = (allowedModels: ModelInfo[], provider: string, modelId: string): boolean =>
  allowedModels.some(model => model.model === modelId && providersMatch(provider, model.provider));

/**
 * Returns the subset of providers that have at least one model allowed by the
 * given policy. Pass-through when `policy.active === false` or `policy.allowed`
 * is unset / empty.
 */
export const useBuilderFilteredProviders = (providers: Provider[], policy: BuilderModelPolicy): Provider[] => {
  const allowedModels = useAllowedModels();
  return useMemo(() => {
    if (!policy.active || !policy.allowed || policy.allowed.length === 0) {
      return providers;
    }

    return providers
      .map(provider => ({
        ...provider,
        models: provider.models.filter(modelId => isAllowed(allowedModels, provider.id, modelId)),
      }))
      .filter(provider => provider.models.length > 0);
  }, [providers, policy, allowedModels]);
};

/**
 * Returns the subset of flattened models allowed by the given policy.
 * Pass-through when `policy.active === false` or `policy.allowed` is unset / empty.
 */
export const useBuilderFilteredModels = (models: ModelInfo[], policy: BuilderModelPolicy): ModelInfo[] => {
  const allowedModels = useAllowedModels();
  return useMemo(() => {
    if (!policy.active || !policy.allowed || policy.allowed.length === 0) {
      return models;
    }

    return models.filter(m => isAllowed(allowedModels, m.provider, m.model));
  }, [models, policy, allowedModels]);
};
