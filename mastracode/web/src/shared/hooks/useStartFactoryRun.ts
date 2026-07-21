import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { AgentControllerSession } from '../../web/ui/domains/chat/services/agentControllerClient';
import {
  createAgentControllerClient,
  prepareWorkspaceSkill,
  requireAgentControllerSession,
} from '../../web/ui/domains/chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../web/ui/domains/chat/services/constants';
import {
  queueThreadPageKickoff,
  ThreadPageKickoffTimeoutError,
} from '../../web/ui/domains/chat/services/threadPageReadiness';
// Deep imports (not the workspaces barrel) to avoid provider/component cycles.
import { useActiveFactoryContext } from '../../web/ui/domains/workspaces/context/ActiveFactoryProvider';
import { deriveProjectPath, useCreateWorkspaceMutation } from './useWorkspaces';
import type { Factory } from '../../web/ui/domains/workspaces/services/factories';
import { isServerFactory } from '../../web/ui/domains/workspaces/services/factories';
import { createWorkItem, updateWorkItem } from '../../web/ui/domains/factory/services/workItems';
import type { WorkItemSource } from '../../web/ui/domains/factory/services/workItems';

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
  parentWorkItemId?: string;
  title: string;
  url?: string | null;
  metadata?: Record<string, unknown>;
}

export type FactoryRunInvocation =
  { type: 'prompt'; prompt: string } | { type: 'skill'; skillName: string; arguments: string };

const factoryRunMutationKey = (resourceId: string, projectId: string | undefined) =>
  ['factory', 'start-run', resourceId, projectId] as const;

export interface PendingFactoryRun {
  id?: string;
  sourceKey: string | null;
  role: string;
}

function toPendingFactoryRun(value: unknown): PendingFactoryRun | undefined {
  if (!isRecord(value) || !isRecord(value.workItem)) return undefined;
  const { id, sourceKey, role } = value.workItem;
  if (id !== undefined && typeof id !== 'string') return undefined;
  if (sourceKey !== null && typeof sourceKey !== 'string') return undefined;
  if (typeof role !== 'string') return undefined;
  return { id, sourceKey, role };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface StartFactoryRunInput {
  /** Feature branch for the new worktree (e.g. `factory/issue-12`). */
  branch: string;
  /** Title for the new thread shown in the sidebar. */
  threadTitle: string;
  /** Existing thread tags to prefer before falling back to the session thread. */
  threadTags?: Record<string, string>;
  /** First user action dispatched to the agent. Omit to open the session without starting a run. */
  invocation?: FactoryRunInvocation;
  /** Board card to file for this run (kanban record; optional). */
  workItem?: StartFactoryRunWorkItem;
}

/**
 * Start an agent run for a Factory item: create (or reuse) a worktree for the
 * item's branch, create a fresh thread in that workspace, send the kickoff
 * prompt, and navigate to the new thread. Without an `invocation` it opens an
 * empty session instead: same worktree/thread/card filing, but no message is
 * sent — the user lands on the thread and types the first message.
 *
 * Sessions are scoped per worktree, so the run targets the NEW worktree's own
 * session (created here with its `projectPath` tag) instead of repointing the
 * currently active one — parallel Factory runs over the same project stay
 * independent and never abort each other.
 */
export function useStartFactoryRun() {
  const { activeFactory, resourceId, sessionEnabled } = useActiveFactoryContext();
  const { baseUrl } = useApiConfig();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createWorkspace = useCreateWorkspaceMutation(activeFactory, {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
  });

  const mutation = useMutation({
    mutationKey: factoryRunMutationKey(resourceId, activeFactory?.id),
    mutationFn: async ({ branch, threadTitle, threadTags, invocation, workItem }: StartFactoryRunInput) => {
      const updatedFactory = await createWorkspace.mutateAsync(branch);
      queryClient.setQueryData(queryKeys.factories(), (factories: Factory[] | undefined) =>
        factories?.map(factory => (factory.id === updatedFactory.id ? updatedFactory : factory)),
      );
      const projectPath = deriveProjectPath(updatedFactory);
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
      let kickoffMessage: string | undefined;
      if (invocation?.type === 'skill') {
        const skillArguments = `${invocation.arguments.trim()}\n\nPrepared workspace context:\n- Worktree: ${projectPath}\n- Branch: ${branch}`;
        const prepared = await prepareWorkspaceSkill({
          agentControllerId: AGENT_CONTROLLER_ID,
          resourceId,
          scope: projectPath,
          name: invocation.skillName,
          arguments: skillArguments,
          baseUrl,
        });
        kickoffMessage = prepared.message;
      } else if (invocation) {
        kickoffMessage = invocation.prompt;
      }

      // Refresh the new workspace's thread list before mounting the route so
      // route synchronization can bind the live session to the new thread.
      await queryClient.invalidateQueries({
        queryKey: queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, resourceId, projectPath),
      });

      // Queue the kickoff before navigating so the destination page can claim it
      // exactly once. Wait for that page's composer path to finish dispatching
      // before filing the board card as an active run. Without an invocation
      // (opening an empty session) there is nothing to dispatch — navigate and
      // let the user type the first message.
      if (kickoffMessage !== undefined) {
        const kickoffCompleted = queueThreadPageKickoff({ resourceId, projectPath, threadId }, kickoffMessage);
        void navigate(`/threads/${threadId}`);
        try {
          await kickoffCompleted;
        } catch (error) {
          if (error instanceof ThreadPageKickoffTimeoutError) {
            void navigate('/new', { replace: true, state: { routeErrorNotice: error.message } });
          }
          throw error;
        }
      } else {
        void navigate(`/threads/${threadId}`);
      }

      // File the board card now that the run is underway, hanging the run's
      // session ref off the requested role. Best-effort: the run itself
      // (worktree + session + thread + prompt) already succeeded, so a filing
      // failure must not reject the mutation and strand the user off the
      // thread that is actively running.
      const factoryProjectId =
        activeFactory && isServerFactory(activeFactory) ? activeFactory.binding.factoryProjectId : undefined;
      if (workItem && factoryProjectId) {
        try {
          // One thread per item: stamp the run's ref onto every role the card
          // tracks so all refs share this threadId.
          const ref = { projectPath, branch, threadId };
          const roles = new Set([...(workItem.existingRoles ?? []), workItem.role]);
          const sessions = Object.fromEntries([...roles].map(role => [role, ref]));
          if (workItem.id) {
            await updateWorkItem(baseUrl, workItem.id, { stages: workItem.stages, sessions });
          } else {
            await createWorkItem(baseUrl, factoryProjectId, {
              source: workItem.source,
              sourceKey: workItem.sourceKey,
              parentWorkItemId: workItem.parentWorkItemId,
              title: workItem.title,
              url: workItem.url ?? null,
              stages: workItem.stages,
              sessions,
              metadata: workItem.metadata,
            });
          }
          void queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) });
        } catch (err) {
          console.error('Failed to file the board card for this run', err);
        }
      }
    },
  });

  const pendingRuns = useMutationState({
    filters: { mutationKey: factoryRunMutationKey(resourceId, activeFactory?.id), status: 'pending' },
    select: pending => toPendingFactoryRun(pending.state.variables),
  }).filter(run => run !== undefined);

  return { start: mutation, pendingRuns, enabled: sessionEnabled };
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
  const [threads, messages] = await Promise.all([session.listThreads(), session.listMessages(threadId, 1)]);
  const existing = threads.find(thread => thread.id === threadId);
  if (!existing) return (await session.createThread(title)).id;
  if (isUntitledThread(existing.title) && messages.length === 0) await session.renameThread(threadId, title);
  return threadId;
}

function isUntitledThread(title: string | null | undefined): boolean {
  return !title || title === 'Untitled thread';
}
