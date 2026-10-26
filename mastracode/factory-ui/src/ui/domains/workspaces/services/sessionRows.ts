import type { InstalledBoardInfo } from '../../../../api/types';
import type { WorkspacePullRequestTarget } from '../../../../hooks/useWorkspacePullRequestMerges';
import { changeRequestNumberForItem, pullRequestStatusForItem } from '../../factory/boardItems';
import { itemBoard } from '../../factory/boardStages';
import type { ChangeRequestProvider } from '../../factory/services/githubSubscriptions';
import { relationshipLabel } from '../../factory/services/relationships';
import type { WorkItem } from '../../factory/services/workItems';
import { isTerminalStage } from '../../factory/stages';
import type { SessionPreviewDetails } from '../components/SessionPreviewCard';
import {
  getFactorySessionKind,
  getFactorySessionSource,
  getSessionOwnerDetails,
  getUserSessionLabel,
} from './sessionPresentation';
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

export interface SessionListRow {
  session: FactoryUserSession;
  origin: 'factory' | 'user';
  board: string | undefined;
  kind: SessionPreviewDetails['kind'];
  source: SessionSource;
  name: string;
  url: string;
  openPath: string;
  active: boolean;
  status: SessionActivityStatus;
  owner: SessionOwnerDetails;
  ownedByViewer: boolean;
  canRegenerateTitle: boolean;
  itemLabel?: string;
  itemTitle?: string;
  threadId?: string;
  pullRequest?: SessionPullRequest;
  pinned: boolean;
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

export function sessionBoard(item: WorkItem | undefined): string {
  // Pull requests live on Work, so a session whose card has not loaded yet groups there too.
  return item ? itemBoard(item) : 'work';
}

function reachedTerminalPhase(item: WorkItem, boards: readonly InstalledBoardInfo[] | undefined): boolean {
  const board = boards?.find(candidate => candidate.id === itemBoard(item));
  return item.stages.some(
    stage => isTerminalStage(stage) || board?.phases.find(phase => phase.id === stage)?.kind === 'terminal',
  );
}

function factorySessionName(session: FactoryUserSession, item: WorkItem | undefined): string {
  if (session.title !== undefined) return session.title;
  if (session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX) && item?.title !== undefined) return item.title;
  return session.branch;
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
    knownMerged: pullRequest.metadata.merged === true,
  };
}

export interface FactorySessionRowInput {
  session: FactoryUserSession;
  item: WorkItem | undefined;
  boards: readonly InstalledBoardInfo[] | undefined;
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
    kind: getFactorySessionKind(session, item) === 'review' ? 'Review session' : 'Work session',
    source: getFactorySessionSource(session, item),
    name: factorySessionName(session, item),
    url,
    openPath: `${url}/threads/${session.sessionId}`,
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
    itemLabel: item && item.source !== 'manual' ? relationshipLabel(item) : undefined,
    itemTitle: item?.title,
    threadId,
    pullRequest: sessionPullRequest(pullRequest),
    pinned,
    createdAt: session.createdAt,
    updatedAt: item?.updatedAt ?? session.updatedAt,
  };
}

export interface UserSessionRowInput {
  session: FactoryUserSession;
  /** The work item a Slack-origin user session is bound to, if loaded. */
  item?: WorkItem;
  factoryId: string;
  pathname: string;
  running: boolean;
  pinned: boolean;
  viewer: SessionViewerProfile | undefined;
}

export function buildUserSessionRow({
  session,
  item,
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
    kind: 'User session',
    source: fromSlack ? 'slack-thread' : 'user',
    name: (fromSlack && !session.title?.trim() && item?.title.trim()) || getUserSessionLabel(session),
    url,
    openPath: url,
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
