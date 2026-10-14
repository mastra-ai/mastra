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
 * to narrow the catalog to the credentials its model scope runs with, or
 * `'user'` for the caller's own credentials (personal defaults).
 */
export function availableModelsQueryOptions(baseUrl: string, factoryProjectId?: string | { scope: 'user' }) {
  const personal = typeof factoryProjectId === 'object';
  return queryOptions({
    queryKey: queryKeys.availableModels(personal ? 'scope:user' : factoryProjectId),
    queryFn: async () => {
      const query = personal
        ? '?scope=user'
        : factoryProjectId
          ? `?factoryId=${encodeURIComponent(factoryProjectId)}`
          : '';
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

/** Catalog reachable with the caller's own credentials, for personal defaults. */
export function usePersonalAvailableModelsQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery(availableModelsQueryOptions(baseUrl, { scope: 'user' }));
}

export function useModelReasoningOptions(
  modelId: string | undefined,
  factoryProjectId?: string,
): ModelReasoningOption[] | undefined {
  const { data: models } = useAvailableModelsQuery(factoryProjectId);
  return models?.find(model => model.id === modelId)?.reasoningOptions;
}
