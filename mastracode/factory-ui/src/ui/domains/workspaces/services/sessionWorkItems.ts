import { relatedWorkItemIndex } from '../../factory/services/relationships';
import type { WorkItem } from '../../factory/services/workItems';
import { isPullRequestSource } from '../../factory/services/workItems';

export interface SessionWorkItem {
  item: WorkItem;
  threadId: string;
  pullRequest: WorkItem | undefined;
}

export function sessionWorkItemIndex(workItems: readonly WorkItem[]): ReadonlyMap<string, SessionWorkItem> {
  const relatedItemsFor = relatedWorkItemIndex(workItems);
  const latestPullRequestFor = (item: WorkItem): WorkItem | undefined => {
    if (isPullRequestSource(item.source)) return item;
    return relatedItemsFor(item)
      .filter(related => isPullRequestSource(related.source))
      .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  };

  return new Map(
    workItems.flatMap(item => {
      const sessionRefs = Object.values(item.sessions ?? {});
      if (sessionRefs.length === 0) return [];
      const pullRequest = latestPullRequestFor(item);
      return sessionRefs.map(
        sessionRef => [sessionRef.sessionId, { item, threadId: sessionRef.threadId, pullRequest }] as const,
      );
    }),
  );
}

/** The listed sessions whose cards the board lacks — finished before its window — as one card lookup. */
export function missingSessionLookup(
  cards: readonly WorkItem[],
  sessions: readonly { sessionId: string }[],
): { kind: 'session'; ids: string[] } | undefined {
  const index = sessionWorkItemIndex(cards);
  const ids = sessions.flatMap(session => (index.has(session.sessionId) ? [] : [session.sessionId]));
  return ids.length > 0 ? { kind: 'session', ids } : undefined;
}
