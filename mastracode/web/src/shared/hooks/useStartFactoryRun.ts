import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { AGENT_CONTROLLER_ID } from '../../web/ui/domains/chat/services/constants';
// Deep imports (not the workspaces barrel) to avoid provider/component cycles.
import { useActiveFactoryContext } from '../../web/ui/domains/workspaces/context/ActiveFactoryProvider';
import { isServerFactory, selectedRepository } from '../../web/ui/domains/workspaces/services/factories';
import { createUserSession } from '../../web/ui/domains/workspaces/services/github';
import { startFactoryRun } from '../../web/ui/domains/factory/services/workItems';
import type { WorkItemSource } from '../../web/ui/domains/factory/services/workItems';

export interface StartFactoryRunWorkItem {
  id?: string;
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
  branch: string;
  threadTitle: string;
  threadTags?: Record<string, string>;
  invocation?: FactoryRunInvocation;
  workItem?: StartFactoryRunWorkItem;
}

/**
 * Create the durable Factory session, then hand session/thread creation,
 * binding, board persistence, and kickoff delivery to the server coordinator.
 * The coordinator commits exact authority before it dispatches any message.
 */
export function useStartFactoryRun() {
  const { activeFactory, resourceId, sessionEnabled } = useActiveFactoryContext();
  const { baseUrl } = useApiConfig();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationKey: factoryRunMutationKey(resourceId, activeFactory?.id),
    mutationFn: async ({ branch, threadTitle, threadTags, invocation, workItem }: StartFactoryRunInput) => {
      const repository = activeFactory ? selectedRepository(activeFactory) : undefined;
      if (!repository) throw new Error('Select a repository before starting a Factory run');
      const factoryProjectId =
        activeFactory && isServerFactory(activeFactory) ? activeFactory.binding.factoryProjectId : undefined;
      if (!factoryProjectId || !workItem) throw new Error('Factory run requires a board work item');

      const userSession = await createUserSession(baseUrl, repository.projectRepositoryId, branch);
      const sessionId = userSession.sessionId;
      const desiredStage = workItem.stages.length === 1 ? workItem.stages[0] : undefined;
      if (!desiredStage) throw new Error('Factory runs require one exclusive destination stage');

      const prepared = await startFactoryRun(baseUrl, factoryProjectId, {
        sessionId,
        threadTitle,
        threadTags,
        kickoffKey: crypto.randomUUID(),
        invocation:
          invocation?.type === 'skill'
            ? {
                ...invocation,
                arguments: `${invocation.arguments.trim()}\n\nPrepared workspace context:\n- Session: ${sessionId}\n- Branch: ${userSession.branch}`,
              }
            : invocation,
        destinationStage: desiredStage as 'intake' | 'triage' | 'planning' | 'execute' | 'review' | 'done',
        workItem: {
          id: workItem.id,
          role: workItem.role,
          input: {
            source: workItem.source,
            sourceKey: workItem.sourceKey,
            parentWorkItemId: workItem.parentWorkItemId,
            title: workItem.title,
            url: workItem.url ?? null,
            stages: ['intake'],
            metadata: workItem.metadata,
          },
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, sessionId, undefined),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) }),
      ]);
      void navigate(`/factories/${activeFactory?.id}/threads/${prepared.threadId}`);
    },
  });

  const pendingRuns = useMutationState({
    filters: { mutationKey: factoryRunMutationKey(resourceId, activeFactory?.id), status: 'pending' },
    select: pending => toPendingFactoryRun(pending.state.variables),
  }).filter(run => run !== undefined);

  return { start: mutation, pendingRuns, enabled: sessionEnabled };
}
