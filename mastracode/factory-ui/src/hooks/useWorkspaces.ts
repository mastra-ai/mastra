import { isPersonSessionBranch } from '@mastra/factory/work-item-branch';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { queryOptions, skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient, UseQueryResult } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { SessionRowsResponse, SessionRowWire } from '../api/types';
import { AGENT_CONTROLLER_ID } from '../ui/domains/chat/services/constants';
import { stripCachedSessionRefs } from './useWorkItems';
import {
  createUserSession,
  deleteUserSession,
  getUserSession,
  isSessionNotFound,
  listUserSessions,
} from '../ui/domains/workspaces/services/user-sessions';
import type { FactoryUserSession } from '../ui/domains/workspaces/services/user-sessions';

export interface WorkspacesData {
  workspaces: FactoryUserSession[];
  userSessions: FactoryUserSession[];
}

function splitSessions(sessions: FactoryUserSession[]): WorkspacesData {
  return {
    workspaces: sessions.filter(session => !isPersonSessionBranch(session.branch)),
    userSessions: sessions.filter(session => isPersonSessionBranch(session.branch)),
  };
}

async function loadWorkspaces(baseUrl: string, factoryId: string, signal?: AbortSignal) {
  return splitSessions(await listUserSessions(baseUrl, factoryId, signal));
}

function workspacesQueryOptions(baseUrl: string, factoryId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.sessions(factoryId),
    queryFn: factoryId
      ? ({ signal }): Promise<WorkspacesData> => loadWorkspaces(baseUrl, factoryId, signal)
      : skipToken,
    refetchInterval: query => sessionsRefetchInterval(query.state.data),
  });
}

type SessionRowFields = Omit<SessionRowWire, 'childRows'>;

function withoutSessionRow(response: SessionRowsResponse, sessionId: string): SessionRowsResponse {
  let dropped = 0;
  const groups = response.groups.flatMap(group => {
    const rows = group.rows.flatMap(row => {
      const cardSessionIds = row.cardSessionIds?.filter(id => id !== sessionId);
      if (cardSessionIds ? cardSessionIds.length === 0 : row.session.sessionId === sessionId) return [];
      const childRows = row.childRows?.filter(child => child.session.sessionId !== sessionId);
      return [{ ...row, ...(cardSessionIds && { cardSessionIds }), ...(childRows && { childRows }) }];
    });
    const droppedHere = group.rows.length - rows.length;
    dropped += droppedHere;
    const total = group.total - droppedHere;
    return total > 0 ? [{ ...group, total, rows }] : [];
  });
  return { ...response, total: response.total - dropped, matching: response.matching - dropped, groups };
}

function withSessionTitle(response: SessionRowsResponse, sessionId: string, title: string): SessionRowsResponse {
  const retitle = <Row extends SessionRowFields>(row: Row): Row =>
    row.session.sessionId === sessionId ? { ...row, session: { ...row.session, title } } : row;
  return {
    ...response,
    groups: response.groups.map(group => ({
      ...group,
      rows: group.rows.map(row => ({
        ...retitle(row),
        ...(row.childRows && { childRows: row.childRows.map(retitle) }),
      })),
    })),
  };
}

export function removeCachedSession(queryClient: QueryClient, factoryId: string | undefined, sessionId: string) {
  // an in-flight read still carries the stale entry and would clobber the edits below
  void queryClient.cancelQueries({ queryKey: queryKeys.sessions(factoryId) });
  void queryClient.cancelQueries({ queryKey: queryKeys.sessionRowsRoot(factoryId) });
  queryClient.setQueryData<WorkspacesData>(queryKeys.sessions(factoryId), current => {
    if (!current) return current;
    return {
      workspaces: current.workspaces.filter(session => session.sessionId !== sessionId),
      userSessions: current.userSessions.filter(session => session.sessionId !== sessionId),
    };
  });
  queryClient.setQueriesData<SessionRowsResponse>(
    { queryKey: queryKeys.sessionRowsRoot(factoryId) },
    current => current && withoutSessionRow(current, sessionId),
  );
}

export function addCachedSession(queryClient: QueryClient, factoryId: string, session: FactoryUserSession) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.sessionRowsRoot(factoryId) });
  const queryKey = queryKeys.sessions(factoryId);
  if (!queryClient.getQueryData<WorkspacesData>(queryKey)) {
    void queryClient.invalidateQueries({ queryKey });
    return;
  }
  void queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData<WorkspacesData>(queryKey, current => {
    if (!current) return current;
    const all = [...current.workspaces, ...current.userSessions];
    return all.some(cached => cached.sessionId === session.sessionId) ? current : splitSessions([...all, session]);
  });
}

export async function updateCachedSessionTitle(
  queryClient: QueryClient,
  factoryId: string | undefined,
  sessionId: string,
  title: string,
) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  const listKey = queryKeys.sessions(factoryId);
  const rowsKey = queryKeys.sessionRowsRoot(factoryId);
  const sessionKey = queryKeys.userSession(sessionId);
  // An in-flight read can still carry the branch-only title and overwrite this one. A first read is left
  // alone: cancelling it would leave its query empty with nothing asking again.
  await Promise.all(
    [listKey, rowsKey, sessionKey].map(queryKey =>
      queryClient.cancelQueries({ queryKey, predicate: query => query.state.data !== undefined }),
    ),
  );
  queryClient.setQueryData<WorkspacesData>(listKey, current => {
    if (!current) return current;

    let changed = false;
    const updateTitle = (session: FactoryUserSession) => {
      if (session.sessionId !== sessionId || session.title === trimmedTitle) return session;
      changed = true;
      return { ...session, title: trimmedTitle };
    };
    const workspaces = current.workspaces.map(updateTitle);
    const userSessions = current.userSessions.map(updateTitle);

    return changed ? { ...current, workspaces, userSessions } : current;
  });
  queryClient.setQueriesData<SessionRowsResponse>(
    { queryKey: rowsKey },
    current => current && withSessionTitle(current, sessionId, trimmedTitle),
  );
  queryClient.setQueryData<FactoryUserSession>(sessionKey, current => current && { ...current, title: trimmedTitle });
}

/** Everything that lists a project's sessions: the search palette's list, the sidebar's rows and their activity. */
export async function invalidateSessionQueries(queryClient: QueryClient, factoryId: string | undefined) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.sessions(factoryId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.sessionRowsRoot(factoryId) }),
    queryClient.invalidateQueries({ queryKey: queryKeys.sessionActivity(factoryId) }),
  ]);
}

function invalidateWorkspaceQueries(queryClient: QueryClient, factoryId: string | undefined, sessionId: string) {
  void invalidateSessionQueries(queryClient, factoryId);
  void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, sessionId) });
}

export const UNMATERIALIZED_POLL_MS = 15_000;
/**
 * A session created but never run stays un-materialized forever — without a
 * bound it would keep the list polling indefinitely. Materialization follows
 * within minutes of the activity that starts it, and every such trigger (run
 * start, run end, attention) invalidates the sessions list, refreshing
 * `updatedAt` and re-opening this window.
 */
const UNMATERIALIZED_POLL_WINDOW_MS = 10 * 60_000;

/**
 * Poll gently while any listed session has not been materialized yet. The
 * sidebar status dots derive "initializing" from `materializedAt`, which the
 * server stamps out-of-band (the session's first command, or another tab) —
 * with no poll the cached `null` never resolved and dots wedged on
 * "initializing".
 */
export function sessionsRefetchInterval(data: WorkspacesData | undefined, now = Date.now()): number | false {
  if (!data) return false;
  const unresolved = [...data.workspaces, ...data.userSessions].some(
    session => !session.materializedAt && now - Date.parse(session.updatedAt) < UNMATERIALIZED_POLL_WINDOW_MS,
  );
  return unresolved ? UNMATERIALIZED_POLL_MS : false;
}

export function useWorkspacesQuery(factoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery(workspacesQueryOptions(baseUrl, factoryId));
}

export function userSessionQueryOptions(baseUrl: string, sessionId: string | undefined) {
  return queryOptions({
    queryKey: queryKeys.userSession(sessionId),
    queryFn: sessionId ? () => getUserSession(baseUrl, sessionId) : skipToken,
    // A lazy page mounting after the session read failed must not read it again;
    // reopening the session still does, since its key changes.
    retryOnMount: false,
  });
}

export function useUserSessionQuery(sessionId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery(userSessionQueryOptions(baseUrl, sessionId));
}

export function sessionUnavailableError(query: UseQueryResult<FactoryUserSession>): Error | undefined {
  if (!query.error) return undefined;
  return query.isLoadingError || isSessionNotFound(query.error) ? query.error : undefined;
}

export function useCreateWorkspaceMutation(factoryId: string | undefined, projectRepositoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (branch: string) => {
      const trimmedBranch = branch.trim();
      if (!factoryId) throw new Error('No Factory selected');
      if (!projectRepositoryId) throw new Error('Connect a repository before creating a workspace');
      return createUserSession(baseUrl, projectRepositoryId, { branch: trimmedBranch });
    },
    onSuccess: session => {
      invalidateWorkspaceQueries(queryClient, factoryId, session.sessionId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSession(session.sessionId) });
      void navigate(`/factories/${factoryId}/workspaces/${session.sessionId}`);
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to create workspace'),
  });
}

export function useDeleteWorkspaceMutation(factoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // user-session routes carry the session id as :threadId (user/threads/:threadId)
  const { sessionId, threadId } = useParams<{ sessionId?: string; threadId?: string }>();
  const viewedSessionId = sessionId ?? threadId;

  return useMutation({
    mutationFn: async (workspace: Pick<FactoryUserSession, 'sessionId'>) => {
      if (!factoryId) throw new Error('No Factory selected');
      await deleteUserSession(baseUrl, workspace.sessionId);
      return workspace;
    },
    onSuccess: workspace => {
      removeCachedSession(queryClient, factoryId, workspace.sessionId);
      // The server strips the work-item refs with the row; mirror it in the cache
      // so the board's cards drop their session links before the next poll.
      if (factoryId) stripCachedSessionRefs(queryClient, factoryId, workspace.sessionId);
      invalidateWorkspaceQueries(queryClient, factoryId, workspace.sessionId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSession(workspace.sessionId) });
      if (workspace.sessionId === viewedSessionId) void navigate(`/factories/${factoryId}/new`);
      toast('Workspace deleted');
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to delete workspace'),
  });
}

export function useDeleteUserSessionMutation(factoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  return useMutation({
    mutationFn: async (session: Pick<FactoryUserSession, 'sessionId'>) => {
      await deleteUserSession(baseUrl, session.sessionId);
      return session;
    },
    onSuccess: session => {
      removeCachedSession(queryClient, factoryId, session.sessionId);
      queryClient.removeQueries({ queryKey: queryKeys.userSession(session.sessionId) });
      void invalidateSessionQueries(queryClient, factoryId);
      toast('Session deleted');
      if (location.pathname === `/factories/${factoryId}/user/threads/${session.sessionId}`) {
        void navigate(`/factories/${factoryId}`, { replace: true });
      }
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to delete session'),
  });
}
