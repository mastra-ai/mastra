import { useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';

import { isRecord } from '../lib/isRecord';
import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { AGENT_CONTROLLER_ID } from '../ui/domains/chat/services/constants';
import { createUserSession } from '../ui/domains/workspaces/services/user-sessions';
import { useFactoryQuery } from './useFactories';
import { useCardRepositorySlug } from '../ui/domains/factory/hooks/useCardRepositorySlug';
import { repositoryMatchesCardSource } from '../ui/domains/factory/boardRepository';
import { startFactoryRun, updateWorkItem } from '../ui/domains/factory/services/workItems';
import type { WorkItem, WorkItemSource } from '../ui/domains/factory/services/workItems';

export interface StartFactoryRunWorkItem {
  id: string;
  role: string;
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId?: string;
  title: string;
  url?: string | null;
  metadata?: Record<string, unknown>;
  workItem?: WorkItem['workItem'];
}

export interface StartFactoryRunInput {
  branch: string;
  threadTitle: string;
  workItem: StartFactoryRunWorkItem;
}

/**
 * Open the card's own session: create the durable Factory session, then hand
 * session/thread creation, binding and board persistence to the server
 * coordinator. The card does not move — a lane transition is what starts a run.
 */
export function useStartFactoryRun() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const repositories = factoryQuery.data?.repositories ?? [];
  const repositorySlugFor = useCardRepositorySlug(repositories);
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();

  const startMutationKey = ['factory', 'start-run', factoryId] as const;
  const mutation = useMutation({
    mutationKey: startMutationKey,
    mutationFn: async ({ branch, threadTitle, workItem }: StartFactoryRunInput) => {
      if (!factoryId) throw new Error('A Factory session needs a factory in the route');
      const sourceMetadata = { ...workItem.metadata, ...workItem.workItem?.metadata };
      const targetSlug = await repositorySlugFor(workItem.source, sourceMetadata);
      const repositoriesForSource = repositories.filter(candidate =>
        repositoryMatchesCardSource(candidate, workItem.source),
      );
      // A card that names no repository opens in the first one; the sandbox holds them all and
      // the session determines from the card which one it belongs to.
      const repository = targetSlug
        ? repositoriesForSource.find(candidate => candidate.slug === targetSlug)
        : repositoriesForSource[0];
      if (!repository) {
        throw new Error(
          targetSlug
            ? `Repository ${targetSlug} is not linked to this Factory with a provider matching this card`
            : "No repository matching this card's provider is linked to this Factory.",
        );
      }
      // With one repository for the card's provider there is nothing to determine, so the card records it.
      const recordedSlug = targetSlug ?? (repositoriesForSource.length === 1 ? repository.slug : undefined);
      const baseMetadata = workItem.workItem ? {} : (workItem.metadata ?? {});
      const metadata = recordedSlug ? { ...baseMetadata, repository: recordedSlug } : baseMetadata;
      if (recordedSlug && workItem.metadata?.repository !== recordedSlug) {
        await updateWorkItem(baseUrl, workItem.id, { metadata });
      }
      const userSession = await createUserSession(baseUrl, repository.projectRepositoryId, { branch });
      const sessionId = userSession.sessionId;

      const prepared = await startFactoryRun(baseUrl, factoryId, {
        sessionId,
        threadTitle,
        kickoffKey: crypto.randomUUID(),
        workItem: {
          id: workItem.id,
          role: workItem.role,
          input: {
            source: workItem.source,
            sourceKey: workItem.sourceKey,
            parentWorkItemId: workItem.parentWorkItemId,
            title: workItem.title,
            url: workItem.url ?? null,
            metadata,
          },
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, sessionId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryId) }),
        // The session was just minted. Without this the sidebar keeps serving
        // its cached list and it only appears once some later navigation
        // happens to refetch it.
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions(factoryId) }),
      ]);
      return { factoryId, sessionId, threadId: prepared.threadId, threadTitle };
    },
  });

  const startingItemIds = useMutationState({
    filters: { mutationKey: startMutationKey, status: 'pending' },
    select: pending => startingWorkItemId(pending.state.variables),
  }).filter(itemId => itemId !== undefined);

  return {
    start: mutation,
    startingItemIds,
    enabled: Boolean(factoryId && repositories.length > 0),
    repositories,
  };
}

function startingWorkItemId(variables: unknown): string | undefined {
  if (!isRecord(variables) || !isRecord(variables.workItem)) return undefined;
  return typeof variables.workItem.id === 'string' ? variables.workItem.id : undefined;
}
