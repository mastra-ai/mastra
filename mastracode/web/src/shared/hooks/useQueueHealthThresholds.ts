import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchQueueHealthThresholds } from '../../web/ui/domains/factory/services/health';

/** Per-project queue-health age-threshold config (seconds), defaulting server-side. */
export function useQueueHealthThresholds(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryHealthThresholds(factoryProjectId),
    queryFn: () => fetchQueueHealthThresholds(baseUrl, factoryProjectId!),
    enabled: Boolean(factoryProjectId),
    staleTime: 30_000,
  });
}
