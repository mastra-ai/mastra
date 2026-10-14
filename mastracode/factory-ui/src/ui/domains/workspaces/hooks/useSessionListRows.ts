import { useLocation, useParams } from 'react-router';

import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useParkedSessions, useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { allSessionRows, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { itemAwaitsPerson } from '../../factory/boardCardState';
import { useItemDecisions } from '../../factory/hooks/useBoardDecisions';
import { relatedWorkItemIndex } from '../../factory/services/relationships';
import type { WorkItem } from '../../factory/services/workItems';
import { isPullRequestSource } from '../../factory/services/workItems';
import { buildFactorySessionRow, buildUserSessionRow } from '../services/sessionRows';
import type { SessionListRow } from '../services/sessionRows';
import { usePinnedSessions } from './usePinnedSessions';

export function useSessionListRows(factoryId: string | undefined): {
  rows: SessionListRow[];
  hasRepositories: boolean;
  loaded: boolean;
  loadFailed: boolean;
  retry: () => void;
} {
  const { sessionId: routeSessionId } = useParams<{ sessionId: string }>();
  const { pathname } = useLocation();
  const query = useWorkspacesQuery(factoryId);
  const factory = useFactoryQuery(factoryId);
  const workItems = useWorkItemsQuery(factoryId);
  const parkedSessions = useParkedSessions(factoryId);
  const { proposalByItem, effectByItem } = useItemDecisions(factoryId);
  const viewer = useFactoryAuth().data?.user;
  const { pinnedSessions } = usePinnedSessions();
  const runningById = useActiveRunResources({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceIds: allSessionRows(query.data).map(session => session.sessionId),
  });

  const allWorkItems = workItems.data ?? [];
  const workItemBySessionId = new Map(
    allWorkItems.flatMap(item =>
      Object.values(item.sessions ?? {}).map(
        sessionRef => [sessionRef.sessionId, { item, threadId: sessionRef.threadId }] as const,
      ),
    ),
  );
  const relatedItemsFor = relatedWorkItemIndex(allWorkItems);
  const latestPullRequestFor = (item: WorkItem) => {
    if (isPullRequestSource(item.source)) return item;
    return relatedItemsFor(item)
      .filter(related => isPullRequestSource(related.source))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  };

  const factoryRows = (factoryId: string) =>
    (query.data?.workspaces ?? []).flatMap(session => {
      const workItemSession = workItemBySessionId.get(session.sessionId);
      const item = workItemSession?.item;
      const running = runningById[session.sessionId] === true;
      const active = session.sessionId === routeSessionId;
      if (!item && !active && !running && !workItems.isFetched) return [];
      return [
        buildFactorySessionRow({
          session,
          item,
          threadId: workItemSession?.threadId,
          pullRequest: item && latestPullRequestFor(item),
          factoryId,
          routeSessionId,
          running,
          attention:
            parkedSessions.has(session.sessionId) ||
            (item !== undefined && itemAwaitsPerson(proposalByItem.get(item.id), effectByItem.get(item.id))),
          pinned: pinnedSessions.has(session.sessionId),
          viewer,
        }),
      ];
    });
  const userRows = (factoryId: string) =>
    (query.data?.userSessions ?? []).map(session =>
      buildUserSessionRow({
        session,
        factoryId,
        pathname,
        running: runningById[session.sessionId] === true,
        pinned: pinnedSessions.has(session.sessionId),
        viewer,
      }),
    );

  return {
    rows: factoryId ? [...factoryRows(factoryId), ...userRows(factoryId)] : [],
    hasRepositories: (factory.data?.repositories.length ?? 0) > 0,
    loaded: query.isSuccess,
    loadFailed: query.isError,
    retry: () => void query.refetch(),
  };
}
