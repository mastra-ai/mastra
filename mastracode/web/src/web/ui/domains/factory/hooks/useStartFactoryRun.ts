import type { AgentControllerMessage } from '@mastra/client-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import type { AgentControllerSession } from '../../chat/services/agentControllerClient';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
// Deep imports (not the workspaces barrel) to avoid provider/component cycles.
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import { deriveProjectPath, useCreateWorkspaceMutation } from '../../workspaces/hooks/useWorkspaces';
import { createWorkItem, updateWorkItem } from '../services/workItems';
import type { WorkItemSource } from '../services/workItems';

/**
 * Board record to file once the run is underway. With an `id` the existing
 * card is PATCHed (stages + the role's session ref); without one a new card is
 * POSTed (the server upserts on `sourceKey`).
 */
export interface StartFactoryRunWorkItem {
  /** Existing work item to patch; omit to materialize a new card. */
  id?: string;
  /** Session slot the run fills on the card, e.g. `work` or `review`. */
  role: string;
  /** Stages the card should hold once the run is underway. */
  stages: string[];
  source: WorkItemSource;
  sourceKey: string | null;
  title: string;
  url?: string | null;
  metadata?: Record<string, unknown>;
}

export interface StartFactoryRunInput {
  /** Feature branch for the new worktree (e.g. `factory/issue-12`). */
  branch: string;
  /** Title for the new thread shown in the sidebar. */
  threadTitle: string;
  /** First user message sent to the agent (e.g. a skill invocation). */
  prompt: string;
  /** Board card to file for this run (kanban record; optional). */
  workItem?: StartFactoryRunWorkItem;
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
    mutationFn: async ({ branch, threadTitle, prompt, workItem }: StartFactoryRunInput) => {
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
      const created = await scopedSession.create({ tags: { projectPath } });

      // Bringing a brand-new scope online seeds it with a fresh empty untitled
      // thread (core creates one when no thread matches the scope tags). Claim
      // that seeded thread for this run by renaming it — creating another
      // thread here would leave a stray "Untitled" thread in the sidebar. When
      // the session resumed a real thread (titled or with messages), create a
      // fresh thread as before.
      const threadId =
        (await claimSeededThread(scopedSession, created.threadId, threadTitle)) ??
        (await scopedSession.createThread(threadTitle)).id;
      await scopedSession.sendMessage(prompt);

      // Seed the thread's message cache so the prompt renders immediately when
      // the thread page mounts, before the server transcript catches up.
      const message: AgentControllerMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        content: [{ type: 'text', text: prompt }],
      };
      queryClient.setQueryData(queryKeys.agentControllerThreadMessages(AGENT_CONTROLLER_ID, resourceId, threadId), [
        message,
      ]);
      // The thread now exists under the new worktree's project path; refresh
      // its thread list so the sidebar shows it once the UI lands there.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, resourceId, projectPath),
      });

      // File the board card now that the run is underway, hanging the run's
      // session ref off the requested role.
      const githubProjectId = activeProject?.githubProjectId;
      if (workItem && githubProjectId) {
        const sessions = { [workItem.role]: { projectPath, branch, threadId } };
        if (workItem.id) {
          await updateWorkItem(baseUrl, workItem.id, { stages: workItem.stages, sessions });
        } else {
          await createWorkItem(baseUrl, githubProjectId, {
            source: workItem.source,
            sourceKey: workItem.sourceKey,
            title: workItem.title,
            url: workItem.url ?? null,
            stages: workItem.stages,
            sessions,
            metadata: workItem.metadata,
          });
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.workItems(githubProjectId) });
      }
      return threadId;
    },
    onSuccess: threadId => void navigate(`/threads/${threadId}`),
  });

  return { start: mutation, enabled: sessionEnabled };
}

/**
 * Reuse the thread a session was seeded with when it is still a fresh, empty,
 * untitled thread: rename it to `title` and return its id. Returns null when
 * the session resumed a real thread (it has a title or messages) — the caller
 * creates a new thread instead.
 */
async function claimSeededThread(
  session: AgentControllerSession,
  threadId: string | undefined,
  title: string,
): Promise<string | null> {
  if (!threadId) return null;
  const [threads, messages] = await Promise.all([session.listThreads(), session.listMessages(threadId, 1)]);
  const seeded = threads.find(thread => thread.id === threadId);
  if (!seeded || seeded.title || messages.length > 0) return null;
  await session.renameThread(threadId, title);
  return threadId;
}
