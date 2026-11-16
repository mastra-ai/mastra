import type { SessionPullRequestTarget } from '../../../../hooks/useSessionPullRequestSubscriptions';
import { cardChangeRequest, isSettledChangeRequest } from '../../factory/changeRequestState';
import type { CardChangeRequest } from '../../factory/changeRequestState';
import { relatedWorkItemIndex } from '../../factory/services/relationships';
import type { WorkItem } from '../../factory/services/workItems';
import { isPullRequestSource } from '../../factory/services/workItems';
import type { SessionListRow } from './sessionRows';

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

export function sessionPullRequestTargets(rows: readonly SessionListRow[]): SessionPullRequestTarget[] {
  return rows
    .flatMap(row => [row, ...(row.childRows ?? [])])
    .flatMap(({ session, threadId, pullRequest, pullRequestStatus }) => {
      if (!threadId || !pullRequest || isSettledChangeRequest(pullRequestStatus)) return [];
      return [{ sessionId: session.sessionId, threadId, provider: pullRequest.provider }];
    });
}
