import type { SessionRowStatus } from '@mastra/factory/session/session-row-status';
import { SLACK_SESSION_BRANCH_PREFIX } from '@mastra/factory/work-item-branch';
import { isSettledChangeRequest } from '@mastra/factory/work-items/change-requests';
import type { CardChangeRequest, PullRequestStatus } from '@mastra/factory/work-items/change-requests';

import type { SessionRowWire, SessionRowsResponse } from '../../../../api/types';
import type { SessionPullRequestTarget } from '../../../../hooks/useSessionPullRequestSubscriptions';
import { CARD_SOURCES } from '../../factory/cardSources';
import { CHANGE_REQUEST_TERMS, changeRequestStatus } from '../../factory/changeRequestState';
import { cardLink } from '../../factory/services/workItems';
import type { WorkItemSource } from '../../factory/services/workItems';
import type { FactoryProject } from './github';
import { getFactorySessionSource, getSessionOwnerDetails, getUserSessionLabel } from './sessionPresentation';
import type { SessionOwnerDetails, SessionSource, SessionViewerProfile } from './sessionPresentation';

export type SessionActivityStatus = SessionRowWire['status'];

export const SESSION_STATUS_LABELS: Record<SessionActivityStatus, string> = {
  waiting: 'Waiting on you',
  working: 'Working',
  initializing: 'Initializing',
  idle: 'Idle',
  done: 'Done',
};

export interface SessionOwner {
  userId: string;
  name: string;
}

export function sessionOwners(
  owners: SessionRowsResponse['owners'],
  viewer: SessionViewerProfile | undefined,
): SessionOwner[] {
  return owners
    .map(({ userId, name, avatarUrl }) => ({
      userId,
      name: getSessionOwnerDetails({ userId, owner: { name, avatarUrl } }, viewer).name,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

export interface SessionExternalLink {
  url: string;
  source: WorkItemSource;
  label: string;
}

export type SessionRowSession = SessionRowWire['session'];

type SessionRowCard = NonNullable<SessionRowWire['card']>;

export interface SessionListRow {
  session: SessionRowSession;
  origin: 'factory' | 'user';
  board: string | undefined;
  source: SessionSource;
  name: string;
  url: string;
  openPath: string;
  externalLinks: readonly SessionExternalLink[];
  active: boolean;
  status: SessionActivityStatus;
  owner: SessionOwnerDetails;
  ownedByViewer: boolean;
  canRegenerateTitle: boolean;
  cardId?: string;
  threadId?: string;
  pullRequest?: CardChangeRequest;
  pullRequestStatus?: PullRequestStatus;
  repository?: string;
  pinned: boolean;
  /** Every session of the card a card row stands for, so unpinning it clears a pin carried from another of them. */
  cardSessionIds?: readonly string[];
  /** The card's other sessions, listed under its row when child sessions are revealed. */
  childRows?: readonly SessionListRow[];
  /** What a child row is named in the sidebar: the phase its session ran in. */
  phaseLabel?: string;
  /** Listed under a person's session, but the Factory owns and runs it. */
  runByFactory?: boolean;
  /** A followed card's phase session that waits on a person, answerable from this row. */
  waitingSessionId?: string;
  updatedAt: string;
}

export const STATUS_MARKER_BY_ACTIVITY: Record<SessionActivityStatus, SessionRowStatus | undefined> = {
  waiting: 'ready',
  working: 'working',
  initializing: 'initializing',
  idle: undefined,
  done: undefined,
};

export interface SessionRowPresentation {
  factoryId: string;
  openSessionId: string | undefined;
  viewer: SessionViewerProfile | undefined;
  repositories: readonly Pick<FactoryProject['repositories'][number], 'projectRepositoryId' | 'slug'>[] | undefined;
}

function isSlackSession(session: SessionRowSession): boolean {
  return session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX);
}

function factorySessionName(session: SessionRowSession, card: SessionRowCard | undefined): string {
  if (session.title !== null) return session.title;
  if (isSlackSession(session) && card) return card.title;
  return session.branch;
}

function sessionExternalLinkLabel(source: WorkItemSource): string {
  if (source === 'github-pr') return 'Open pull request';
  if (source === 'gitlab-pr') return 'Open merge request';
  return CARD_SOURCES[source].linkLabel;
}

function sessionExternalLinks(
  link: { source: WorkItemSource; url: string | null } | undefined,
  pullRequest: CardChangeRequest | undefined,
): SessionExternalLink[] {
  const links: SessionExternalLink[] = link?.url
    ? [{ url: link.url, source: link.source, label: sessionExternalLinkLabel(link.source) }]
    : [];
  if (pullRequest?.url && !links.some(existing => existing.url === pullRequest.url)) {
    const source = CHANGE_REQUEST_TERMS[pullRequest.provider].source;
    links.push({ url: pullRequest.url, source, label: sessionExternalLinkLabel(source) });
  }
  return links;
}

export function presentSessionRow(wire: SessionRowWire, presentation: SessionRowPresentation): SessionListRow {
  const { factoryId, openSessionId, viewer, repositories } = presentation;
  const { session, card } = wire;
  const link = card && cardLink(card);
  const ownedByViewer = !viewer?.userId || session.userId === viewer.userId;
  const shared = {
    session,
    status: wire.status,
    owner: getSessionOwnerDetails(session, viewer),
    ownedByViewer,
    active: openSessionId !== undefined && (wire.cardSessionIds ?? [session.sessionId]).includes(openSessionId),
    pinned: wire.pinned,
    updatedAt: wire.updatedAt,
    ...(card ? { cardId: card.id } : {}),
    ...(wire.cardSessionIds ? { cardSessionIds: wire.cardSessionIds } : {}),
    ...(wire.childRows ? { childRows: wire.childRows.map(child => presentSessionRow(child, presentation)) } : {}),
    ...(wire.phaseLabel !== undefined ? { phaseLabel: wire.phaseLabel } : {}),
    ...(wire.runByFactory ? { runByFactory: true } : {}),
    ...(wire.waitingSessionId !== undefined ? { waitingSessionId: wire.waitingSessionId } : {}),
  };
  if (wire.origin === 'user') {
    const url = `/factories/${factoryId}/user/threads/${session.sessionId}`;
    return {
      ...shared,
      origin: 'user',
      board: undefined,
      source: isSlackSession(session) ? 'slack-thread' : 'user',
      name: (isSlackSession(session) && !session.title?.trim() && card?.title.trim()) || getUserSessionLabel(session),
      url,
      openPath: url,
      externalLinks: sessionExternalLinks(link, wire.pullRequest),
      canRegenerateTitle: ownedByViewer,
    };
  }
  const url = `/factories/${factoryId}/workspaces/${session.sessionId}`;
  const { pullRequest } = wire;
  return {
    ...shared,
    origin: 'factory',
    board: wire.board,
    source: getFactorySessionSource(session, link),
    name: factorySessionName(session, card),
    url,
    openPath: `${url}/threads/${session.sessionId}`,
    externalLinks: sessionExternalLinks(link, pullRequest),
    canRegenerateTitle: ownedByViewer && isSlackSession(session),
    ...(wire.threadId !== undefined ? { threadId: wire.threadId } : {}),
    ...(pullRequest ? { pullRequest, pullRequestStatus: changeRequestStatus(pullRequest) } : {}),
    repository: repositories?.find(repository => repository.projectRepositoryId === session.projectRepositoryId)?.slug,
  };
}

/**
 * Pinning a row pins the session it shows. Unpinning a card's row unpins every
 * session of the card, since the row shows pinned while any of them is.
 */
export function pinnedSessionsAfter(
  pinned: ReadonlySet<string>,
  row: Pick<SessionListRow, 'session' | 'cardSessionIds'>,
  pin: boolean,
): ReadonlySet<string> {
  const next = new Set(pinned);
  next.delete(row.session.sessionId);
  if (pin) next.add(row.session.sessionId);
  else for (const sessionId of row.cardSessionIds ?? []) next.delete(sessionId);
  return next;
}

export function sessionPullRequestTargets(rows: readonly SessionListRow[]): SessionPullRequestTarget[] {
  return rows
    .flatMap(row => [row, ...(row.childRows ?? [])])
    .flatMap(({ session, threadId, pullRequest, pullRequestStatus }) => {
      if (!threadId || !pullRequest || isSettledChangeRequest(pullRequestStatus)) return [];
      return [{ sessionId: session.sessionId, threadId, provider: pullRequest.provider }];
    });
}
