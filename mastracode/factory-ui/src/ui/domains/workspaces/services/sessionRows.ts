import type { WorkspacePullRequestTarget } from '../../../../hooks/useWorkspacePullRequestMerges';
import { changeRequestNumberForItem, pullRequestStatusForItem } from '../../factory/boardItems';
import { itemBoard } from '../../factory/boardStages';
import type { ChangeRequestProvider } from '../../factory/services/githubSubscriptions';
import { relationshipLabel } from '../../factory/services/relationships';
import type { WorkItem } from '../../factory/services/workItems';
import { isTerminalStage } from '../../factory/stages';
import type { SessionPreviewDetails } from '../components/SessionPreviewCard';
import { getFactorySessionKind, getSessionOwnerDetails, getUserSessionLabel } from './sessionPresentation';
import type { SessionOwnerDetails, SessionViewerProfile } from './sessionPresentation';
import { sessionRowStatus } from './sessionStatus';
import type { SessionRowStatus } from './sessionStatus';
import type { FactoryUserSession } from './user-sessions';

export type SessionActivityStatus = 'waiting' | 'working' | 'initializing' | 'idle' | 'done';

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
  name: string;
  url: string;
  openPath: string;
  active: boolean;
  status: SessionActivityStatus;
  owner: SessionOwnerDetails;
  ownedByViewer: boolean;
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

export function sessionBoard(session: FactoryUserSession, item: WorkItem | undefined): string {
  return item ? itemBoard(item) : getFactorySessionKind(session, undefined);
}

function isSettled(item: WorkItem | undefined, pullRequest: WorkItem | undefined): boolean {
  if (item?.stages.some(isTerminalStage)) return true;
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
  return {
    session,
    origin: 'factory',
    board: sessionBoard(session, item),
    kind: getFactorySessionKind(session, item) === 'review' ? 'Review session' : 'Work session',
    name: session.title ?? (session.branch.startsWith('slack/') ? item?.title : undefined) ?? session.branch,
    url,
    openPath: `${url}/threads/${session.sessionId}`,
    active: session.sessionId === routeSessionId,
    status: sessionActivityStatus({
      initializing: !session.materializedAt,
      running,
      attention,
      settled: isSettled(item, pullRequest),
    }),
    owner: getSessionOwnerDetails(session, viewer),
    ownedByViewer: isOwnedByViewer(session, viewer),
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
  factoryId: string;
  pathname: string;
  running: boolean;
  pinned: boolean;
  viewer: SessionViewerProfile | undefined;
}

export function buildUserSessionRow({
  session,
  factoryId,
  pathname,
  running,
  pinned,
  viewer,
}: UserSessionRowInput): SessionListRow {
  const url = `/factories/${factoryId}/user/threads/${session.sessionId}`;
  return {
    session,
    origin: 'user',
    board: undefined,
    kind: 'User session',
    name: getUserSessionLabel(session),
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
    ownedByViewer: isOwnedByViewer(session, viewer),
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
      projectPath: session.sessionId,
      pullRequestNumber: pullRequest.number,
      provider: pullRequest.provider,
      knownMerged: pullRequest.knownMerged,
    },
  ];
}

export function pullRequestMergeTargets(rows: readonly SessionListRow[]): WorkspacePullRequestTarget[] {
  return rows.flatMap(pullRequestMergeTarget);
}
