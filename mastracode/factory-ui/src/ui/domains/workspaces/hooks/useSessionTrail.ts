import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { fetchAuditEvents, MAX_AUDIT_PAGE_SIZE } from '../../factory/services/audit';
import type { SessionViewerProfile } from '../services/sessionPresentation';
import { auditOwnerChanges, auditRunIntervals } from '../services/sessionTrack';
import type { OwnerChange, RunInterval } from '../services/sessionTrack';

const TRAIL_STALE_TIME = 15_000;

export interface TrailPerson {
  id: string;
  name?: string;
  avatarUrl?: string;
}

/** The agent runs and ownership changes the audit trail recorded for one session, and who the people in it are. */
export function useSessionTrail({
  factoryId,
  sessionRowId,
  threadId,
}: {
  factoryId: string;
  sessionRowId: string;
  threadId: string | undefined;
}): { runs: RunInterval[]; ownerChanges: OwnerChange[]; people: Map<string, TrailPerson> } {
  const { baseUrl } = useApiConfig();
  const runs = useQuery({
    queryKey: queryKeys.factoryAudit(factoryId, 'session-runs', threadId),
    queryFn: threadId
      ? ({ signal }) =>
          fetchAuditEvents(baseUrl, factoryId, {
            namespaces: ['run'],
            actor: `agent:${threadId}`,
            limit: MAX_AUDIT_PAGE_SIZE,
            signal,
          })
      : skipToken,
    staleTime: TRAIL_STALE_TIME,
  });
  // ponytail: the route cannot filter by target, so a transfer older than the project's newest page is missed.
  const transfers = useQuery({
    queryKey: queryKeys.factoryAudit(factoryId, 'session-transfers'),
    queryFn: ({ signal }) =>
      fetchAuditEvents(baseUrl, factoryId, { namespaces: ['session'], limit: MAX_AUDIT_PAGE_SIZE, signal }),
    staleTime: TRAIL_STALE_TIME,
  });
  // Keyed by the actor id events carry, which can differ from a profile's own id.
  const roster = new Map(
    Object.entries(transfers.data?.actors ?? {}).map(([actorId, actor]): [string, TrailPerson] => [
      actorId,
      { ...actor, id: actorId },
    ]),
  );
  const viewer = useFactoryAuth().data?.user;
  return {
    runs: auditRunIntervals(runs.data?.events ?? []),
    ownerChanges: auditOwnerChanges(transfers.data?.events ?? [], sessionRowId),
    people: withViewer(roster, viewer),
  };
}

/** The trail only names people it recorded, yet the viewer is the person most likely on their own sessions' track. */
function withViewer(
  roster: Map<string, TrailPerson>,
  viewer: SessionViewerProfile | undefined,
): Map<string, TrailPerson> {
  if (!viewer?.userId || roster.has(viewer.userId)) return roster;
  const name = viewer.name?.trim() || viewer.email?.trim();
  return new Map(roster).set(viewer.userId, {
    id: viewer.userId,
    ...(name ? { name } : {}),
    ...(viewer.avatarUrl ? { avatarUrl: viewer.avatarUrl } : {}),
  });
}
