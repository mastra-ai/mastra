import { toast } from '@mastra/playground-ui/components/Toaster';
import {
  type QueryClient,
  queryOptions,
  skipToken,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { stripCachedSessionRefs } from './useWorkItems';
import {
  createUserSession,
  deleteUserSession,
  getUserSession,
  listUserSessions,
  USER_SESSION_BRANCH_PREFIX,
} from '../ui/domains/workspaces/services/user-sessions';
import type { FactoryUserSession } from '../ui/domains/workspaces/services/user-sessions';

interface AgentControllerThreadsScope {
  agentControllerId?: string;
  resourceId?: string;
}

export interface WorkspacesData {
  workspaces: FactoryUserSession[];
  userSessions: FactoryUserSession[];
}

function splitSessions(sessions: FactoryUserSession[]): WorkspacesData {
  return {
    workspaces: sessions.filter(session => !session.branch.startsWith(USER_SESSION_BRANCH_PREFIX)),
    userSessions: sessions.filter(session => session.branch.startsWith(USER_SESSION_BRANCH_PREFIX)),
  };
}

/** Every session row of the repository, factory workspaces and user sessions alike. */
export function allSessionRows(data: WorkspacesData | undefined): FactoryUserSession[] {
  return [...(data?.workspaces ?? []), ...(data?.userSessions ?? [])];
}

async function loadWorkspaces(baseUrl: string, projectRepositoryId: string, signal?: AbortSignal) {
  return splitSessions(await listUserSessions(baseUrl, projectRepositoryId, signal));
}

export function workspacesQueryOptions(baseUrl: string, projectRepositoryId: string) {
  return queryOptions({
    queryKey: queryKeys.sessions(projectRepositoryId),
    queryFn: ({ signal }): Promise<WorkspacesData> => loadWorkspaces(baseUrl, projectRepositoryId, signal),
  });
}

export function removeCachedSession(
  queryClient: QueryClient,
  projectRepositoryId: string | undefined,
  sessionId: string,
) {
  // an in-flight list fetch still carries the stale entry and would clobber the edit below
  void queryClient.cancelQueries({ queryKey: queryKeys.sessions(projectRepositoryId) });
  queryClient.setQueryData<WorkspacesData>(queryKeys.sessions(projectRepositoryId), current => {
    if (!current) return current;
    return {
      workspaces: current.workspaces.filter(session => session.sessionId !== sessionId),
      userSessions: current.userSessions.filter(session => session.sessionId !== sessionId),
    };
  });
}

export function addCachedSession(queryClient: QueryClient, projectRepositoryId: string, session: FactoryUserSession) {
  const queryKey = queryKeys.sessions(projectRepositoryId);
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
  projectRepositoryId: string | undefined,
  sessionId: string,
  title: string,
) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return;

  const queryKey = queryKeys.sessions(projectRepositoryId);
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

function invalidateSessionQueries(
  queryClient: QueryClient,
  projectRepositoryId: string | undefined,
  scope?: AgentControllerThreadsScope,
  projectPath?: string,
) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(projectRepositoryId) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
  if (projectPath) {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.agentControllerThreads(scope?.agentControllerId, scope?.resourceId, projectPath),
    });
  }
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

export function useWorkspacesQuery(projectRepositoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.sessions(projectRepositoryId),
    queryFn: projectRepositoryId
      ? ({ signal }): Promise<WorkspacesData> => loadWorkspaces(baseUrl, projectRepositoryId, signal)
      : skipToken,
    refetchInterval: query => sessionsRefetchInterval(query.state.data),
  });
}

export function useFactoryWorkspacesQueries(projectRepositoryIds: string[]) {
  const { baseUrl } = useApiConfig();
  return useQueries({
    queries: projectRepositoryIds.map(projectRepositoryId => workspacesQueryOptions(baseUrl, projectRepositoryId)),
  });
}

export function useUserSessionQuery(sessionId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.userSession(sessionId),
    queryFn: sessionId ? () => getUserSession(baseUrl, sessionId) : skipToken,
  });
}

export function useCreateWorkspaceMutation(
  factoryId: string | undefined,
  projectRepositoryId: string | undefined,
  scope?: AgentControllerThreadsScope,
) {
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
      invalidateSessionQueries(queryClient, projectRepositoryId, scope, session.sessionId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSession(session.sessionId) });
      void navigate(`/factories/${factoryId}/workspaces/${session.sessionId}`);
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to create workspace'),
  });
}

export function useDeleteWorkspaceMutation(
  factoryId: string | undefined,
  projectRepositoryId: string | undefined,
  scope?: AgentControllerThreadsScope,
) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  // user-session routes carry the session id as :threadId (user/threads/:threadId)
  const { sessionId, threadId } = useParams<{ sessionId?: string; threadId?: string }>();
  const viewedSessionId = sessionId ?? threadId;

  return useMutation({
    mutationFn: async (workspace: FactoryUserSession) => {
      if (!factoryId) throw new Error('No Factory selected');
      if (!projectRepositoryId) throw new Error('Connect a repository before deleting a workspace');
      await deleteUserSession(baseUrl, workspace.sessionId);
      return workspace;
    },
    onSuccess: workspace => {
      removeCachedSession(queryClient, projectRepositoryId, workspace.sessionId);
      // The server strips the work-item refs with the row; mirror it in the cache
      // so the board's cards drop their session links before the next poll.
      if (factoryId) stripCachedSessionRefs(queryClient, factoryId, workspace.sessionId);
      invalidateSessionQueries(queryClient, projectRepositoryId, scope, workspace.sessionId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSession(workspace.sessionId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(scope?.agentControllerId, scope?.resourceId, workspace.sessionId),
      });
      if (workspace.sessionId === viewedSessionId) void navigate(`/factories/${factoryId}/new`);
      toast('Workspace deleted');
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to delete workspace'),
  });
}
