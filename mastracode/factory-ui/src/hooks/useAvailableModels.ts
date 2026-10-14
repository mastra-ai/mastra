import type { ModelReasoningOption } from '@mastra/core/llm';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';

/** One selectable model from `GET /web/config/models` (credentialed providers only). */
export interface AvailableModelOption {
  id: string;
  provider: string;
  modelName: string;
  hasApiKey: boolean;
  reasoningOptions?: ModelReasoningOption[];
}

/**
 * Session-independent model catalog for settings pickers (Factory default,
 * personal default, OM models). Server-filtered to providers with a
 * credential, so pickers never offer models that cannot run. Pass a Factory
 * to narrow the catalog to the credentials its model scope runs with.
 */
export function availableModelsQueryOptions(baseUrl: string, factoryProjectId?: string) {
  return queryOptions({
    queryKey: queryKeys.availableModels(factoryProjectId),
    queryFn: async () => {
      const query = factoryProjectId ? `?factoryId=${encodeURIComponent(factoryProjectId)}` : '';
      const res = await fetch(`${baseUrl}/web/config/models${query}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Failed to load models (${res.status})`);
      const data = (await res.json()) as { models: AvailableModelOption[] };
      return data.models;
    },
  });
}

export function useAvailableModelsQuery(factoryProjectId?: string) {
  const { baseUrl } = useApiConfig();
  return useQuery(availableModelsQueryOptions(baseUrl, factoryProjectId));
}

export function useModelReasoningOptions(modelId: string | undefined): ModelReasoningOption[] | undefined {
  const { data: models } = useAvailableModelsQuery();
  return models?.find(model => model.id === modelId)?.reasoningOptions;
}
