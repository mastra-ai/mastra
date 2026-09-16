import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { AGENT_CONTROLLER_ID } from '../ui/domains/chat/services/constants';
import { createUserSession } from '../ui/domains/workspaces/services/user-sessions';
import { useFactoryQuery } from './useFactories';
import { startFactoryRun } from '../ui/domains/factory/services/workItems';
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
}

/**
 * Open the card's own session: create the durable Factory session, then hand
 * session/thread creation, binding and board persistence to the server
 * coordinator. The card does not move — a lane transition is what starts a run.
 */
export function useStartFactoryRun() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factoryQuery = useFactoryQuery(factoryId);
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const repository = factoryQuery.data?.repositories[0];

  const mutation = useMutation({
    mutationFn: async ({ branch, threadTitle, workItem }: StartFactoryRunInput) => {
      if (!factoryId) throw new Error('A Factory session needs a factory in the route');
      if (!repository) throw new Error('Select a repository before starting a Factory run');
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
            metadata: workItem.metadata,
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

  return { start: mutation, enabled: Boolean(factoryId && repository) };
}
