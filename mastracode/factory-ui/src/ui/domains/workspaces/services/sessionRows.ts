import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import type { InstalledBoardInfo } from '../../../../api/types';
import type { WorkspacePullRequestTarget } from '../../../../hooks/useWorkspacePullRequestMerges';
import {
  cardContextSessions,
  cardThreadSession,
  changeRequestNumberForItem,
  contextLabel,
  externalLinkLabel,
  pullRequestStatusForItem,
  sourceMetadata,
} from '../../factory/boardItems';
import { itemBoard } from '../../factory/boardStages';
import type { ChangeRequestProvider } from '../../factory/services/githubSubscriptions';
import type { WorkItem, WorkItemSource } from '../../factory/services/workItems';
import { getFactorySessionSource, getSessionOwnerDetails, getUserSessionLabel } from './sessionPresentation';
import type { SessionOwnerDetails, SessionSource, SessionViewerProfile } from './sessionPresentation';
import { sessionRowStatus } from './sessionStatus';
import type { SessionRowStatus } from './sessionStatus';
import { SLACK_SESSION_BRANCH_PREFIX } from './user-sessions';
import type { FactoryUserSession } from './user-sessions';

export type SessionActivityStatus = 'waiting' | 'working' | 'initializing' | 'idle' | 'done';

export const SESSION_STATUS_LABELS: Record<SessionActivityStatus, string> = {
  waiting: 'Waiting on you',
  working: 'Working',
  initializing: 'Initializing',
  idle: 'Idle',
  done: 'Done',
};

function isSessionActivityStatus(value: string): value is SessionActivityStatus {
  return value in SESSION_STATUS_LABELS;
}

export const SESSION_ACTIVITY_STATUSES: readonly SessionActivityStatus[] =
  Object.keys(SESSION_STATUS_LABELS).filter(isSessionActivityStatus);

export interface SessionOwner {
  userId: string;
  name: string;
}

export function sessionOwners(rows: readonly SessionListRow[]): SessionOwner[] {
  const nameByUserId = new Map(rows.map(row => [row.session.userId, row.owner.name]));
  return Array.from(nameByUserId, ([userId, name]) => ({ userId, name })).toSorted((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export interface SessionPullRequest {
  number?: number;
  provider: ChangeRequestProvider;
  knownMerged: boolean;
}

export interface SessionExternalLink {
  url: string;
  source: WorkItemSource;
  label: string;
}

export interface SessionListRow {
  session: FactoryUserSession;
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
  item?: WorkItem;
  /** The card this session belongs to, set with `contextLabel` for a card's own sessions. */
  itemId?: string;
  /** The context the card runs this session in, named for the sidebar (`Triage`, `Work`). */
  contextLabel?: string;
  threadId?: string;
  pullRequest?: SessionPullRequest;
  pinned: boolean;
  /** Every session of the card a card row stands for, so unpinning it clears a pin carried from another of them. */
  cardSessionIds?: readonly string[];
  createdAt: string;
  updatedAt: string;
}

export function sessionActivityStatus(row: {
  initializing: boolean;
  running: boolean;
  attention: boolean;
  settled: boolean;
}): SessionActivityStatus {
  const marker = sessionRowStatus(row);
  if (marker === 'ready') return 'waiting';
  return marker ?? (row.settled ? 'done' : 'idle');
}

export const STATUS_MARKER_BY_ACTIVITY: Record<SessionActivityStatus, SessionRowStatus | undefined> = {
  waiting: 'ready',
  working: 'working',
  initializing: 'initializing',
  idle: undefined,
  done: undefined,
};

function isOwnedByViewer(session: FactoryUserSession, viewer: SessionViewerProfile | undefined): boolean {
  return !viewer?.userId || session.userId === viewer.userId;
}

/** The board a session's card sits on; a session with no card (a pull request's review included) belongs to the default board. */
export function sessionBoard(item: WorkItem | undefined): string {
  return item ? itemBoard(item) : DEFAULT_BOARD_ID;
}

/**
 * Whether the card sits in a phase its board marks terminal. Only the catalog says which phases those
 * are (any board may name them anything), so until it loads, or while it fails and retries, no card
 * counts as finished here and its session reads as active; a card with a pull request still settles
 * on that pull request's state.
 */
function reachedTerminalPhase(item: WorkItem, boards: readonly InstalledBoardInfo[] | undefined): boolean {
  const board = boards?.find(candidate => candidate.id === itemBoard(item));
  return item.stages.some(stage => board?.phases.find(phase => phase.id === stage)?.kind === 'terminal');
}

function factorySessionName(session: FactoryUserSession, item: WorkItem | undefined): string {
  if (session.title !== undefined) return session.title;
  if (session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX) && item?.title !== undefined) return item.title;
  return session.branch;
}

function sessionExternalLinkLabel(source: WorkItemSource): string {
  if (source === 'github-pr') return 'Open pull request';
  if (source === 'gitlab-pr') return 'Open merge request';
  return externalLinkLabel(source);
}

function sessionExternalLinks(item: WorkItem | undefined, pullRequest?: WorkItem): SessionExternalLink[] {
  const links: SessionExternalLink[] = [];
  for (const candidate of [item, pullRequest]) {
    if (!candidate?.url || links.some(link => link.url === candidate.url)) continue;
    links.push({ url: candidate.url, source: candidate.source, label: sessionExternalLinkLabel(candidate.source) });
  }
  return links;
}

function isSettled(
  item: WorkItem | undefined,
  boards: readonly InstalledBoardInfo[] | undefined,
  pullRequest: WorkItem | undefined,
): boolean {
  if (item && reachedTerminalPhase(item, boards)) return true;
  if (!pullRequest) return false;
  const status = pullRequestStatusForItem(pullRequest);
  return status === 'merged' || status === 'closed';
}

function sessionPullRequest(pullRequest: WorkItem | undefined): SessionPullRequest | undefined {
  if (!pullRequest) return undefined;
  return {
    number: changeRequestNumberForItem(pullRequest),
    provider: pullRequest.source === 'gitlab-pr' ? 'gitlab' : 'github',
    knownMerged: sourceMetadata(pullRequest).merged === true || sourceMetadata(pullRequest).state === 'merged',
  };
}

export interface FactorySessionRowInput {
  session: FactoryUserSession;
  item: WorkItem | undefined;
  boards: readonly InstalledBoardInfo[] | undefined;
  /** The context the card filed the session under. */
  context?: string;
  threadId: string | undefined;
  pullRequest: WorkItem | undefined;
  factoryId: string;
  routeSessionId: string | undefined;
  running: boolean;
  attention: boolean;
  pinned: boolean;
  viewer: SessionViewerProfile | undefined;
}

export function buildFactorySessionRow({
  session,
  item,
  boards,
  context,
  threadId,
  pullRequest,
  factoryId,
  routeSessionId,
  running,
  attention,
  pinned,
  viewer,
}: FactorySessionRowInput): SessionListRow {
  const phases = item && boards?.find(board => board.id === itemBoard(item))?.phases;
  const url = `/factories/${factoryId}/workspaces/${session.sessionId}`;
  const ownedByViewer = isOwnedByViewer(session, viewer);
  return {
    session,
    origin: 'factory',
    board: sessionBoard(item),
    source: getFactorySessionSource(session, item),
    name: factorySessionName(session, item),
    url,
    openPath: `${url}/threads/${session.sessionId}`,
    externalLinks: sessionExternalLinks(item, pullRequest),
    active: session.sessionId === routeSessionId,
    status: sessionActivityStatus({
      initializing: !session.materializedAt,
      running,
      attention,
      settled: isSettled(item, boards, pullRequest),
    }),
    owner: getSessionOwnerDetails(session, viewer),
    ownedByViewer,
    canRegenerateTitle: ownedByViewer && session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX),
    item,
    ...(item && context !== undefined ? { itemId: item.id, contextLabel: contextLabel(context, phases) } : {}),
    threadId,
    pullRequest: sessionPullRequest(pullRequest),
    pinned,
    createdAt: session.createdAt,
    updatedAt: item?.updatedAt ?? session.updatedAt,
  };
}

const CARRIED_STATUSES: readonly SessionActivityStatus[] = ['waiting', 'working'];

/** The row a card lists: the session it opens, else the first of its sessions in the order the card lists them. */
function cardRow(
  cardRows: readonly SessionListRow[],
  boards: readonly InstalledBoardInfo[] | undefined,
): SessionListRow {
  const item = cardRows[0].item;
  if (!item) return cardRows[0];
  const phases = boards?.find(board => board.id === itemBoard(item))?.phases;
  const stage = item.stages[0] ?? '';
  const opened = cardThreadSession(item, phases, stage)?.sessionId;
  const order = cardContextSessions(item, phases, stage).map(entry => entry.ref.sessionId);
  const rank = (row: SessionListRow) => {
    if (row.session.sessionId === opened) return -1;
    const index = order.indexOf(row.session.sessionId);
    return index === -1 ? order.length : index;
  };
  return cardRows.toSorted((a, b) => rank(a) - rank(b))[0];
}

/**
 * A card lists one row, for its current session. The row takes on what any of
 * the card's sessions shows (running, waiting on you, pinned, open), so work in
 * another context isn't hidden.
 */
export function oneRowPerCard(
  rows: readonly SessionListRow[],
  boards: readonly InstalledBoardInfo[] | undefined,
): SessionListRow[] {
  const rowsByCard = new Map<string, SessionListRow[]>();
  for (const row of rows) {
    if (row.itemId === undefined) continue;
    rowsByCard.set(row.itemId, [...(rowsByCard.get(row.itemId) ?? []), row]);
  }
  return rows.flatMap(row => {
    const cardRows = row.itemId === undefined ? undefined : rowsByCard.get(row.itemId);
    if (!cardRows || cardRows.length === 1) return [row];
    const shown = cardRow(cardRows, boards);
    if (shown !== row) return [];
    const carried = CARRIED_STATUSES.find(status => cardRows.some(candidate => candidate.status === status));
    return [
      {
        ...shown,
        status: carried ?? shown.status,
        active: cardRows.some(candidate => candidate.active),
        pinned: cardRows.some(candidate => candidate.pinned),
        cardSessionIds: cardRows.map(candidate => candidate.session.sessionId),
      },
    ];
  });
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
  if (pin) next.add(row.session.sessionId);
  else for (const sessionId of row.cardSessionIds ?? [row.session.sessionId]) next.delete(sessionId);
  return next;
}

export interface UserSessionRowInput {
  session: FactoryUserSession;
  /** The work item a user session is bound to, if loaded. */
  item?: WorkItem;
  pullRequest?: WorkItem;
  factoryId: string;
  pathname: string;
  running: boolean;
  pinned: boolean;
  viewer: SessionViewerProfile | undefined;
}

export function buildUserSessionRow({
  session,
  item,
  pullRequest,
  factoryId,
  pathname,
  running,
  pinned,
  viewer,
}: UserSessionRowInput): SessionListRow {
  const url = `/factories/${factoryId}/user/threads/${session.sessionId}`;
  const ownedByViewer = isOwnedByViewer(session, viewer);
  const fromSlack = session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX);
  return {
    session,
    origin: 'user',
    board: undefined,
    source: fromSlack ? 'slack-thread' : 'user',
    name: (fromSlack && !session.title?.trim() && item?.title.trim()) || getUserSessionLabel(session),
    url,
    openPath: url,
    externalLinks: sessionExternalLinks(item, pullRequest),
    active: pathname === url,
    status: sessionActivityStatus({
      initializing: !session.materializedAt,
      running,
      attention: false,
      settled: false,
    }),
    owner: getSessionOwnerDetails(session, viewer),
    ownedByViewer,
    canRegenerateTitle: ownedByViewer,
    item,
    pinned,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function pullRequestMergeTarget({ session, threadId, pullRequest }: SessionListRow): WorkspacePullRequestTarget[] {
  if (!threadId || pullRequest?.number === undefined) return [];
  return [
    {
      sessionId: session.sessionId,
      threadId,
      pullRequestNumber: pullRequest.number,
      provider: pullRequest.provider,
      knownMerged: pullRequest.knownMerged,
    },
  ];
}

export function pullRequestMergeTargets(rows: readonly SessionListRow[]): WorkspacePullRequestTarget[] {
  return rows.flatMap(pullRequestMergeTarget);
}
