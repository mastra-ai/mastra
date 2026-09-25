import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { AGENT_CONTROLLER_ID } from '../ui/domains/chat/services/constants';
import { createUserSession } from '../ui/domains/workspaces/services/user-sessions';
import { useFactoryQuery } from './useFactories';
import { useIntakeConfigQuery } from './useIntakeConfig';
import { startFactoryRun, updateWorkItem } from '../ui/domains/factory/services/workItems';
import type { WorkItemSource } from '../ui/domains/factory/services/workItems';

export interface StartFactoryRunWorkItem {
  id: string;
  role: string;
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId?: string;
  title: string;
  url?: string | null;
  metadata?: Record<string, unknown>;
}

export interface StartFactoryRunInput {
  branch: string;
  threadTitle: string;
  workItem: StartFactoryRunWorkItem;
  repositorySlug?: string;
}

/**
 * Open the card's own session: create the durable Factory session, then hand
 * session/thread creation, binding and board persistence to the server
 * coordinator. The card does not move — a lane transition is what starts a run.
 */
export function useStartFactoryRun() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const intakeConfig = useIntakeConfigQuery();
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const repositories = factoryQuery.data?.repositories ?? [];

  const mutation = useMutation({
    mutationFn: async ({ branch, threadTitle, workItem, repositorySlug }: StartFactoryRunInput) => {
      if (!factoryId) throw new Error('A Factory session needs a factory in the route');
      const linearProjectId =
        workItem.source === 'linear-issue' && typeof workItem.metadata?.linearProjectId === 'string'
          ? workItem.metadata.linearProjectId
          : undefined;
      const config = linearProjectId && !intakeConfig.data ? (await intakeConfig.refetch()).data : intakeConfig.data;
      const mappedSlug = linearProjectId ? config?.linear.repositoryByLinearProject?.[linearProjectId] : undefined;
      const targetSlug =
        repositorySlug ??
        (typeof workItem.metadata?.repository === 'string' ? workItem.metadata.repository : undefined) ??
        mappedSlug;
      const repository = targetSlug
        ? repositories.find(candidate => candidate.slug === targetSlug)
        : repositories.length === 1
          ? repositories[0]
          : undefined;
      if (!repository) throw new Error('Choose a repository before starting this Factory run');
      const metadata = { ...workItem.metadata, repository: repository.slug };
      if (workItem.metadata?.repository !== repository.slug) {
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
            stages: ['intake'],
            metadata,
          },
        },
      });

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.agentControllerThreads(AGENT_CONTROLLER_ID, sessionId, undefined),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryId) }),
        // The session was just minted. Without this the sidebar keeps serving
        // its cached list and it only appears once some later navigation
        // happens to refetch it.
        queryClient.invalidateQueries({ queryKey: queryKeys.sessions(repository.projectRepositoryId) }),
      ]);
      return { factoryId, sessionId, threadId: prepared.threadId, threadTitle };
    },
  });

  return { start: mutation, enabled: Boolean(factoryId && repositories.length > 0), repositories };
}
