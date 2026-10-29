import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { listThreadWorkItems } from '../ui/domains/factory/services/workItems';
import type { BoardSnapshot, WorkItem } from '../ui/domains/factory/services/workItems';
import { boardQueryOptions } from './useWorkItems';

/**
 * Threads carry no work-item ref of their own, so the card is found in the
 * board snapshot by its session's threadId — the board query is already
 * mounted and polling on both thread routes, so this adds no request.
 */
export function findThreadWorkItem(
  items: WorkItem[],
  threadId: string | undefined,
  sessionId?: string,
): WorkItem | undefined {
  if (!threadId) return undefined;
  const onThread = items.filter(item => Object.values(item.sessions).some(ref => ref.threadId === threadId));
  if (!sessionId) return onThread[0];
  // The session running this thread names the card exactly; the thread alone
  // still names it while a restarted session waits for the next board poll.
  const running = onThread.find(item =>
    Object.values(item.sessions).some(ref => ref.threadId === threadId && ref.sessionId === sessionId),
  );
  return running ?? onThread[0];
}

/**
 * The board snapshot leaves done and canceled cards behind, so a thread whose
 * card has closed misses there; one further read by thread finds it. That read
 * only fires once the board has loaded without the card.
 */
export function useThreadWorkItem(
  factoryProjectId: string | undefined,
  threadId: string | undefined,
  sessionId?: string,
) {
  const { baseUrl } = useApiConfig();
  const fromBoard = useQuery({
    ...boardQueryOptions(baseUrl, factoryProjectId),
    select: (board: BoardSnapshot) => findThreadWorkItem(board.workItems, threadId, sessionId),
  });
  const missedOnBoard = fromBoard.isSuccess && fromBoard.data === undefined;
  const fromThread = useQuery({
    queryKey: queryKeys.threadWorkItems(factoryProjectId, threadId),
    queryFn: ({ signal }) => listThreadWorkItems(baseUrl, factoryProjectId!, threadId!, signal),
    enabled: Boolean(factoryProjectId && threadId && missedOnBoard),
    select: (board: BoardSnapshot) => findThreadWorkItem(board.workItems, threadId, sessionId),
    // A closed card rarely changes; the board poll keeps live ones current.
    staleTime: 60_000,
  });
  if (!missedOnBoard) return fromBoard;
  return fromThread;
}
