import { useMemo } from 'react';

import { mergeCards, useLookedUpWorkItems, useUnstartedWorkItems } from '../../../../hooks/useWorkItems';
import { allSessionRows, useWorkspacesQuery } from '../../../../hooks/useWorkspaces';

/**
 * The cards search needs, without the full board: each listed session's card, which titles the session
 * results — the same lookup the sidebar makes — plus the open cards with no session yet, searchable on their own.
 */
export function useGlobalSearchWorkItems(factoryId: string | undefined) {
  const workspaces = useWorkspacesQuery(factoryId);
  const sessions = useLookedUpWorkItems(factoryId, {
    kind: 'session',
    ids: allSessionRows(workspaces.data).map(session => session.sessionId),
  });
  const unstarted = useUnstartedWorkItems(factoryId);
  const items = useMemo(() => mergeCards(sessions.data, unstarted.data ?? []), [sessions.data, unstarted.data]);

  return {
    items,
    pending: sessions.isLoading || unstarted.isLoading,
    failed: sessions.isError || unstarted.isError,
    retry: () => {
      void sessions.refetch();
      void unstarted.refetch();
    },
  };
}
