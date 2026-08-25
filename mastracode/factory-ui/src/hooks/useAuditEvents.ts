import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchAuditEvents, fetchAuditPortalLink } from '../ui/domains/factory/services/audit';
import type { AuditEventPage } from '../ui/domains/factory/services/audit';

export function useAuditEvents(
  factoryProjectId: string | undefined,
  group: string,
  actions: string[] | undefined,
  limit?: number,
  actorIds: string[] = [],
) {
  const { baseUrl } = useApiConfig();
  const actorKey = actorIds.toSorted().join(',');
  const initialPageParam: string | undefined = undefined;
  const queryFn = factoryProjectId
    ? ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
        fetchAuditEvents(baseUrl, factoryProjectId, { actions, actorIds, before: pageParam, limit, signal })
    : skipToken;
  return useInfiniteQuery({
    queryKey: queryKeys.factoryAudit(factoryProjectId, group, actorKey),
    queryFn,
    initialPageParam,
    getNextPageParam: (lastPage: AuditEventPage) => lastPage.nextCursor,
    staleTime: 15_000,
  });
}

/**
 * How far back the board reads. The route pages at 200 and cannot filter by
 * actor — `actorIds` only resolves profiles — so walking to the end means
 * replaying the project's whole audit history on every mount and every time the
 * board's actor set shifts. A card older than the window keeps the creator its
 * own metadata carries; it loses only the "last worker" attribution.
 */
const MAX_ACTIVITY_PAGES = 3;

export function useRecentAuditEvents(
  factoryProjectId: string | undefined,
  group: string,
  limit: number,
  actorIds: string[] = [],
) {
  const { baseUrl } = useApiConfig();
  const actorKey = actorIds.toSorted().join(',');
  const queryFn = factoryProjectId
    ? async ({ signal }: { signal: AbortSignal }): Promise<AuditEventPage> => {
        const events: AuditEventPage['events'] = [];
        const actors: AuditEventPage['actors'] = {};
        let before: string | undefined;

        for (let fetched = 0; fetched < MAX_ACTIVITY_PAGES; fetched += 1) {
          signal.throwIfAborted();
          const page = await fetchAuditEvents(baseUrl, factoryProjectId, { actorIds, before, limit, signal });
          events.push(...page.events);
          for (const [actorId, actor] of Object.entries(page.actors)) actors[actorId] ??= actor;

          if (page.nextCursor === undefined) break;
          if (page.nextCursor === before) throw new Error('Audit pagination cursor did not advance');
          before = page.nextCursor;
        }

        return { events, actors };
      }
    : skipToken;

  return useQuery({
    queryKey: queryKeys.factoryAudit(factoryProjectId, `${group}:recent`, actorKey),
    queryFn,
    staleTime: 15_000,
  });
}

export function useAuditPortalLink(enabled: boolean) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryAuditPortal(),
    queryFn: () => fetchAuditPortalLink(baseUrl),
    enabled,
    staleTime: Infinity,
    retry: false,
  });
}
