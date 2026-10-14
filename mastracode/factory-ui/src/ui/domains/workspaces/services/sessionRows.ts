import { changeRequestNumberForItem, pullRequestStatusForItem } from '../../factory/boardItems';
import { itemBoard } from '../../factory/boardStages';
import type { ChangeRequestProvider } from '../../factory/services/githubSubscriptions';
import { relationshipLabel } from '../../factory/services/relationships';
import type { WorkItem } from '../../factory/services/workItems';
import { isTerminalStage } from '../../factory/stages';
import type { SessionPreviewDetails } from '../components/SessionPreviewCard';
import { getFactorySessionKind, getSessionOwnerDetails, getUserSessionLabel } from './sessionPresentation';
import type { SessionViewerProfile } from './sessionPresentation';
import type { FactoryUserSession } from './user-sessions';

export type SessionActivityStatus = 'waiting' | 'working' | 'initializing' | 'idle' | 'done';

export interface SessionListRow {
  session: FactoryUserSession;
  origin: 'factory' | 'user';
  /** Undefined for user sessions: they belong to no board. */
  board: string | undefined;
  kind: SessionPreviewDetails['kind'];
  name: string;
  url: string;
  openPath: string;
  active: boolean;
  initializing: boolean;
  running: boolean;
  attention: boolean;
  settled: boolean;
  status: SessionActivityStatus;
  ownerName: string;
  itemLabel?: string;
  itemTitle?: string;
  threadId?: string;
  pullRequestNumber?: number;
  provider: ChangeRequestProvider;
  knownMerged: boolean;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Same precedence as `sessionRowStatus`, extended with the quiet states a filter or group can name. */
export function sessionActivityStatus(row: {
  initializing: boolean;
  running: boolean;
  attention: boolean;
  settled: boolean;
}): SessionActivityStatus {
  if (row.initializing) return 'initializing';
  if (row.running) return 'working';
  if (row.attention) return 'waiting';
  if (row.settled) return 'done';
  return 'idle';
}

/** A linked work item knows its board; only an orphan session falls back to reading its branch. */
export function sessionBoard(session: FactoryUserSession, item: WorkItem | undefined): string {
  return item ? itemBoard(item) : getFactorySessionKind(session, undefined);
}

function isSettled(item: WorkItem | undefined, pullRequest: WorkItem | undefined): boolean {
  if (item?.stages.some(isTerminalStage)) return true;
  if (!pullRequest) return false;
  const status = pullRequestStatusForItem(pullRequest);
  return status === 'merged' || status === 'closed';
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
  const initializing = !session.materializedAt;
  const settled = isSettled(item, pullRequest);
  return {
    session,
    origin: 'factory',
    board: sessionBoard(session, item),
    kind: getFactorySessionKind(session, item) === 'review' ? 'Review session' : 'Work session',
    name: session.title ?? (session.branch.startsWith('slack/') ? item?.title : undefined) ?? session.branch,
    url,
    openPath: `${url}/threads/${session.sessionId}`,
    active: session.sessionId === routeSessionId,
    initializing,
    running,
    attention,
    settled,
    status: sessionActivityStatus({ initializing, running, attention, settled }),
    ownerName: getSessionOwnerDetails(session, viewer).name,
    itemLabel: item && item.source !== 'manual' ? relationshipLabel(item) : undefined,
    itemTitle: item?.title,
    threadId,
    pullRequestNumber: pullRequest ? changeRequestNumberForItem(pullRequest) : undefined,
    provider: pullRequest?.source === 'gitlab-pr' ? 'gitlab' : 'github',
    knownMerged: pullRequest?.metadata.merged === true,
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
  const initializing = !session.materializedAt;
  return {
    session,
    origin: 'user',
    board: undefined,
    kind: 'User session',
    name: getUserSessionLabel(session),
    url,
    openPath: url,
    active: pathname === url,
    initializing,
    running,
    attention: false,
    settled: false,
    status: sessionActivityStatus({ initializing, running, attention: false, settled: false }),
    ownerName: getSessionOwnerDetails(session, viewer).name,
    provider: 'github',
    knownMerged: false,
    pinned,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}
