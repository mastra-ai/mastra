import type { WorkItem } from '../ui/domains/factory/services/workItems';
import { useLookedUpWorkItems } from './useWorkItems';

/**
 * Threads carry no work-item ref of their own, so the card is found by its
 * session's threadId.
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
  // The thread's card, Done and Canceled included, read by thread id instead of the whole board.
  const items = useLookedUpWorkItems(factoryProjectId, threadId ? { kind: 'thread', ids: [threadId] } : undefined);
  return { ...items, data: items.data && findThreadWorkItem(items.data, threadId, sessionId) };
}
