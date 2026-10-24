import { skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFeedRoster } from './useFeedRoster';
import { fetchAuditEvents } from '../../factory/services/audit';
import type { FactoryMentionMember } from '../../factory/services/members';
import type { SessionViewerProfile } from '../services/sessionPresentation';
import { auditOwnerChanges, auditRunIntervals } from '../services/sessionTrack';
import type { OwnerChange, RunInterval } from '../services/sessionTrack';

const MAX_AUDIT_PAGE_SIZE = 200;
const TRAIL_STALE_TIME = 15_000;

/** The agent runs and ownership changes the audit trail recorded for one session, and who the people in it are. */
export function useSessionTrail({
  factoryId,
  sessionRowId,
  threadId,
}: {
  factoryId: string;
  sessionRowId: string;
  threadId: string | undefined;
}): { runs: RunInterval[]; ownerChanges: OwnerChange[]; people: Map<string, FactoryMentionMember> } {
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
  const roster = useFeedRoster(factoryId, transfers.data ? [transfers.data] : []);
  const viewer = useFactoryAuth().data?.user;
  return {
    runs: auditRunIntervals(runs.data?.events ?? []),
    ownerChanges: auditOwnerChanges(transfers.data?.events ?? [], sessionRowId),
    people: withViewer(roster, viewer),
  };
}

/** A host without an org roster lists nobody, yet the viewer is the person most likely on their own sessions' track. */
function withViewer(
  roster: Map<string, FactoryMentionMember>,
  viewer: SessionViewerProfile | undefined,
): Map<string, FactoryMentionMember> {
  if (!viewer?.userId || roster.has(viewer.userId)) return roster;
  const name = viewer.name?.trim() || viewer.email?.trim();
  return new Map(roster).set(viewer.userId, {
    id: viewer.userId,
    ...(name ? { name } : {}),
    ...(viewer.avatarUrl ? { avatarUrl: viewer.avatarUrl } : {}),
  });
}
