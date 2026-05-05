import type { Provider } from '@mastra/client-js';
import { useBuilderFilteredModels, useBuilderFilteredProviders, useBuilderModelPolicy } from '@/domains/builder';
import { useAllModels, useLLMProviders } from '@/domains/llm';
import type { ModelInfo } from '@/domains/llm/hooks/use-filtered-models';

/**
 * Single source of truth for "what providers/models is the agent builder
 * allowed to use right now?". Mirrors the configure panel's pipeline
 * (`useLLMProviders` -> `useBuilderFilteredProviders` for providers and
 * `useAllModels` -> `useBuilderFilteredModels` for the flat model list)
 * so the starter and chat surfaces never disagree with the picker.
 */
export interface AgentBuilderAllowedModels {
  providers: Provider[];
  models: ModelInfo[];
  isLoading: boolean;
}

export const useAgentBuilderAllowedModels = (): AgentBuilderAllowedModels => {
  const policy = useBuilderModelPolicy();
  const { data, isLoading } = useLLMProviders();
  const allProviders = data?.providers ?? [];
  const providers = useBuilderFilteredProviders(allProviders, policy);
  const allModels = useAllModels(allProviders);
  const models = useBuilderFilteredModels(allModels, policy);
  return { providers, models, isLoading };
};
