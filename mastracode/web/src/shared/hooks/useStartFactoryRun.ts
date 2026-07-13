import type { AgentControllerMessage } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { useSendAgentControllerMessageMutation } from './useAgentControllerRunMutations';
import { useSetAgentControllerStateMutation } from './useAgentControllerStateMutations';
import { useCreateAgentControllerThreadMutation } from './useAgentControllerThreadMutations';
import { AGENT_CONTROLLER_ID } from '../../web/ui/domains/chat/services/constants';
// Deep imports (not the workspaces barrel) to avoid provider/component cycles.
import { useActiveProjectContext } from '../../web/ui/domains/workspaces/context/ActiveProjectProvider';
import { deriveProjectPath, useCreateWorkspaceMutation } from './useWorkspaces';

export interface StartFactoryRunInput {
  /** Feature branch for the new worktree (e.g. `factory/issue-12`). */
  branch: string;
  /** Title for the new thread shown in the sidebar. */
  threadTitle: string;
  /** First user message sent to the agent (e.g. a skill invocation). */
  prompt: string;
}

/**
 * Start an agent run for a Factory item: create (or reuse) a worktree for the
 * item's branch, create a fresh thread in that workspace, send the kickoff
 * prompt, and navigate to the new thread.
 *
 * Mirrors the Composer's `/new` flow (create thread → send → seed message
 * cache → navigate) on top of the WorkspacesSection worktree flow (create
 * worktree → select it → point the session's `projectPath` at it).
 */
export function useStartFactoryRun() {
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const { baseUrl } = useApiConfig();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath: deriveProjectPath(activeProject),
    baseUrl,
    enabled: sessionEnabled,
  };
  const setStateMutation = useSetAgentControllerStateMutation(hookArgs);
  const workspaceSession = { setState: (updates: Record<string, unknown>) => setStateMutation.mutateAsync(updates) };
  const createWorkspace = useCreateWorkspaceMutation(activeProject, workspaceSession, {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
  });
  const createThread = useCreateAgentControllerThreadMutation(hookArgs);
  const send = useSendAgentControllerMessageMutation(hookArgs);

  const mutation = useMutation({
    mutationFn: async ({ branch, threadTitle, prompt }: StartFactoryRunInput) => {
      const updatedProject = await createWorkspace.mutateAsync(branch);
      const thread = await createThread.mutateAsync(threadTitle);
      await send.mutateAsync(prompt);

      // Seed the thread's message cache so the prompt renders immediately when
      // the thread page mounts, before the server transcript catches up.
      const message: AgentControllerMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      };
      queryClient.setQueryData(queryKeys.agentControllerThreadMessages(AGENT_CONTROLLER_ID, resourceId, thread.id), [
        message,
      ]);
      // The thread now exists under the new worktree's project path; refresh
      // that thread list (createThread invalidated the pre-switch path).
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, resourceId, deriveProjectPath(updatedProject)),
      });
      return thread.id;
    },
    onSuccess: threadId => void navigate(`/threads/${threadId}`),
  });

  return { start: mutation, enabled: sessionEnabled };
}
