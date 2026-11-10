import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import type { InstalledBoardInfo } from '../../../../api/types';
import type { WorkspacePullRequestTarget } from '../../../../hooks/useWorkspacePullRequestMerges';
import {
  cardContextSessions,
  cardThreadSession,
  changeRequestNumberForItem,
  externalLinkLabel,
  pullRequestStatusForItem,
  sourceMetadata,
} from '../../factory/boardItems';
import type { PullRequestStatus } from '../../factory/boardItems';
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
  status: PullRequestStatus;
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
  /** The card this session belongs to, set for a card's own sessions. */
  itemId?: string;
  threadId?: string;
  pullRequest?: SessionPullRequest;
  pinned: boolean;
  /** Every session of the card a card row stands for, so unpinning it clears a pin carried from another of them. */
  cardSessionIds?: readonly string[];
  /** The card's other sessions, listed under its row when child sessions are revealed. */
  childRows?: readonly SessionListRow[];
  /** A card row's carried status (waiting or working wins across its sessions), for grouping when its children are revealed. */
  cardStatus?: SessionActivityStatus;
  /** What a child row is named in the sidebar: the phase its session ran in. */
  phaseLabel?: string;
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
    status: pullRequestStatusForItem(pullRequest),
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
    ...(item && context !== undefined ? { itemId: item.id } : {}),
    threadId,
    pullRequest: sessionPullRequest(pullRequest),
    pinned,
    createdAt: session.createdAt,
    updatedAt: item?.updatedAt ?? session.updatedAt,
  };
}

const CARRIED_STATUSES: readonly SessionActivityStatus[] = ['waiting', 'working'];

/**
 * A card's sessions in the order it lists them: the session it opens first, then
 * the rest in card order, then any the card no longer lists.
 */
function orderCardRows(
  cardRows: readonly SessionListRow[],
  boards: readonly InstalledBoardInfo[] | undefined,
): SessionListRow[] {
  const item = cardRows[0].item;
  if (!item) return [...cardRows];
  const phases = boards?.find(board => board.id === itemBoard(item))?.phases;
  const stage = item.stages[0] ?? '';
  const opened = cardThreadSession(item, phases, stage)?.sessionId;
  const sessions = cardContextSessions(item, phases, stage);
  const rank = (row: SessionListRow) => {
    if (row.session.sessionId === opened) return -1;
    const index = sessions.findIndex(entry => entry.ref.sessionId === row.session.sessionId);
    return index === -1 ? sessions.length : index;
  };
  const phaseLabel = (row: SessionListRow) =>
    sessions.find(entry => entry.ref.sessionId === row.session.sessionId)?.label;
  // The card's own row keeps its name; the sessions under it are named by phase.
  return cardRows
    .toSorted((a, b) => rank(a) - rank(b))
    .map((row, index) => (index === 0 ? row : { ...row, phaseLabel: phaseLabel(row) }));
}

export interface OneRowPerCardOptions {
  /** List the card's other sessions under its row instead of folding them into it. */
  revealChildSessions?: boolean;
}

/**
 * A card lists one row, for its current session. With child sessions hidden the
 * row takes on what any of the card's sessions shows (running, waiting on you),
 * so work in another context isn't hidden, and is open while any of them is;
 * revealed, each session shows its own state. The row is pinned while any of
 * the card's sessions is.
 */
export function oneRowPerCard(
  rows: readonly SessionListRow[],
  boards: readonly InstalledBoardInfo[] | undefined,
  { revealChildSessions = false }: OneRowPerCardOptions = {},
): SessionListRow[] {
  const rowsByCard = new Map<string, SessionListRow[]>();
  for (const row of rows) {
    if (row.itemId === undefined) continue;
    rowsByCard.set(row.itemId, [...(rowsByCard.get(row.itemId) ?? []), row]);
  }
  return rows.flatMap(row => {
    const cardRows = row.itemId === undefined ? undefined : rowsByCard.get(row.itemId);
    if (!cardRows || cardRows.length === 1) return [row];
    const [shown, ...others] = orderCardRows(cardRows, boards);
    if (shown !== row) return [];
    const shared = {
      pinned: cardRows.some(candidate => candidate.pinned),
      cardSessionIds: cardRows.map(candidate => candidate.session.sessionId),
    };
    const carried = CARRIED_STATUSES.find(status => cardRows.some(candidate => candidate.status === status));
    // Listed, each session shows its own state and the open one highlights.
    if (revealChildSessions) {
      return [{ ...shown, ...shared, cardStatus: carried ?? shown.status, childRows: others }];
    }
    return [
      {
        ...shown,
        ...shared,
        status: carried ?? shown.status,
        active: cardRows.some(candidate => candidate.active),
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
  return rows.flatMap(row => [row, ...(row.childRows ?? [])]).flatMap(pullRequestMergeTarget);
}
