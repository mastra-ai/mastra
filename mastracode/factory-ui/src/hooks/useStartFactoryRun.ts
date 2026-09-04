import { isFactoryRuleStage } from '@mastra/factory/rules/types';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { createElement, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { AGENT_CONTROLLER_ID } from '../ui/domains/chat/services/constants';
import { createUserSession } from '../ui/domains/workspaces/services/user-sessions';
import { useFactoryQuery } from './useFactories';
import { startFactoryRun } from '../ui/domains/factory/services/workItems';
import type { WorkItemSource } from '../ui/domains/factory/services/workItems';

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
  | { type: 'prompt'; prompt: string }
  | { type: 'skill'; skillName: string; arguments: string };

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
  preapprovePlans?: boolean;
  workItem?: StartFactoryRunWorkItem;
}

/**
 * Create the durable Factory session, then hand session/thread creation,
 * binding, board persistence, and kickoff delivery to the server coordinator.
 * The coordinator commits exact authority before it dispatches any message.
 *
 * The run is started in the background: the board stays put and a toast offers
 * the way into the thread once it exists.
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
    mutationFn: async ({
      branch,
      threadTitle,
      threadTags,
      invocation,
      preapprovePlans,
      workItem,
    }: StartFactoryRunInput) => {
      if (!factoryId || !workItem) throw new Error('Factory run requires a board work item');
      if (!repository) throw new Error('Select a repository before starting a Factory run');
      const phaseKey = runPhaseKey({ id: workItem.id, sourceKey: workItem.sourceKey, role: workItem.role });
      const setPhase = (phase: FactoryRunPhase) => setPhases(current => ({ ...current, [phaseKey]: phase }));

      setPhase('workspace');
      const userSession = await createUserSession(baseUrl, repository.projectRepositoryId, { branch });
      const sessionId = userSession.sessionId;
      const desiredStage = workItem.stages.length === 1 ? workItem.stages[0] : undefined;
      if (!isFactoryRuleStage(desiredStage)) throw new Error('Factory runs require one exclusive destination stage');

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
        preapprovePlans,
        destinationStage: desiredStage,
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
        // The run just minted a session. Without this the sidebar keeps serving
        // its cached list and the session only appears once some later
        // navigation happens to refetch it.
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions(repository.projectRepositoryId) }),
      ]);
      return { factoryId, sessionId, threadId: prepared.threadId, threadTitle };
    },
    // Starting a run costs a sandbox provision, a clone, and any repo setup
    // script — long enough that navigating on completion would rip the board
    // away from someone who has since moved on or started other cards. Land
    // the run quietly and let the toast be the way in, so several reviews can
    // be kicked off back to back from the same board.
    onSuccess: ({ factoryId: id, sessionId, threadId, threadTitle: title }) => {
      const sessionPath = `/factories/${id}/workspaces/${sessionId}/threads/${threadId}`;
      toast(`${title} is ready`, {
        action: {
          label: 'Open',
          onClick: () => void navigate(sessionPath),
        },
        cancel: {
          label: createElement(
            'span',
            { className: 'inline-flex items-center gap-1' },
            'New Tab',
            createElement(ExternalLink, { size: 12, 'aria-hidden': true }),
          ),
          onClick: () => window.open(sessionPath, '_blank', 'noopener,noreferrer'),
        },
        cancelButtonStyle: {
          border: '1px solid var(--color-border1)',
          background: 'var(--color-surface3)',
          color: 'var(--color-neutral5)',
        },
      });
    },
    onError: error => toast.error(error instanceof Error ? error.message : 'Failed to start the run'),
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
