import { toast } from '@mastra/playground-ui/components/Toaster';
import { queryOptions, skipToken, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  createUserSession,
  deleteUserSession,
  getUserSession,
  listUserSessions,
  USER_SESSION_BRANCH_PREFIX,
} from '../ui/domains/workspaces/services/github';
import type { FactoryUserSession } from '../ui/domains/workspaces/services/github';

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

async function loadWorkspaces(baseUrl: string, projectRepositoryId: string, signal?: AbortSignal) {
  return splitSessions(await listUserSessions(baseUrl, projectRepositoryId, signal));
}

export function workspacesQueryOptions(baseUrl: string, projectRepositoryId: string) {
  return queryOptions({
    queryKey: queryKeys.sessions(projectRepositoryId),
    queryFn: ({ signal }): Promise<WorkspacesData> => loadWorkspaces(baseUrl, projectRepositoryId, signal),
  });
}

/**
 * Drop a deleted session from the cached list right away. Invalidation alone
 * leaves every consumer rendering the session until the refetch lands — a
 * window in which the board still offers to open a thread that died with its
 * workspace. The refetch still runs behind this to reconcile.
 *
 * In-flight list fetches are cancelled first: one issued before the delete
 * committed still carries the deleted session, and letting it settle would
 * write it straight back over this removal.
 */
export function removeCachedSession(
  queryClient: ReturnType<typeof useQueryClient>,
  projectRepositoryId: string | undefined,
  sessionId: string,
) {
  void queryClient.cancelQueries({ queryKey: queryKeys.sessions(projectRepositoryId) });
  queryClient.setQueryData<WorkspacesData>(queryKeys.sessions(projectRepositoryId), current => {
    if (!current) return current;
    return {
      workspaces: current.workspaces.filter(session => session.sessionId !== sessionId),
      userSessions: current.userSessions.filter(session => session.sessionId !== sessionId),
    };
  });
}

function invalidateSessionQueries(
  queryClient: ReturnType<typeof useQueryClient>,
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

export function useWorkspacesQuery(projectRepositoryId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.sessions(projectRepositoryId),
    queryFn: projectRepositoryId
      ? ({ signal }): Promise<WorkspacesData> => loadWorkspaces(baseUrl, projectRepositoryId, signal)
      : skipToken,
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
      return createUserSession(baseUrl, projectRepositoryId, trimmedBranch);
    },
    onSuccess: session => {
      invalidateSessionQueries(queryClient, projectRepositoryId, scope, session.sessionId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSession(session.sessionId) });
      void navigate(`/factories/${factoryId}/workspaces/${session.sessionId}`);
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to create workspace'),
  });
}

/**
 * Delete a workspace: removes the sandbox checkout + branch server-side.
 *
 * The threads that ran inside it are deliberately left in place. A workspace is
 * a disposable checkout, but its transcripts are the record of what was decided
 * and why, and they stay readable long after the branch is gone. Session ids are
 * freshly generated per session, so a workspace recreated on the same branch can
 * never inherit these threads.
 */
export function useDeleteWorkspaceMutation(
  factoryId: string | undefined,
  projectRepositoryId: string | undefined,
  scope?: AgentControllerThreadsScope,
) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (workspace: FactoryUserSession) => {
      if (!factoryId) throw new Error('No Factory selected');
      if (!projectRepositoryId) throw new Error('Connect a repository before deleting a workspace');
      await deleteUserSession(baseUrl, workspace.sessionId);
      return workspace;
    },
    onSuccess: workspace => {
      removeCachedSession(queryClient, projectRepositoryId, workspace.sessionId);
      invalidateSessionQueries(queryClient, projectRepositoryId, scope, workspace.sessionId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.userSession(workspace.sessionId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(scope?.agentControllerId, scope?.resourceId, workspace.sessionId),
      });
      void navigate(`/factories/${factoryId}`);
      toast('Workspace deleted');
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to delete workspace'),
  });
}
