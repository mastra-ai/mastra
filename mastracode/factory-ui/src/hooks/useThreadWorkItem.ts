import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
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

export function useThreadWorkItem(
  factoryProjectId: string | undefined,
  threadId: string | undefined,
  sessionId?: string,
) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    ...boardQueryOptions(baseUrl, factoryProjectId),
    select: (board: BoardSnapshot) => findThreadWorkItem(board.workItems, threadId, sessionId),
  });
}
