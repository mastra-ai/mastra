import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchAuditEvents, fetchAuditPortalLink } from '../ui/domains/factory/services/audit';
import type { AuditEventPage } from '../ui/domains/factory/services/audit';

/**
 * Cursor-paginated audit trail for the project, newest-first. `group` is the
 * UI's action-group filter key; `actions` the concrete action list it maps to
 * (undefined = all actions).
 */
export function useAuditEvents(
  factoryProjectId: string | undefined,
  group: string,
  actions: string[] | undefined,
  limit?: number,
  actorIds: string[] = [],
) {
  const { baseUrl } = useApiConfig();
  const actorKey = [...actorIds].sort().join(',');
  return useInfiniteQuery({
    queryKey: queryKeys.factoryAudit(factoryProjectId, group, actorKey),
    queryFn: ({ pageParam }) =>
      fetchAuditEvents(baseUrl, factoryProjectId!, { actions, actorIds, before: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: AuditEventPage) => lastPage.nextCursor,
    enabled: Boolean(factoryProjectId),
    staleTime: 15_000,
  });
}

/** Load the complete project audit history for board-card attribution. */
export function useCompleteAuditEvents(
  factoryProjectId: string | undefined,
  group: string,
  limit: number,
  actorIds: string[] = [],
) {
  const { baseUrl } = useApiConfig();
  const actorKey = [...actorIds].sort().join(',');
  return useQuery({
    queryKey: queryKeys.factoryAudit(factoryProjectId, `${group}:complete`, actorKey),
    queryFn: async (): Promise<AuditEventPage> => {
      const events: AuditEventPage['events'] = [];
      const actors: AuditEventPage['actors'] = {};
      let before: string | undefined;

      do {
        const page = await fetchAuditEvents(baseUrl, factoryProjectId!, { actorIds, before, limit });
        events.push(...page.events);
        for (const [actorId, actor] of Object.entries(page.actors)) actors[actorId] ??= actor;
        before = page.nextCursor;
      } while (before);

      return { events, actors };
    },
    enabled: Boolean(factoryProjectId),
    staleTime: 15_000,
  });
}

/**
 * One-time WorkOS Admin Portal URL for the audit-log viewer, or `null` when
 * WorkOS isn't configured (the button is hidden). Links are single-use, so
 * consumers refetch after opening one.
 */
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
