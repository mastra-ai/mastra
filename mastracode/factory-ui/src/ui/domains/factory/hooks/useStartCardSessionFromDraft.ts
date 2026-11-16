import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import { addCachedSession, invalidateSessionQueries } from '../../../../hooks/useWorkspaces';
import type { DraftSessionStart } from '../../chat/context/DraftSessionStartContext';
import { useChatModels } from '../../chat/context/useChatModels';
import { useChatSessionContext } from '../../chat/context/useChatSessionContext';
import { useChatThinking } from '../../chat/context/useChatThinking';
import { startPromptHandoff } from '../../chat/hooks/useHandoffPrompt';
import { AGENT_CONTROLLER_ID } from '../../chat/services/constants';
import { stashHandoffFiles } from '../../chat/services/handoffFiles';
import { cardDraftPath, threadPath } from '../../workspaces/services/factoryPaths';
import type { LinkedRepositoryPayload } from '../../workspaces/services/github';
import { createUserSession, DraftSessionCreateError, getUserSession } from '../../workspaces/services/user-sessions';
import type { FactoryUserSession } from '../../workspaces/services/user-sessions';
import { itemSessionSpec } from '../boardItems';
import { startFactoryRun, updateWorkItem } from '../services/workItems';
import type { WorkItem } from '../services/workItems';

/** Opens the thread before the start resolves: the thread route reads it under the session's query key. */
export function useStartCardSessionFromDraft(
  item: WorkItem,
  repository: LinkedRepositoryPayload | undefined,
): DraftSessionStart['start'] {
  const { baseUrl } = useChatSessionContext();
  const { activeModelId, defaultModelId } = useChatModels();
  const { override: thinkingLevelOverride } = useChatThinking();
  const { factoryId, draftSessionId } = useParams<{ factoryId: string; draftSessionId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const startSession = async (factoryId: string, sessionId: string, repository: LinkedRepositoryPayload) => {
    const metadata = item.workItem
      ? { repository: repository.slug }
      : { ...item.metadata, repository: repository.slug };
    if (item.metadata?.repository !== repository.slug) await updateWorkItem(baseUrl, item.id, { metadata });
    const { branch, threadTitle } = itemSessionSpec(item);
    await createUserSession(baseUrl, repository.projectRepositoryId, { branch, sessionId });
    await startFactoryRun(baseUrl, factoryId, {
      sessionId,
      threadTitle,
      kickoffKey: crypto.randomUUID(),
      workItem: {
        id: item.id,
        role: 'chat',
        input: { source: item.source, sourceKey: item.sourceKey, title: item.title, url: null, metadata },
      },
    });
    // Read after the start: binding the card decides which memory resource the session works on.
    const session = await getUserSession(baseUrl, sessionId);
    addCachedSession(queryClient, factoryId, session);
    void queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryId) });
    void invalidateSessionQueries(queryClient, factoryId);
    return session;
  };

  return ({ prompt, files }) => {
    if (!draftSessionId || !factoryId || !repository) {
      throw new Error('Could not create the session. Reload the page and try again.');
    }
    if (!activeModelId) {
      throw new Error('Session configuration is not ready. Try again.');
    }

    const draftKeepsServerDefaults = activeModelId === defaultModelId && !thinkingLevelOverride;
    const handoffModelId = draftKeepsServerDefaults ? undefined : activeModelId;
    void queryClient
      .query({
        queryKey: queryKeys.userSession(draftSessionId),
        queryFn: async (): Promise<FactoryUserSession> => {
          try {
            return await startSession(factoryId, draftSessionId, repository);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Session creation failed';
            throw new DraftSessionCreateError(
              `Could not create the session: ${message}. Try again.`,
              { prompt, modelId: handoffModelId, thinkingLevel: thinkingLevelOverride },
              cardDraftPath(factoryId, item.id, draftSessionId),
              { cause: error },
            );
          }
        },
      })
      .catch(() => undefined);
    // A new session has no history to read yet, so its thread opens on an empty transcript.
    queryClient.setQueryData<MastraDBMessage[]>(
      queryKeys.agentControllerThreadMessages(
        AGENT_CONTROLLER_ID,
        draftSessionId,
        draftSessionId,
        INITIAL_THREAD_MESSAGE_LIMIT,
      ),
      [],
    );
    stashHandoffFiles(draftSessionId, files);
    void navigate(threadPath(factoryId, { sessionId: draftSessionId, threadId: draftSessionId }), {
      replace: true,
      state: startPromptHandoff(draftSessionId, prompt, {
        modelId: handoffModelId,
        thinkingLevel: thinkingLevelOverride,
      }),
    });
  };
}
