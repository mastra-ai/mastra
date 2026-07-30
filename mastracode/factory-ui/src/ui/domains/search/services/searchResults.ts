import type { WorkspacesData } from '../../../../hooks/useWorkspaces';
import { relationshipLabel } from '../../factory/services/relationships';
import type { WorkItem, WorkItemSessionRef } from '../../factory/services/workItems';
import type { FactoryUserSession } from '../../workspaces/services/github';
import { getFactorySessionKind, getUserSessionLabel } from '../../workspaces/services/sessionPresentation';

export interface SessionSearchResult {
  id: string;
  kind: 'work-session' | 'review-session' | 'user-session';
  title: string;
  context: string;
  value: string;
  path: string;
  preserveOrigin: boolean;
  updatedAt: string;
}

interface SessionWorkItem {
  item: WorkItem;
  ref: WorkItemSessionRef;
}

function buildValue(
  session: FactoryUserSession,
  kind: SessionSearchResult['kind'],
  title: string,
  item: WorkItem | undefined,
): string {
  const relationship = item ? relationshipLabel(item) : undefined;
  return [title, kind, session.branch, session.baseBranch, session.sessionId, item?.sourceKey, relationship]
    .filter(value => value !== undefined && value !== null)
    .join(' ');
}

function createFactorySessionResult(
  factoryId: string,
  session: FactoryUserSession,
  association: SessionWorkItem | undefined,
): SessionSearchResult {
  const item = association?.item;
  const factoryKind = getFactorySessionKind(session, item);
  const kind: SessionSearchResult['kind'] = factoryKind === 'review' ? 'review-session' : 'work-session';
  const title = item?.title ?? session.branch;
  const context = `${factoryKind === 'review' ? 'Review' : 'Work'} session · ${session.branch}`;
  const threadId = association?.ref.threadId ?? session.sessionId;

  return {
    id: session.sessionId,
    kind,
    title,
    context,
    value: buildValue(session, kind, title, item),
    path: `/factories/${factoryId}/workspaces/${session.sessionId}/threads/${threadId}`,
    preserveOrigin: true,
    updatedAt: item?.updatedAt ?? session.updatedAt,
  };
}

function createUserSessionResult(factoryId: string, session: FactoryUserSession): SessionSearchResult {
  const kind = 'user-session';
  const title = getUserSessionLabel(session);

  return {
    id: session.sessionId,
    kind,
    title,
    context: `User session · ${session.branch}`,
    value: buildValue(session, kind, title, undefined),
    path: `/factories/${factoryId}/user/threads/${session.sessionId}`,
    preserveOrigin: false,
    updatedAt: session.updatedAt,
  };
}

export function createSessionSearchGroups(input: {
  factoryId: string;
  repositories: WorkspacesData[];
  workItems: WorkItem[];
}): {
  work: SessionSearchResult[];
  review: SessionSearchResult[];
  user: SessionSearchResult[];
} {
  const workItemBySessionId = new Map<string, SessionWorkItem>();
  const workItemsByNewest = [...input.workItems].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const item of workItemsByNewest) {
    for (const ref of Object.values(item.sessions)) {
      if (!workItemBySessionId.has(ref.sessionId)) workItemBySessionId.set(ref.sessionId, { item, ref });
    }
  }

  const work: SessionSearchResult[] = [];
  const review: SessionSearchResult[] = [];
  const user: SessionSearchResult[] = [];

  for (const repository of input.repositories) {
    for (const session of repository.workspaces) {
      const result = createFactorySessionResult(input.factoryId, session, workItemBySessionId.get(session.sessionId));
      if (result.kind === 'review-session') review.push(result);
      else work.push(result);
    }
    for (const session of repository.userSessions) {
      user.push(createUserSessionResult(input.factoryId, session));
    }
  }

  const newestFirst = (a: SessionSearchResult, b: SessionSearchResult) => b.updatedAt.localeCompare(a.updatedAt);
  return {
    work: work.sort(newestFirst),
    review: review.sort(newestFirst),
    user: user.sort(newestFirst),
  };
}
