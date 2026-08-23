import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';

/** One selectable model from `GET /web/config/models` (credentialed providers only). */
export interface AvailableModelOption {
  id: string;
  provider: string;
  modelName: string;
  hasApiKey: boolean;
}

/**
 * Session-independent model catalog for settings pickers (Factory default
 * model, pack editors, OM models). Server-filtered to providers with a
 * credential, so pickers never offer models that cannot run.
 */
export function useAvailableModelsQuery() {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.availableModels(),
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/web/config/models`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) throw new Error(`Failed to load models (${res.status})`);
      const data = (await res.json()) as { models: AvailableModelOption[] };
      return data.models;
    },
  });
}
