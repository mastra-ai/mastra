import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchMentionRoster } from '../ui/domains/factory/services/members';

/** Mentionable people for a project; fetched once per dropdown session, filtered client-side. */
export function useFactoryMembers(factoryProjectId: string | undefined, { enabled = true } = {}) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryMembers(factoryProjectId),
    queryFn:
      enabled && factoryProjectId ? ({ signal }) => fetchMentionRoster(baseUrl, factoryProjectId, signal) : skipToken,
    staleTime: 5 * 60_000,
  });
}
