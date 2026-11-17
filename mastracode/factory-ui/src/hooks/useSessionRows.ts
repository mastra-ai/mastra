import type { SessionRowStatus } from '@mastra/factory/session/session-row-status';
import { hashKey, queryOptions, skipToken, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { SessionRowsRequest } from '../api/types';
import { fetchSessionActivity, fetchSessionRows } from '../ui/domains/workspaces/services/sessionRowReads';
import { STATUS_MARKER_BY_ACTIVITY } from '../ui/domains/workspaces/services/sessionRows';

export function sessionRowsQueryOptions(
  baseUrl: string,
  factoryProjectId: string | undefined,
  request: SessionRowsRequest,
) {
  return queryOptions({
    queryKey: queryKeys.sessionRows(factoryProjectId, request),
    queryFn: factoryProjectId
      ? ({ signal }) => fetchSessionRows(baseUrl, factoryProjectId, request, signal)
      : skipToken,
    // Refreshed by the feed provider and on return to a hidden tab.
    refetchOnWindowFocus: true,
  });
}

export function sessionActivityQueryOptions(baseUrl: string, factoryProjectId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.sessionActivity(factoryProjectId),
    queryFn: factoryProjectId ? ({ signal }) => fetchSessionActivity(baseUrl, factoryProjectId, signal) : skipToken,
    refetchOnWindowFocus: true,
  });
}

export function useSessionRowsQuery(factoryProjectId: string | undefined, request: SessionRowsRequest) {
  const { baseUrl } = useApiConfig();
  const options = sessionRowsQueryOptions(baseUrl, factoryProjectId, request);
  const read = useQuery(options);
  const [lastRead, setLastRead] = useState({ factoryProjectId, request });
  const retainedOptions = sessionRowsQueryOptions(baseUrl, lastRead.factoryProjectId, lastRead.request);
  if (read.data && hashKey(options.queryKey) !== hashKey(retainedOptions.queryKey)) {
    setLastRead({ factoryProjectId, request });
  }
  const retained = useQuery({ ...retainedOptions, enabled: false });
  const sameLayout = lastRead.factoryProjectId === factoryProjectId && lastRead.request.groupBy === request.groupBy;
  return { read, shown: read.data ?? (sameLayout ? retained.data : undefined) };
}

export function useSessionActivityQuery(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery(sessionActivityQueryOptions(baseUrl, factoryProjectId));
}

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
          const marker = STATUS_MARKER_BY_ACTIVITY[status];
          return marker === undefined ? [] : [[cardId, marker] as const];
        }),
      ),
      held: new Set(activity?.sessionHeldCardIds),
      current,
    }),
    [activity, current],
  );
}
