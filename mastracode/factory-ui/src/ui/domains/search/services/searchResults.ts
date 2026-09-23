import type { WorkspacesData } from '../../../../hooks/useWorkspaces';
import type { BoardCandidate } from '../../factory/boardCandidates';
import { persistedSourceKeys, SOURCE_LABELS } from '../../factory/boardItems';
import { currentItemStageLabel } from '../../factory/boardStages';
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

/** Every external-user field the search should treat as a `@me` match target for a card. */
function externalActorIdsForCard(card: Pick<WorkItem, 'source' | 'metadata'>): {
  integrationId: string;
  externalUserIds: string[];
} | null {
  const authors: string[] = [];
  const meta = card.metadata;
  const pushString = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length > 0) authors.push(value.trim().toLowerCase());
  };
  const pushList = (value: unknown) => {
    if (Array.isArray(value)) for (const entry of value) pushString(entry);
  };
  let integrationId: string | null = null;
  if (card.source === 'github-issue' || card.source === 'github-pr') {
    integrationId = 'github';
    pushString(meta.author);
    pushString(meta.assignee);
    pushList(meta.assignees);
    pushList(meta.requestedReviewers);
  } else if (card.source === 'linear-issue') {
    integrationId = 'linear';
    pushString(meta.assignee ?? meta.linearAssignee);
    pushString(meta.creator ?? meta.linearCreator ?? meta.author);
  } else if (card.source === 'jira-issue') {
    integrationId = 'jira';
    pushString(meta.assignee);
    pushString(meta.creator ?? meta.author);
  } else if (card.source === 'incidentio-follow-up') {
    integrationId = 'incidentio';
    pushString(meta.assignee);
    pushString(meta.creator ?? meta.reporter);
  }
  if (!integrationId) return null;
  return { integrationId, externalUserIds: [...new Set(authors)] };
}

/**
 * When the acting user has claimed at least one external account whose id
 * appears on this card, we append `@me` to the card's fuzzy-search `value`.
 * `cmdk` then picks it up whenever a user types `@me` — no extra parsing
 * pass and no bespoke query language, just the same value scheme every
 * other result uses.
 */
function meTokenForCard(
  card: Pick<WorkItem, 'source' | 'metadata'>,
  resolvedMe: ReadonlyMap<string, ReadonlySet<string>> | undefined,
): string | undefined {
  if (!resolvedMe || resolvedMe.size === 0) return undefined;
  const actors = externalActorIdsForCard(card);
  if (!actors) return undefined;
  const claims = resolvedMe.get(actors.integrationId);
  if (!claims || claims.size === 0) return undefined;
  return actors.externalUserIds.some(id => claims.has(id)) ? '@me' : undefined;
}

function createWorkItemResult(
  factoryId: string,
  item: WorkItem,
  resolvedMe?: ReadonlyMap<string, ReadonlySet<string>>,
): WorkItemSearchResult {
  const identifier = workItemIdentifier(item);
  const sourceLabel = SOURCE_LABELS[item.source];
  const stage = currentItemStageLabel(item);

  return {
    id: item.id,
    title: item.title,
    context: `${sourceLabel} · ${stage} · not started`,
    identifier,
    value: joinValue([
      item.title,
      'work item',
      sourceLabel,
      stage,
      identifier,
      item.sourceKey,
      meTokenForCard(item, resolvedMe),
    ]),
    path: relationshipPath(item, factoryId),
    updatedAt: item.updatedAt,
    target: { kind: 'work-item', item },
  };
}

function createCandidateResult(
  factoryId: string,
  candidate: BoardCandidate,
  updatedAt: string,
  resolvedMe?: ReadonlyMap<string, ReadonlySet<string>>,
): WorkItemSearchResult {
  const identifier = workItemIdentifier(candidate);
  const sourceLabel = SOURCE_LABELS[candidate.source];
  const stage = stageLabel(candidate.column);

  return {
    id: candidate.sourceKey,
    title: candidate.title,
    context: `${sourceLabel} · ${stage} · not filed`,
    identifier,
    value: joinValue([
      candidate.title,
      'work item',
      sourceLabel,
      stage,
      identifier,
      candidate.sourceKey,
      meTokenForCard(candidate, resolvedMe),
    ]),
    path: relationshipPath(candidate, factoryId),
    updatedAt,
    target: { kind: 'candidate', candidate },
  };
}

/**
 * Board entries with no session to open: unstarted cards, plus live candidates
 * not yet filed as one. `resolvedMe` is threaded through so cards whose
 * external author/assignee/reviewer matches one of the acting user's claims
 * pick up a hidden `@me` token in their search value.
 */
export function createWorkItemSearchResults(input: {
  factoryId: string;
  workItems: WorkItem[];
  candidates: Array<{ candidate: BoardCandidate; updatedAt: string }>;
  resolvedMe?: ReadonlyMap<string, ReadonlySet<string>>;
}): WorkItemSearchResult[] {
  const filed = persistedSourceKeys(input.workItems);
  const candidates = input.candidates.filter(({ candidate }) => !filed.has(candidate.sourceKey));

  return [
    ...input.workItems
      .filter(item => Object.keys(item.sessions).length === 0)
      .map(item => createWorkItemResult(input.factoryId, item, input.resolvedMe)),
    ...candidates.map(({ candidate, updatedAt }) =>
      createCandidateResult(input.factoryId, candidate, updatedAt, input.resolvedMe),
    ),
  ].sort(newestFirst);
}
