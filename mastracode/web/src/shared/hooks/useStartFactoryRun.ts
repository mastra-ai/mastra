import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { AGENT_CONTROLLER_ID } from '../../web/ui/domains/chat/services/constants';
import { createUserSession } from '../../web/ui/domains/workspaces/services/github';
import { useFactoryQuery } from './useFactories';
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

/** Kickoff step the run is currently in, so cards can narrate the wait. */
export type FactoryRunPhase = 'workspace' | 'kickoff' | 'opening';

export interface PendingFactoryRun {
  id?: string;
  sourceKey: string | null;
  role: string;
  /** Missing when the run was started by another hook instance. */
  phase?: FactoryRunPhase;
}

/** Stable key identifying one card's run across the kickoff phases. */
function runPhaseKey(run: { id?: string; sourceKey: string | null; role: string }): string {
  return `${run.sourceKey ?? run.id ?? ''}:${run.role}`;
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
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const { baseUrl } = useApiConfig();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const repository = factoryQuery.data?.repositories[0];
  const [phases, setPhases] = useState<Record<string, FactoryRunPhase>>({});

  const mutation = useMutation({
    mutationKey: factoryRunMutationKey(repository?.projectRepositoryId ?? '', factoryId),
    mutationFn: async ({ branch, threadTitle, threadTags, invocation, workItem }: StartFactoryRunInput) => {
      if (!factoryId || !workItem) throw new Error('Factory run requires a board work item');
      if (!repository) throw new Error('Select a repository before starting a Factory run');
      const phaseKey = runPhaseKey({ id: workItem.id, sourceKey: workItem.sourceKey, role: workItem.role });
      const setPhase = (phase: FactoryRunPhase) => setPhases(current => ({ ...current, [phaseKey]: phase }));

      setPhase('workspace');
      const userSession = await createUserSession(baseUrl, repository.projectRepositoryId, branch);
      const sessionId = userSession.sessionId;
      const desiredStage = workItem.stages.length === 1 ? workItem.stages[0] : undefined;
      if (!desiredStage) throw new Error('Factory runs require one exclusive destination stage');

      setPhase('kickoff');
      const prepared = await startFactoryRun(baseUrl, factoryId, {
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

      setPhase('opening');
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, sessionId, undefined),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryId) }),
      ]);
      void navigate(`/factories/${factoryId}/workspaces/${sessionId}/threads/${prepared.threadId}`);
    },
    onSettled: (_result, _error, { workItem }) => {
      if (!workItem) return;
      const phaseKey = runPhaseKey({ id: workItem.id, sourceKey: workItem.sourceKey, role: workItem.role });
      setPhases(current => {
        if (!(phaseKey in current)) return current;
        const { [phaseKey]: _cleared, ...rest } = current;
        return rest;
      });
    },
  });

  const pendingRuns = useMutationState({
    filters: {
      mutationKey: factoryRunMutationKey(repository?.projectRepositoryId ?? '', factoryId),
      status: 'pending',
    },
    select: pending => toPendingFactoryRun(pending.state.variables),
  })
    .filter(run => run !== undefined)
    .map(run => ({ ...run, phase: phases[runPhaseKey(run)] }));

  return { start: mutation, pendingRuns, enabled: Boolean(factoryId && repository) };
}
