import type { AgentControllerMessage } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
// Deep imports (not the workspaces barrel) to avoid provider/component cycles.
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { deriveProjectPath, useCreateWorkspaceMutation } from '../../workspaces/hooks/useWorkspaces';

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
 * Sessions are scoped per worktree, so the run targets the NEW worktree's own
 * session (created here with its `projectPath` tag) instead of repointing the
 * currently active one — parallel Factory runs over the same project stay
 * independent and never abort each other.
 */
export function useStartFactoryRun() {
  const { activeProject, resourceId, sessionEnabled } = useActiveProjectContext();
  const { baseUrl } = useApiConfig();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createWorkspace = useCreateWorkspaceMutation(activeProject, {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
  });

  const mutation = useMutation({
    mutationFn: async ({ branch, threadTitle, prompt }: StartFactoryRunInput) => {
      const updatedProject = await createWorkspace.mutateAsync(branch);
      const projectPath = deriveProjectPath(updatedProject);
      if (!projectPath) throw new Error('Could not resolve the new worktree path');

      // Address the new worktree's own session; create it up front so a
      // brand-new scope is seeded with its projectPath tag before the thread
      // is created in it.
      const { session } = createAgentControllerClient({
        agentControllerId: AGENT_CONTROLLER_ID,
        resourceId,
        scope: projectPath,
        baseUrl,
        enabled: sessionEnabled,
      });
      const scopedSession = requireAgentControllerSession(session);
      await scopedSession.create({ tags: { projectPath } });
      const thread = await scopedSession.createThread(threadTitle);
      await scopedSession.sendMessage(prompt);

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
      // its thread list so the sidebar shows it once the UI lands there.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, resourceId, projectPath),
      });
      return thread.id;
    },
    onSuccess: threadId => void navigate(`/threads/${threadId}`),
  });

  return { start: mutation, enabled: sessionEnabled };
}
