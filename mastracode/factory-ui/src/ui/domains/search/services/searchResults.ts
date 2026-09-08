import type { WorkspacesData } from '../../../../hooks/useWorkspaces';
import { issueCandidate, pullRequestCandidate } from '../../factory/boardCandidates';
import type { BoardCandidate } from '../../factory/boardCandidates';
import { persistedSourceKeys, SOURCE_LABELS } from '../../factory/boardItems';
import { currentItemStageLabel } from '../../factory/boardStages';
import type { GithubIssue, GithubPullRequest } from '../../factory/services/factory';
import { relationshipLabel, relationshipPath, workItemIdentifier } from '../../factory/services/relationships';
import type { WorkItem, WorkItemSessionRef } from '../../factory/services/workItems';
import { stageLabel } from '../../factory/stages';
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
  context: string;
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
  context: string;
  identifier?: string;
  value: string;
  path: string;
  updatedAt: string;
  target: { kind: 'work-item'; item: WorkItem } | { kind: 'candidate'; candidate: BoardCandidate };
}

interface SessionWorkItem {
  item: WorkItem;
  ref: WorkItemSessionRef;
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
): string {
  return joinValue([
    title,
    kind,
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
  const context = `${factoryKind === 'review' ? 'Review' : 'Work'} session · ${session.branch}`;
  const threadId = association?.ref.threadId ?? session.sessionId;
  // Work items carry the issue/PR number; when they fail to load the review branch is the only place it survives.
  const identifier = (item ? workItemIdentifier(item) : undefined) ?? getReviewBranchIdentifier(session.branch);

  return {
    id: session.sessionId,
    kind,
    title,
    context,
    identifier,
    value: buildValue(session, kind, title, identifier, item),
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
    context: isAutomaticUserSessionBranch(session) ? 'User session' : `User session · ${session.branch}`,
    value: buildValue(session, kind, title, undefined, undefined),
    path: `/factories/${factoryId}/user/threads/${session.sessionId}`,
    preserveOrigin: false,
    updatedAt: session.updatedAt,
  };
}

function newestFirst(a: { updatedAt: string }, b: { updatedAt: string }): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

function workItemsBySessionId(workItems: WorkItem[]): Map<string, SessionWorkItem> {
  const bySessionId = new Map<string, SessionWorkItem>();
  for (const item of [...workItems].sort(newestFirst)) {
    for (const ref of Object.values(item.sessions)) {
      if (!bySessionId.has(ref.sessionId)) bySessionId.set(ref.sessionId, { item, ref });
    }
  }
  return bySessionId;
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
  const bySessionId = workItemsBySessionId(input.workItems);
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
    work: work.sort(newestFirst),
    review: review.sort(newestFirst),
    user: user.sort(newestFirst),
  };
}

function createWorkItemResult(factoryId: string, item: WorkItem): WorkItemSearchResult {
  const identifier = workItemIdentifier(item);
  const sourceLabel = SOURCE_LABELS[item.source];
  const stage = currentItemStageLabel(item);

  return {
    id: item.id,
    title: item.title,
    context: `${sourceLabel} · ${stage} · not started`,
    identifier,
    value: joinValue([item.title, 'work item', sourceLabel, stage, identifier, item.sourceKey]),
    path: relationshipPath(item, factoryId),
    updatedAt: item.updatedAt,
    target: { kind: 'work-item', item },
  };
}

function createCandidateResult(factoryId: string, candidate: BoardCandidate, updatedAt: string): WorkItemSearchResult {
  const identifier = workItemIdentifier(candidate);
  const sourceLabel = SOURCE_LABELS[candidate.source];
  const stage = stageLabel(candidate.column);

  return {
    id: candidate.sourceKey,
    title: candidate.title,
    context: `${sourceLabel} · ${stage} · not filed`,
    identifier,
    value: joinValue([candidate.title, 'work item', sourceLabel, stage, identifier, candidate.sourceKey]),
    path: relationshipPath(candidate, factoryId),
    updatedAt,
    target: { kind: 'candidate', candidate },
  };
}

/** Board entries with no session to open: unstarted cards, plus live candidates not yet filed as one. */
export function createWorkItemSearchResults(input: {
  factoryId: string;
  workItems: WorkItem[];
  issues: GithubIssue[];
  pullRequests: GithubPullRequest[];
}): WorkItemSearchResult[] {
  const filed = persistedSourceKeys(input.workItems);
  const candidates = [
    ...input.issues.map(issue => ({ candidate: issueCandidate(issue), updatedAt: issue.updatedAt })),
    ...input.pullRequests.map(pr => ({ candidate: pullRequestCandidate(pr), updatedAt: pr.updatedAt })),
  ].filter(({ candidate }) => !filed.has(candidate.sourceKey));

  return [
    ...input.workItems
      .filter(item => Object.keys(item.sessions).length === 0)
      .map(item => createWorkItemResult(input.factoryId, item)),
    ...candidates.map(({ candidate, updatedAt }) => createCandidateResult(input.factoryId, candidate, updatedAt)),
  ].sort(newestFirst);
}
