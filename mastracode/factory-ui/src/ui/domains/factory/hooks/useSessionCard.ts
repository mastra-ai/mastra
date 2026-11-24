import { useParams } from 'react-router';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useSessionWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { boardOf } from '../boardFlow';

export function useSessionCard() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  const items = useSessionWorkItemsQuery(factoryId, sessionId);
  const boards = useBoardCatalog(factoryId);
  const sessionItems = items.data ?? [];
  const item =
    sessionId && threadId
      ? sessionItems.find(candidate =>
          Object.values(candidate.sessions).some(
            session => session.threadId === threadId && session.sessionId === sessionId,
          ),
        )
      : undefined;

  return {
    item,
    sessionItems,
    board: item ? boardOf(boards.data, item) : undefined,
    boards: boards.data,
    loading: items.isLoading,
    failed: items.isLoadingError,
    boardsLoading: boards.isLoading,
    boardsFailed: boards.isLoadingError,
  };
}
