import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchAuditEvents, fetchAuditPortalLink } from '../ui/domains/factory/services/audit';
import type { AuditActorProfile, AuditEvent, AuditEventPage } from '../ui/domains/factory/services/audit';

export interface AuditWindow {
  events: AuditEvent[];
  actors: Record<string, AuditActorProfile>;
  /** Where the walk actually reached — the floor unless the page budget ran out. */
  coveredFrom: number;
  from: number;
  to: number;
}

const WINDOW_PAGE = 200;
/** Ten pages of events is already more than a log can draw; past that, say so. */
const WINDOW_PAGES = 10;

/**
 * Every event in a time window, newest first.
 *
 * The read API only pages backwards from a cursor, so the window is walked
 * page by page until it clears its floor. Holding the whole window is what
 * lets the strip and the filters below it stay honest: they narrow a complete
 * slice rather than hiding rows a cursor never fetched. `coveredFrom` is where
 * the walk stopped, so a window too dense to reach says so instead of looking
 * empty at the left edge.
 */
export function useAuditWindow(factoryProjectId: string | undefined, spanMs: number) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.factoryAudit(factoryProjectId, `window:${spanMs}`),
    queryFn: async (): Promise<AuditWindow> => {
      const to = Date.now();
      const from = to - spanMs;
      const events: AuditEvent[] = [];
      const actors: Record<string, AuditActorProfile> = {};
      let before: string | undefined;
      let reached = from;

      for (let page = 0; page < WINDOW_PAGES; page++) {
        const fetched = await fetchAuditEvents(baseUrl, factoryProjectId!, { before, limit: WINDOW_PAGE });
        events.push(...fetched.events);
        for (const [actorId, actor] of Object.entries(fetched.actors)) actors[actorId] ??= actor;
        const oldest = fetched.events.at(-1);
        before = fetched.nextCursor;
        if (!before || !oldest) break;
        if (Date.parse(oldest.occurredAt) <= from) break;
        if (page === WINDOW_PAGES - 1) reached = Date.parse(oldest.occurredAt);
      }

      return {
        events: events.filter(event => Date.parse(event.occurredAt) >= reached),
        actors,
        coveredFrom: reached,
        from,
        to,
      };
    },
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
