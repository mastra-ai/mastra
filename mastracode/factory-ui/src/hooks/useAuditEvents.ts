import { skipToken, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchAuditEvents, fetchAuditPortalLink } from '../ui/domains/factory/services/audit';
import type { AuditEventPage } from '../ui/domains/factory/services/audit';

const MAX_COMPLETE_AUDIT_PAGES = 25;

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

export function useCompleteAuditEvents(
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
        const seenCursors = new Set<string>();
        let pageCount = 0;

        do {
          signal.throwIfAborted();
          if (pageCount >= MAX_COMPLETE_AUDIT_PAGES) {
            throw new Error(`Audit history exceeded ${MAX_COMPLETE_AUDIT_PAGES} pages`);
          }
          const page = await fetchAuditEvents(baseUrl, factoryProjectId, { actorIds, before, limit, signal });
          pageCount += 1;
          events.push(...page.events);
          for (const [actorId, actor] of Object.entries(page.actors)) actors[actorId] ??= actor;

          const nextCursor = page.nextCursor;
          if (nextCursor && (nextCursor === before || seenCursors.has(nextCursor))) {
            throw new Error('Audit pagination cursor did not advance');
          }
          if (nextCursor) seenCursors.add(nextCursor);
          before = nextCursor;
        } while (before);

        return { events, actors };
      }
    : skipToken;

  return useQuery({
    queryKey: queryKeys.factoryAudit(factoryProjectId, `${group}:complete`, actorKey),
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
