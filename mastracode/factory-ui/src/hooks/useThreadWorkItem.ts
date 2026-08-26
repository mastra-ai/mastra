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
  const byThread = items.filter(item => Object.values(item.sessions).some(ref => ref.threadId === threadId));
  if (byThread.length <= 1) return byThread[0];
  const bySession = sessionId
    ? byThread.find(item =>
        Object.values(item.sessions).some(ref => ref.threadId === threadId && ref.sessionId === sessionId),
      )
    : undefined;
  return bySession ?? byThread[0];
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
