import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { prepareWorkspaceSkill } from '../../web/ui/domains/chat/services/agentControllerClient';
import { AGENT_CONTROLLER_ID } from '../../web/ui/domains/chat/services/constants';
// Deep imports (not the workspaces barrel) to avoid provider/component cycles.
import { useActiveFactoryContext } from '../../web/ui/domains/workspaces/context/ActiveFactoryProvider';
import { deriveProjectPath, useCreateWorkspaceMutation } from './useWorkspaces';
import type { Factory } from '../../web/ui/domains/workspaces/services/factories';
import { isServerFactory } from '../../web/ui/domains/workspaces/services/factories';
import { createWorkItem, startFactoryRun, transitionWorkItem } from '../../web/ui/domains/factory/services/workItems';
import type { WorkItemSource } from '../../web/ui/domains/factory/services/workItems';

export interface StartFactoryRunWorkItem {
  id?: string;
  revision?: number;
  currentStage?: string;
  role: string;
  /** Retained for call-site compatibility; exact role authority no longer repoints other roles. */
  existingRoles?: string[];
  stages: string[];
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId?: string;
  title: string;
  url?: string | null;
  metadata?: Record<string, unknown>;
}

export type FactoryRunInvocation =
  | { type: 'prompt'; prompt: string }
  | { type: 'skill'; skillName: string; arguments: string };

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
  branch: string;
  threadTitle: string;
  threadTags?: Record<string, string>;
  invocation?: FactoryRunInvocation;
  workItem?: StartFactoryRunWorkItem;
}

/**
 * Materialize the worktree in the browser, then hand session/thread creation,
 * binding, board persistence, and kickoff delivery to the server coordinator.
 * The coordinator commits exact authority before it dispatches any message.
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
      const factoryProjectId =
        activeFactory && isServerFactory(activeFactory) ? activeFactory.binding.factoryProjectId : undefined;
      if (!factoryProjectId || !workItem) throw new Error('Factory run requires a board work item');

      let kickoffMessage: string | null = null;
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

      const desiredStage = workItem.stages.length === 1 ? workItem.stages[0] : undefined;
      if (!desiredStage) throw new Error('Factory runs require one exclusive destination stage');
      let canonical = workItem.id
        ? { id: workItem.id, revision: workItem.revision }
        : await createWorkItem(baseUrl, factoryProjectId, {
            source: workItem.source,
            sourceKey: workItem.sourceKey,
            parentWorkItemId: workItem.parentWorkItemId,
            title: workItem.title,
            url: workItem.url ?? null,
            stages: ['intake'],
            metadata: workItem.metadata,
          });
      if (canonical.revision === undefined) throw new Error('Factory work item revision is unavailable');
      const currentStage = workItem.id ? workItem.currentStage : 'intake';
      if (desiredStage !== currentStage) {
        const moved = await transitionWorkItem(baseUrl, factoryProjectId, canonical.id, {
          board: workItem.source === 'github-pr' ? 'review' : 'work',
          stage: desiredStage as 'triage' | 'planning' | 'execute' | 'review' | 'done',
          expectedRevision: canonical.revision,
          requestId: crypto.randomUUID(),
          cause: 'run_start',
        });
        if (moved.status === 'rejected') throw new Error(moved.reason);
        canonical = { id: canonical.id, revision: moved.revision };
      }

      const prepared = await startFactoryRun(baseUrl, factoryProjectId, {
        resourceId,
        projectPath,
        branch,
        threadTitle,
        threadTags,
        kickoffKey: crypto.randomUUID(),
        kickoffMessage,
        workItem: {
          id: canonical.id,
          role: workItem.role,
          input: {
            source: workItem.source,
            sourceKey: workItem.sourceKey,
            parentWorkItemId: workItem.parentWorkItemId,
            title: workItem.title,
            url: workItem.url ?? null,
            stages: workItem.stages,
            metadata: workItem.metadata,
          },
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, resourceId, projectPath),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) }),
      ]);
      void navigate(`/threads/${prepared.threadId}`);
    },
  });

  const pendingRuns = useMutationState({
    filters: { mutationKey: factoryRunMutationKey(resourceId, activeFactory?.id), status: 'pending' },
    select: pending => toPendingFactoryRun(pending.state.variables),
  }).filter(run => run !== undefined);

  return { start: mutation, pendingRuns, enabled: sessionEnabled };
}
