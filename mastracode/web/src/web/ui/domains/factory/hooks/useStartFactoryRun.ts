import type { MastraDBMessage } from '@mastra/client-js';
import type { QueryClient } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { useApiConfig } from '../../../../../shared/api/config';
import { queryKeys } from '../../../../../shared/api/keys';
import type { AgentControllerSession } from '../../chat/services/agentControllerClient';
import { createAgentControllerClient, requireAgentControllerSession } from '../../chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
// Deep imports (not the workspaces barrel) to avoid provider/component cycles.
import { useActiveProjectContext } from '../../workspaces/context/ActiveProjectProvider';
import {
  deriveProjectPath,
  useCreateWorkspaceMutation,
  useSelectWorkspaceMutation,
} from '../../workspaces/hooks/useWorkspaces';
import type { Project } from '../../workspaces/services/projects';
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
  /**
   * Roles already tracked on the card. A work item keeps a single threadId for
   * its whole lifecycle, so filing repoints every known role at this run's
   * thread — converging refs that diverged while session scoping was broken.
   */
  existingRoles?: string[];
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
  /** Existing thread tags to prefer before falling back to the session thread. */
  threadTags?: Record<string, string>;
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
  const selectWorkspace = useSelectWorkspaceMutation(activeProject, {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
  });

  const mutation = useMutation({
    mutationFn: async ({ branch, threadTitle, threadTags, prompt, workItem }: StartFactoryRunInput) => {
      const updatedProject = await createWorkspace.mutateAsync(branch);
      queryClient.setQueryData(queryKeys.projects(), (projects: Project[] | undefined) =>
        projects?.map(project => (project.id === updatedProject.id ? updatedProject : project)),
      );
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

      // Worktrees hold a single conversation, so the run targets the session's
      // own thread. Bringing a brand-new scope online seeds it with a fresh
      // empty untitled thread (core creates one when no thread matches the
      // scope tags) — claim it for this run by renaming it. When the session
      // resumed a real thread (titled or with messages), i.e. a repeat run on
      // the same item, reuse that thread: the prompt lands as a follow-up
      // message instead of leaving a stray second thread in the worktree.
      const threadId = await resolveRunThread(scopedSession, created.threadId, threadTitle, projectPath, threadTags);
      const messagesKey = queryKeys.agentControllerThreadMessages(
        AGENT_CONTROLLER_ID,
        resourceId,
        projectPath,
        threadId,
      );
      await queryClient.prefetchQuery({
        queryKey: messagesKey,
        queryFn: () => scopedSession.listMessages(threadId),
      });
      await scopedSession.sendMessage(prompt);

      // Append the prompt to the thread's message cache so it renders
      // immediately when the thread page mounts, before the server transcript
      // catches up. Appending (not replacing) preserves any prior conversation
      // when the run reuses an existing thread.
      const message: MastraDBMessage = {
        id: `local-${Date.now()}`,
        role: 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: prompt }] },
      };
      queryClient.setQueryData(messagesKey, (existing: MastraDBMessage[] | undefined) => [
        ...(existing ?? []),
        message,
      ]);
      // The thread now exists under the new worktree's project path. Seed the
      // scoped thread-list cache before navigation so route sync does not see
      // an empty/stale worktree scope and redirect the new route to /new.
      const threadsKey = queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, resourceId, projectPath);
      seedThreadList(queryClient, threadsKey, threadId, threadTitle, projectPath);

      // File the board card now that the run is underway, hanging the run's
      // session ref off the requested role. Best-effort: the run itself
      // (worktree + session + thread + prompt) already succeeded, so a filing
      // failure must not reject the mutation and strand the user off the
      // thread that is actively running.
      const githubProjectId = activeProject?.githubProjectId;
      if (workItem && githubProjectId) {
        try {
          // One thread per item: stamp the run's ref onto every role the card
          // tracks so all refs share this threadId.
          const ref = { projectPath, branch, threadId };
          const roles = new Set([...(workItem.existingRoles ?? []), workItem.role]);
          const sessions = Object.fromEntries([...roles].map(role => [role, ref]));
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
        } catch (err) {
          console.error('Failed to file the board card for this run', err);
        }
      }
      await selectWorkspace.mutateAsync(projectPath);
      await queryClient.invalidateQueries({ queryKey: threadsKey });
      seedThreadList(queryClient, threadsKey, threadId, threadTitle, projectPath);
      return { threadId, projectPath };
    },
    onSuccess: ({ threadId, projectPath }) =>
      void navigate(`/threads/${threadId}`, { state: { factoryRunProjectPath: projectPath } }),
  });

  return { start: mutation, enabled: sessionEnabled };
}

type AgentControllerThread = Awaited<ReturnType<AgentControllerSession['listThreads']>>[number];

function seedThreadList(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  threadId: string,
  title: string,
  projectPath: string,
) {
  const now = new Date().toISOString();
  const seededThread: AgentControllerThread = {
    id: threadId,
    title,
    resourceId: '',
    metadata: { tags: { projectPath } },
    createdAt: now,
    updatedAt: now,
  } as AgentControllerThread;

  queryClient.setQueryData(queryKey, (threads: AgentControllerThread[] | undefined) => {
    const existing = threads ?? [];
    if (existing.some(thread => thread.id === threadId)) return existing;
    return [seededThread, ...existing];
  });
}

/**
 * Resolve the thread a run should land on. Worktree sessions hold a single
 * conversation, so this is the session's own thread:
 *
 * - Fresh scope: the session was seeded with an empty untitled thread — claim
 *   it by renaming it to `title`.
 * - Resumed scope (repeat run on the same item): the thread already has a
 *   title or messages — reuse it as-is; the prompt becomes a follow-up.
 * - No thread on the session (unexpected): create one.
 */
async function resolveRunThread(
  session: AgentControllerSession,
  threadId: string | undefined,
  title: string,
  projectPath: string,
  threadTags: Record<string, string> | undefined,
): Promise<string> {
  const extraTags = Object.entries(threadTags ?? {}).filter(([, value]) => value);
  if (extraTags.length > 0) {
    const tags = { projectPath, ...Object.fromEntries(extraTags) };
    const taggedThread = (await session.listThreads({ tags, limit: 20 }))[0];
    if (taggedThread) {
      await session.switchThread(taggedThread.id);
      if (taggedThread.id === threadId && isUntitledThread(taggedThread.title)) {
        const messages = await session.listMessages(taggedThread.id, 1);
        if (messages.length === 0) await session.renameThread(taggedThread.id, title);
      }
      return taggedThread.id;
    }
  }

  if (!threadId) return (await session.createThread(title)).id;

  // `session.create({ tags })` may return a freshly seeded thread before the
  // scoped thread list has caught up. Use that returned thread directly instead
  // of creating another titled thread; otherwise Factory runs can leave two
  // conversations for the same worktree.
  try {
    const existing = (await session.listThreads()).find(thread => thread.id === threadId);
    if (existing && !isUntitledThread(existing.title)) return threadId;

    const messages = await session.listMessages(threadId, 1);
    if (messages.length === 0) await session.renameThread(threadId, title);
    return threadId;
  } catch {
    return (await session.createThread(title)).id;
  }
}

function isUntitledThread(title: string | null | undefined): boolean {
  return !title || title === 'Untitled thread';
}
