import { useParams } from 'react-router';

import { useBoardCatalog } from '../../../../hooks/useBoardCatalog';
import { useSessionWorkItemsQuery } from '../../../../hooks/useWorkItems';
import { boardOf } from '../boardFlow';

/**
 * The card the routed Factory session works, with the session's other cards and the card's board.
 * Personal sessions route without a session id and hold no card.
 */
export function useSessionCard() {
  const { factoryId, sessionId, threadId } = useParams<{ factoryId: string; sessionId: string; threadId: string }>();
  const items = useSessionWorkItemsQuery(factoryId, sessionId);
  const boards = useBoardCatalog(factoryId);
  // The session's cards and the cards related to them, not the board.
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
    /** The card's board, once the catalog has loaded. */
    board: item ? boardOf(boards.data, item) : undefined,
    boards: boards.data,
    loading: items.isLoading,
  };
}
