import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchMentionRoster } from '../ui/domains/factory/services/members';

const ROSTER_STALE_TIME = 5 * 60_000;

/** The roster query itself, so a send can await it instead of hoping for a cache hit. */
export function mentionRosterQuery(baseUrl: string, factoryProjectId: string) {
  return {
    queryKey: queryKeys.factoryMembers(factoryProjectId),
    queryFn: ({ signal }: { signal: AbortSignal }) => fetchMentionRoster(baseUrl, factoryProjectId, signal),
    staleTime: ROSTER_STALE_TIME,
  };
}

/** Mentionable people for a project; fetched once per dropdown session, filtered client-side. */
export function useFactoryMembers(factoryProjectId: string | undefined, { enabled = true } = {}) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryMembers(factoryProjectId),
    queryFn: enabled && factoryProjectId ? mentionRosterQuery(baseUrl, factoryProjectId).queryFn : skipToken,
    staleTime: ROSTER_STALE_TIME,
  });
}
