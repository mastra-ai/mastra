import { toast } from '@mastra/playground-ui/components/Toaster';
import { queryOptions, skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { AGENT_CONTROLLER_ID } from '../ui/domains/chat/services/constants';
import { stripCachedSessionRefs } from './useWorkItems';
import {
  createUserSession,
  deleteUserSession,
  getUserSession,
  listUserSessions,
  USER_SESSION_BRANCH_PREFIX,
  SLACK_SESSION_BRANCH_PREFIX,
} from '../ui/domains/workspaces/services/user-sessions';
import type { FactoryUserSession } from '../ui/domains/workspaces/services/user-sessions';

export interface WorkspacesData {
  workspaces: FactoryUserSession[];
  userSessions: FactoryUserSession[];
}

function isUserSession(session: FactoryUserSession): boolean {
  return (
    session.branch.startsWith(USER_SESSION_BRANCH_PREFIX) || session.branch.startsWith(SLACK_SESSION_BRANCH_PREFIX)
  );
}

function splitSessions(sessions: FactoryUserSession[]): WorkspacesData {
  return {
    workspaces: sessions.filter(session => !isUserSession(session)),
    userSessions: sessions.filter(isUserSession),
  };
}

/** Every session row of the Factory, factory workspaces and user sessions alike. */
export function allSessionRows(data: WorkspacesData | undefined): FactoryUserSession[] {
  return [...(data?.workspaces ?? []), ...(data?.userSessions ?? [])];
}

async function loadWorkspaces(baseUrl: string, factoryId: string, signal?: AbortSignal) {
  return splitSessions(await listUserSessions(baseUrl, factoryId, signal));
}

export function workspacesQueryOptions(baseUrl: string, factoryId: string) {
  return queryOptions({
    queryKey: queryKeys.sessions(factoryId),
    queryFn: ({ signal }): Promise<WorkspacesData> => loadWorkspaces(baseUrl, factoryId, signal),
  });
}

export function removeCachedSession(queryClient: QueryClient, factoryId: string | undefined, sessionId: string) {
  // an in-flight list fetch still carries the stale entry and would clobber the edit below
  void queryClient.cancelQueries({ queryKey: queryKeys.sessions(factoryId) });
  queryClient.setQueryData<WorkspacesData>(queryKeys.sessions(factoryId), current => {
    if (!current) return current;
    return {
      workspaces: current.workspaces.filter(session => session.sessionId !== sessionId),
      userSessions: current.userSessions.filter(session => session.sessionId !== sessionId),
    };
  });
}

export function addCachedSession(queryClient: QueryClient, factoryId: string, session: FactoryUserSession) {
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

  const queryKey = queryKeys.sessions(factoryId);
  if (!queryClient.getQueryData<WorkspacesData>(queryKey)) return;

  // an in-flight list fetch can still carry the branch-only row and overwrite this title
  await queryClient.cancelQueries({ queryKey });
  queryClient.setQueryData<WorkspacesData>(queryKey, current => {
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
}

function invalidateSessionQueries(queryClient: QueryClient, factoryId: string | undefined, sessionId: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(factoryId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
  void queryClient.invalidateQueries({ queryKey: queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, sessionId) });
}

const UNMATERIALIZED_POLL_MS = 15_000;
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
  return useQuery({
    queryKey: queryKeys.sessions(factoryId),
    queryFn: factoryId
      ? ({ signal }): Promise<WorkspacesData> => loadWorkspaces(baseUrl, factoryId, signal)
      : skipToken,
    refetchInterval: query => sessionsRefetchInterval(query.state.data),
  });
}

export function useUserSessionQuery(sessionId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.userSession(sessionId),
    queryFn: sessionId ? () => getUserSession(baseUrl, sessionId) : skipToken,
    // A lazy page mounting after the session read failed must not read it again;
    // reopening the session still does, since its key changes.
    retryOnMount: false,
  });
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
      invalidateSessionQueries(queryClient, factoryId, session.sessionId);
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
    mutationFn: async (workspace: FactoryUserSession) => {
      if (!factoryId) throw new Error('No Factory selected');
      await deleteUserSession(baseUrl, workspace.sessionId);
      return workspace;
    },
    onSuccess: workspace => {
      removeCachedSession(queryClient, factoryId, workspace.sessionId);
      // The server strips the work-item refs with the row; mirror it in the cache
      // so the board's cards drop their session links before the next poll.
      if (factoryId) stripCachedSessionRefs(queryClient, factoryId, workspace.sessionId);
      invalidateSessionQueries(queryClient, factoryId, workspace.sessionId);
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
    mutationFn: async (session: FactoryUserSession) => {
      await deleteUserSession(baseUrl, session.sessionId);
      return session;
    },
    onSuccess: session => {
      removeCachedSession(queryClient, factoryId, session.sessionId);
      queryClient.removeQueries({ queryKey: queryKeys.userSession(session.sessionId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(factoryId) });
      toast('Session deleted');
      if (location.pathname === `/factories/${factoryId}/user/threads/${session.sessionId}`) {
        void navigate(`/factories/${factoryId}`, { replace: true });
      }
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to delete session'),
  });
}
