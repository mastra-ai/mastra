import { boardOf } from '../../factory/boardFlow';
import type { BoardInfo } from '../../factory/boardFlow';
import type { WorkspacesData } from '../../../../hooks/useWorkspaces';
import { cardContextSessions, SOURCE_LABELS } from '../../factory/boardItems';
import type { CardContextSession } from '../../factory/boardItems';
import { currentItemStageLabel } from '../../factory/boardStages';
import { relationshipLabel, relationshipPath, workItemIdentifier } from '../../factory/services/relationships';
import type { WorkItem } from '../../factory/services/workItems';
import type { FactoryUserSession } from '../../workspaces/services/user-sessions';
import {
  getFactorySessionKind,
  getReviewBranchIdentifier,
  getUserSessionLabel,
  isAutomaticUserSessionBranch,
} from '../../workspaces/services/sessionPresentation';

export interface SessionSearchResult {
  id: string;
  kind: 'work-session' | 'review-session' | 'user-session';
  title: string;
  context: readonly string[];
  identifier?: string;
  value: string;
  path: string;
  preserveOrigin: boolean;
  updatedAt: string;
}

/** A board entry nobody has started yet. */
export interface WorkItemSearchResult {
  id: string;
  title: string;
  context: readonly string[];
  identifier?: string;
  value: string;
  path: string;
  updatedAt: string;
  item: WorkItem;
}

interface SessionWorkItem {
  item: WorkItem;
  /** The context the card holds this session under, so sessions on one card read apart. */
  session: CardContextSession;
}

function joinValue(parts: (string | undefined | null)[]): string {
  return parts.filter(part => part !== undefined && part !== null).join(' ');
}

function buildValue(
  session: FactoryUserSession,
  kind: SessionSearchResult['kind'],
  title: string,
  identifier: string | undefined,
  item: WorkItem | undefined,
  contextLabel?: string,
): string {
  return joinValue([
    title,
    kind,
    contextLabel,
    session.branch,
    session.baseBranch,
    session.sessionId,
    identifier,
    item?.sourceKey,
    item ? relationshipLabel(item) : undefined,
  ]);
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
  const contextSession = association?.session;
  // A card holds a session per context on one branch; the context label is what tells them apart.
  const context = contextSession
    ? [contextSession.label, ...(contextSession.current ? ['current'] : []), session.branch]
    : [`${factoryKind === 'review' ? 'Review' : 'Work'} session`, session.branch];
  const threadId = contextSession?.ref.threadId ?? session.sessionId;
  // Work items carry the issue/PR number; when they fail to load the review branch is the only place it survives.
  const identifier = (item ? workItemIdentifier(item) : undefined) ?? getReviewBranchIdentifier(session.branch);

  return {
    id: session.sessionId,
    kind,
    title,
    context,
    identifier,
    value: buildValue(session, kind, title, identifier, item, contextSession?.label),
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
    context: isAutomaticUserSessionBranch(session) ? ['User session'] : ['User session', session.branch],
    value: buildValue(session, kind, title, undefined, undefined),
    path: `/factories/${factoryId}/user/threads/${session.sessionId}`,
    preserveOrigin: false,
    updatedAt: session.updatedAt,
  };
}

function newestFirst(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function workItemsBySessionId(
  workItems: WorkItem[],
  boards: readonly BoardInfo[] | undefined,
): Map<string, SessionWorkItem> {
  const bySessionId = new Map<string, SessionWorkItem>();
  for (const item of [...workItems].sort(newestFirst)) {
    const phases = boardOf(boards, item)?.phases;
    for (const session of cardContextSessions(item, phases, item.stages[0] ?? '')) {
      if (!bySessionId.has(session.ref.sessionId)) bySessionId.set(session.ref.sessionId, { item, session });
    }
  }
  return bySessionId;
}

export function createSessionSearchGroups(input: {
  factoryId: string;
  repositories: WorkspacesData[];
  workItems: WorkItem[];
  /** The project's boards, once loaded, so each session reads by the phase it runs. */
  boards?: readonly BoardInfo[];
}): {
  work: SessionSearchResult[];
  review: SessionSearchResult[];
  user: SessionSearchResult[];
} {
  const bySessionId = workItemsBySessionId(input.workItems, input.boards);
  // Sessions on one card share its update time; the one its current phase runs in leads.
  const newestThenCurrent = (a: SessionSearchResult, b: SessionSearchResult) =>
    newestFirst(a, b) ||
    Number(bySessionId.get(b.id)?.session.current ?? false) - Number(bySessionId.get(a.id)?.session.current ?? false);
  const work: SessionSearchResult[] = [];
  const review: SessionSearchResult[] = [];
  const user: SessionSearchResult[] = [];

  for (const repository of input.repositories) {
    for (const session of repository.workspaces) {
      const result = createFactorySessionResult(input.factoryId, session, bySessionId.get(session.sessionId));
      if (result.kind === 'review-session') review.push(result);
      else work.push(result);
    }
    for (const session of repository.userSessions) {
      user.push(createUserSessionResult(input.factoryId, session));
    }
  }

  return {
    work: work.sort(newestThenCurrent),
    review: review.sort(newestThenCurrent),
    user: user.sort(newestFirst),
  };
}

/**
 * The card's number as the server's search reads it (`workItemNumber` in `@mastra/factory`): the
 * source's own, else the one given to a card filed by hand.
 */
function searchedNumber(item: WorkItem): string | undefined {
  const facts = item.workItem?.metadata;
  const number =
    facts?.number ?? facts?.githubIssueNumber ?? facts?.githubPullRequestNumber ?? item.metadata.cardNumber;
  return typeof number === 'number' ? `#${number}` : undefined;
}

function createWorkItemResult(factoryId: string, item: WorkItem, board: BoardInfo | undefined): WorkItemSearchResult {
  const identifier = workItemIdentifier(item);
  const sourceLabel = SOURCE_LABELS[item.source];
  const stage = currentItemStageLabel(item, board);

  return {
    id: item.id,
    title: item.title,
    context: [sourceLabel, stage, 'not started'],
    identifier,
    // Everything the server's search reads is in it, so a row the server matched passes the palette's filter too.
    value: joinValue([
      item.title,
      'work item',
      sourceLabel,
      stage,
      identifier,
      // Not always in the identifier, which leaves out the key of a card filed in Factory itself.
      item.workItem?.key,
      searchedNumber(item),
      item.sourceKey,
    ]),
    path: relationshipPath(item, factoryId),
    updatedAt: item.updatedAt,
    item,
  };
}

/** Board entries with no session to open: the cards nobody has started. */
export function createWorkItemSearchResults(input: {
  factoryId: string;
  /** The cards holding no session. */
  workItems: WorkItem[];
  /** The project's boards, once loaded, so each card's phase reads by its own board's name. */
  boards?: readonly BoardInfo[];
}): WorkItemSearchResult[] {
  return input.workItems
    .map(item => createWorkItemResult(input.factoryId, item, boardOf(input.boards, item)))
    .sort(newestFirst);
}
