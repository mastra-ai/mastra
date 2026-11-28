import type { SessionRowStatus } from '@internal/factory-contract';
import type { Factory, SessionActivityResponse, WireAuditPage } from '@mastra/client-js';
import { skipToken, useQuery } from '@tanstack/react-query';
import type { QueryKey, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useFactory } from './context';
import { factoryKeys } from './keys';

// The audit route cannot filter by time, so an unbounded read replays the project's whole history on every mount.
// A card older than the window keeps the creator its own metadata carries.
const MAX_ACTIVITY_PAGES = 3;

/** The project's latest audit events by the given actors, at most three pages of `limit`. */
export function useRecentAuditEvents(
  factoryProjectId: string | undefined,
  group: string,
  limit: number,
  actorIds: readonly string[] = [],
): UseQueryResult<WireAuditPage> {
  const factory = useFactory(factoryProjectId);
  const actorKey = actorIds.toSorted().join(',');
  return useQuery({
    queryKey: factoryKeys.audit(factoryProjectId, `${group}:recent`, actorKey),
    queryFn: factory
      ? async ({ signal }) => {
          const events: WireAuditPage['events'] = [];
          const actors: WireAuditPage['actors'] = {};
          let before: string | undefined;
          for (let fetched = 0; fetched < MAX_ACTIVITY_PAGES; fetched += 1) {
            signal.throwIfAborted();
            const page = await factory.auditEvents({ actorIds: [...actorIds], before, limit }, { signal });
            events.push(...page.events);
            for (const [actorId, actor] of Object.entries(page.actors)) actors[actorId] ??= actor;
            if (page.nextCursor === undefined) break;
            if (page.nextCursor === before) throw new Error('Audit pagination cursor did not advance');
            before = page.nextCursor;
          }
          return { events, actors };
        }
      : skipToken,
    staleTime: 15_000,
  });
}

export function sessionActivityQueryOptions(
  factory: Factory | undefined,
): UseQueryOptions<SessionActivityResponse, Error, SessionActivityResponse, QueryKey> {
  return {
    queryKey: factoryKeys.sessionActivity(factory?.factoryProjectId),
    queryFn: factory ? ({ signal }) => factory.sessionActivity({ signal }) : skipToken,
    refetchOnWindowFocus: true,
  };
}

export function useSessionActivityQuery(factoryProjectId: string | undefined): UseQueryResult<SessionActivityResponse> {
  return useQuery(sessionActivityQueryOptions(useFactory(factoryProjectId)));
}

type SessionActivityStatus = SessionActivityResponse['cardStatuses'][string];
const MARKER_BY_ACTIVITY: Record<SessionActivityStatus, SessionRowStatus | undefined> = {
  waiting: 'ready',
  working: 'working',
  initializing: 'initializing',
  idle: undefined,
  done: undefined,
};

export interface CardSessions {
  /** Each card's marker, by card id: the status its row in the sidebar shows. */
  statuses: ReadonlyMap<string, SessionRowStatus>;
  /** The cards one of whose sessions is coming up, running, or parked on a person. */
  held: ReadonlySet<string>;
  /** Whether the last read of them answered: until then, a card missing from `held` may still be held. */
  current: boolean;
}

export function useCardSessions(factoryProjectId: string | undefined): CardSessions {
  const { data: activity, isSuccess: current } = useSessionActivityQuery(factoryProjectId);
  return useMemo(
    () => ({
      statuses: new Map(
        Object.entries(activity?.cardStatuses ?? {}).flatMap(([cardId, status]) => {
          const marker = MARKER_BY_ACTIVITY[status];
          return marker === undefined ? [] : [[cardId, marker] as const];
        }),
      ),
      held: new Set(activity?.sessionHeldCardIds),
      current,
    }),
    [activity, current],
  );
}
