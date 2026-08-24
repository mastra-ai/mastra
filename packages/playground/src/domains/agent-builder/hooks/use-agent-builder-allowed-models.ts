import type { Provider } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAllModels } from '@/domains/llm';
import type { ModelInfo } from '@/domains/llm/hooks/use-filtered-models';

/**
 * Single source of truth for "what providers/models is the agent builder
 * allowed to use right now?".
 *
 * The server is the authority for the allowlist: `GET /editor/builder/models/available`
 * applies the active builder model policy and returns the already-filtered
 * provider/model list, so the starter, picker, and chat surfaces all render the
 * same set without any EE matcher running in the browser.
 */
export interface AgentBuilderAllowedModels {
  providers: Provider[];
  models: ModelInfo[];
  isLoading: boolean;
}

export const useAgentBuilderAllowedModels = ({
  enabled = true,
}: { enabled?: boolean } = {}): AgentBuilderAllowedModels => {
  const client = useMastraClient();

  const { data, isLoading } = useQuery({
    // Stryker disable next-line ArrayDeclaration,StringLiteral: a private cache identity
    // shared only between mounts of this hook (the create/edit pages prefetch through it).
    // Nothing else reads, seeds or invalidates the key, so renaming it is unobservable.
    queryKey: ['builder-available-models'],
    queryFn: () => client.getBuilderAvailableModels(),
    enabled,
  });

  const providers = useMemo<Provider[]>(() => (data?.providers as Provider[]) ?? [], [data]);
  const models = useAllModels(providers);

  return { providers, models, isLoading };
};
