import { useLocation, useParams } from 'react-router';

import { useActiveRunResources } from '../../../../hooks/useActiveRunResources';
import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';
import { useFactoryQuery } from '../../../../hooks/useFactories';
import { useParkedSessions, useWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { allSessionRows, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { itemAwaitsPerson } from '../../factory/boardCardState';
import { useItemDecisions } from '../../factory/hooks/useBoardDecisions';
import { buildFactorySessionRow, buildUserSessionRow } from '../services/sessionRows';
import type { SessionListRow } from '../services/sessionRows';
import { sessionWorkItemIndex } from '../services/sessionWorkItems';
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
  const catalog = useBoardCatalog(factoryId);
  const viewer = useFactoryAuth().data?.user;
  const pinnedSessions = usePinnedSessions();
  const runningById = useActiveRunResources({
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceIds: allSessionRows(query.data).map(session => session.sessionId),
  });

  const loadState = {
    hasRepositories: (factory.data?.repositories.length ?? 0) > 0,
    loaded: query.isSuccess,
    loadFailed: query.isError,
    retry: () => void query.refetch(),
  };
  if (!factoryId) return { rows: [], ...loadState };

  const workItemBySessionId = sessionWorkItemIndex(workItems.data ?? []);
  const factoryRows = (query.data?.workspaces ?? []).flatMap(session => {
    const workItem = workItemBySessionId.get(session.sessionId);
    const running = runningById[session.sessionId] === true;
    const active = session.sessionId === routeSessionId;
    const boardStillUnknown = workItem ? !catalog.isFetched : !workItems.isFetched;
    if (boardStillUnknown && !active && !running) return [];
    const attention =
      parkedSessions.has(session.sessionId) ||
      (workItem !== undefined &&
        itemAwaitsPerson(proposalByItem.get(workItem.item.id), effectByItem.get(workItem.item.id)));
    return [
      buildFactorySessionRow({
        session,
        item: workItem?.item,
        boards: catalog.data,
        threadId: workItem?.threadId,
        pullRequest: workItem?.pullRequest,
        factoryId,
        routeSessionId,
        running,
        attention,
        pinned: pinnedSessions.has(session.sessionId),
        viewer,
      }),
    ];
  });
  const userRows = (query.data?.userSessions ?? []).map(session =>
    buildUserSessionRow({
      session,
      item: workItemBySessionId.get(session.sessionId)?.item,
      factoryId,
      pathname,
      running: runningById[session.sessionId] === true,
      pinned: pinnedSessions.has(session.sessionId),
      viewer,
    }),
  );

  return { rows: [...factoryRows, ...userRows], ...loadState };
}
