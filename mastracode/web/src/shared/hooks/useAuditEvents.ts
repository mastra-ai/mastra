import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchAuditEvents, fetchAuditPortalLink } from '../../web/ui/domains/factory/services/audit';
import type { AuditEventPage } from '../../web/ui/domains/factory/services/audit';

/**
 * Cursor-paginated audit trail for the project, newest-first. `group` is the
 * UI's action-group filter key; `actions` the concrete action list it maps to
 * (undefined = all actions).
 */
export function useAuditEvents(githubProjectId: string | undefined, group: string, actions: string[] | undefined) {
  const { baseUrl } = useApiConfig();
  return useInfiniteQuery({
    queryKey: queryKeys.factoryAudit(githubProjectId, group),
    queryFn: ({ pageParam }) => fetchAuditEvents(baseUrl, githubProjectId!, { actions, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: AuditEventPage) => lastPage.nextCursor,
    enabled: Boolean(githubProjectId),
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
