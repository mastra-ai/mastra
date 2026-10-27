import { relatedWorkItemIndex } from '../../factory/services/relationships';
import type { WorkItem } from '../../factory/services/workItems';
import { isPullRequestSource } from '../../factory/services/workItems';

export interface SessionWorkItem {
  item: WorkItem;
  threadId: string;
  /** The context key the card files this session under, e.g. `build`. */
  context: string;
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
      const sessionRefs = Object.entries(item.sessions ?? {});
      if (sessionRefs.length === 0) return [];
      const pullRequest = latestPullRequestFor(item);
      return sessionRefs.map(
        ([context, sessionRef]) =>
          [sessionRef.sessionId, { item, threadId: sessionRef.threadId, context, pullRequest }] as const,
      );
    }),
  );
}
