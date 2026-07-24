import { toast } from '@mastra/playground-ui/components/Toaster';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  createUserSession,
  deleteUserSession,
  getUserSession,
  listUserSessions,
} from '../../web/ui/domains/workspaces/services/github';
import type { FactoryUserSession } from '../../web/ui/domains/workspaces/services/github';
import { USER_SESSION_BRANCH_PREFIX } from '../../web/ui/domains/workspaces/services/github';

/**
 * The slice of the agent-controller session the delete mutation needs to
 * cascade a worktree deletion onto the threads that ran inside it.
 */
export interface WorkspaceThreadSession {
  listThreads: (opts: { limit?: number; tags?: Record<string, string> }) => Promise<Array<{ id: string }>>;
  deleteThread: (threadId: string) => Promise<unknown>;
}

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
    queryFn: async (): Promise<WorkspacesData> => splitSessions(await listUserSessions(baseUrl, projectRepositoryId!)),
    enabled: Boolean(projectRepositoryId),
  });
}

export function useUserSessionQuery(sessionId: string | undefined) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.userSession(sessionId),
    queryFn: () => getUserSession(baseUrl, sessionId!),
    enabled: Boolean(sessionId),
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
 * Delete a workspace: removes the sandbox checkout + branch server-side and
 * deletes every thread that ran inside it. Destructive; callers confirm first.
 */
export function useDeleteWorkspaceMutation(
  factoryId: string | undefined,
  projectRepositoryId: string | undefined,
  threadSession: WorkspaceThreadSession | null | undefined,
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

      if (threadSession) {
        for (let round = 0; round < 20; round++) {
          const threads = await threadSession.listThreads({
            limit: 50,
            tags: { projectPath: workspace.sessionId },
          });
          if (threads.length === 0) break;
          for (const thread of threads) await threadSession.deleteThread(thread.id);
        }
      }

      return workspace;
    },
    onSuccess: workspace => {
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
