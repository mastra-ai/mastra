import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { getSupervisorHealth } from '../ui/domains/supervisor/services/supervisor';

export const SUPERVISOR_HEALTH_POLL_MS = 15_000;

export function useSupervisorHealth(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factorySupervisorHealth(factoryProjectId),
    queryFn: factoryProjectId ? () => getSupervisorHealth(baseUrl, factoryProjectId) : skipToken,
    refetchInterval: SUPERVISOR_HEALTH_POLL_MS,
    staleTime: 5_000,
  });
}
