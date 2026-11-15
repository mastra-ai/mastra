import type { SessionPullRequestTarget } from '../../../../hooks/useSessionPullRequestSubscriptions';
import { cardChangeRequest, changeRequestStatus, isSettledChangeRequest } from '../../factory/changeRequestState';
import type { CardChangeRequest } from '../../factory/changeRequestState';
import { relatedWorkItemIndex } from '../../factory/services/relationships';
import type { WorkItem } from '../../factory/services/workItems';
import { isPullRequestSource } from '../../factory/services/workItems';

export interface SessionWorkItem {
  item: WorkItem;
  /** The session context the card filed this session under (`triage`, `work`, …). */
  context: string;
  threadId: string;
  pullRequest: CardChangeRequest | undefined;
}

export function sessionWorkItemIndex(workItems: readonly WorkItem[]): ReadonlyMap<string, SessionWorkItem> {
  const relatedItemsFor = relatedWorkItemIndex(workItems);
  const pullRequestFor = (item: WorkItem): CardChangeRequest | undefined => {
    const own = cardChangeRequest(item);
    if (own) return own;
    const latest = relatedItemsFor(item)
      .filter(related => isPullRequestSource(related.source))
      .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return latest && cardChangeRequest(latest);
  };

  return new Map(
    workItems.flatMap(item => {
      // A legacy `plan` key may share its session with `work`; the current key names it.
      const sessionRefs = Object.entries(item.sessions ?? {}).toSorted(
        ([a], [b]) => Number(a === 'plan') - Number(b === 'plan'),
      );
      if (sessionRefs.length === 0) return [];
      const pullRequest = pullRequestFor(item);
      const seen = new Set<string>();
      return sessionRefs.flatMap(([context, sessionRef]) => {
        if (seen.has(sessionRef.sessionId)) return [];
        seen.add(sessionRef.sessionId);
        return [[sessionRef.sessionId, { item, context, threadId: sessionRef.threadId, pullRequest }] as const];
      });
    }),
  );
}

export function sessionPullRequestTargets(
  sessionIds: readonly string[],
  index: ReadonlyMap<string, SessionWorkItem>,
): SessionPullRequestTarget[] {
  return sessionIds.flatMap(sessionId => {
    const entry = index.get(sessionId);
    const pullRequest = entry?.pullRequest;
    const status = pullRequest && changeRequestStatus(pullRequest);
    if (!entry || !pullRequest || isSettledChangeRequest(status)) return [];
    return [{ sessionId, threadId: entry.threadId, provider: pullRequest.provider }];
  });
}
