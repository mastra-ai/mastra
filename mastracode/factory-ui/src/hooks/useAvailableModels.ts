import type { ModelReasoningOption } from '@mastra/core/llm';
import { queryOptions, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys, type AvailableModelsFilter } from '../api/keys';

export type AvailableModelsTarget = AvailableModelsFilter;

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
 * in `factoryProjectId` to narrow the catalog to its credential scope, or
 * `scope: 'user'` for the caller's own credentials (personal defaults).
 */
export function availableModelsQueryOptions(baseUrl: string, options?: AvailableModelsTarget) {
  return queryOptions({
    queryKey: queryKeys.availableModels(options),
    queryFn: async () => {
      const query =
        options?.scope === 'user'
          ? '?scope=user'
          : options?.factoryProjectId
            ? `?factoryId=${encodeURIComponent(options.factoryProjectId)}`
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

export function useAvailableModelsQuery(options?: AvailableModelsTarget) {
  const { baseUrl } = useApiConfig();
  return useQuery(availableModelsQueryOptions(baseUrl, options));
}

/** Catalog reachable with the caller's own credentials, for personal defaults. */
export function usePersonalAvailableModelsQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery(availableModelsQueryOptions(baseUrl, { scope: 'user' }));
}

export function useModelReasoningOptions(
  modelId: string | undefined,
  options?: AvailableModelsTarget,
): ModelReasoningOption[] | undefined {
  const { data: models } = useAvailableModelsQuery(options);
  return models?.find(model => model.id === modelId)?.reasoningOptions;
}
