import type { WorkItem } from '../ui/domains/factory/services/workItems';
import { useWorkItemsWithHistory } from './useWorkItems';

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
  // A thread of a Done or Canceled card the board never loaded is found in the full history.
  const items = useWorkItemsWithHistory(
    factoryProjectId,
    cards => threadId !== undefined && !findThreadWorkItem(cards, threadId, sessionId),
  );
  return { ...items, data: items.data && findThreadWorkItem(items.data, threadId, sessionId) };
}
