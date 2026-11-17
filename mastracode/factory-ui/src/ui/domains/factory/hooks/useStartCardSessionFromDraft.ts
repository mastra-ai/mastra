import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { noop, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import type { WorkItemSessionRepository } from '../../../../api/types';
import { sessionWorkItemsQueryOptions } from '../../../../hooks/useWorkItems';
import { addCachedSession, invalidateSessionQueries } from '../../../../hooks/useWorkspaces';
import type { DraftSessionStart } from '../../chat/context/DraftSessionStartContext';
import { useChatModels } from '../../chat/context/useChatModels';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useChatThinking } from '../../chat/context/useChatThinking';
import { startPromptHandoff } from '../../chat/hooks/useHandoffPrompt';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { stashHandoffFiles } from '../../chat/services/handoffFiles';
import { threadPath } from '../../workspaces/services/factoryPaths';
import type { FactoryProject } from '../../workspaces/services/github';
import { createUserSession, getUserSession } from '../../workspaces/services/user-sessions';
import { itemSessionSpec } from '../boardItems';
import { pullRequestSubscriptionsQuery } from '../services/githubSubscriptions';
import { startFactoryRun } from '../services/workItems';
import type { WorkItem } from '../services/workItems';

type ResolvedRepository = Extract<WorkItemSessionRepository, { status: 'resolved' }>;

/** Creates without a session id, so the server reuses the person's session on the card's branch, e.g. one whose start failed. */
export function useStartCardSessionFromDraft(
  factory: FactoryProject,
  item: WorkItem,
  sessionRepository: WorkItemSessionRepository | undefined,
): DraftSessionStart {
  const { baseUrl } = useChatSessionContext();
  const { activeModelId, defaultModelId } = useChatModels();
  const { override: thinkingLevelOverride } = useChatThinking();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const resolved = sessionRepository?.status === 'resolved' ? sessionRepository : undefined;

  const startSession = useMutation({
    mutationFn: async (repository: ResolvedRepository) => {
      const metadata = item.workItem ? {} : (item.metadata ?? {});
      const { branch, threadTitle } = itemSessionSpec(item);
      const { sessionId } = await createUserSession(baseUrl, repository.projectRepositoryId, { branch });
      await startFactoryRun(baseUrl, factory.id, {
        sessionId,
        threadTitle,
        kickoffKey: crypto.randomUUID(),
        workItem: {
          id: item.id,
          role: 'chat',
          input: { source: item.source, sourceKey: item.sourceKey, title: item.title, url: null, metadata },
        },
      });
      const provider =
        factory.repositories.find(linked => linked.projectRepositoryId === repository.projectRepositoryId)?.provider ??
        'github';
      // Read after the start, which binds the card, so the thread opens on its resource, cards, and pull requests.
      const [session] = await Promise.all([
        getUserSession(baseUrl, sessionId),
        queryClient.query(sessionWorkItemsQueryOptions(baseUrl, factory.id, sessionId)).catch(noop),
        queryClient.query(pullRequestSubscriptionsQuery(baseUrl, sessionId, sessionId, provider, true)).catch(noop),
      ]);
      return session;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factory.id) }),
  });

  const start: DraftSessionStart['start'] = async ({ prompt, files }) => {
    if (!resolved) {
      throw new Error('Could not create the session. Reload the page and try again.');
    }
    if (!activeModelId) {
      throw new Error('Session configuration is not ready. Try again.');
    }
    const session = await startSession.mutateAsync(resolved).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Session creation failed';
      throw new Error(`Could not create the session: ${message}. Try again.`, { cause: error });
    });
    const { sessionId } = session;
    queryClient.setQueryData(queryKeys.userSession(sessionId), session);
    addCachedSession(queryClient, factory.id, session);
    void invalidateSessionQueries(queryClient, factory.id);
    // A session that never got a message has no history, so its thread opens on an empty transcript.
    queryClient.setQueryData<MastraDBMessage[]>(
      queryKeys.agentControllerThreadMessages(AGENT_CONTROLLER_ID, sessionId, sessionId, INITIAL_THREAD_MESSAGE_LIMIT),
      [],
    );
    stashHandoffFiles(sessionId, files);
    const draftKeepsServerDefaults = activeModelId === defaultModelId && !thinkingLevelOverride;
    void navigate(threadPath(factory.id, { sessionId, threadId: sessionId }), {
      replace: true,
      state: startPromptHandoff(sessionId, prompt, {
        modelId: draftKeepsServerDefaults ? undefined : activeModelId,
        thinkingLevel: thinkingLevelOverride,
      }),
    });
  };

  return { ready: resolved !== undefined && !startSession.isPending, start };
}
