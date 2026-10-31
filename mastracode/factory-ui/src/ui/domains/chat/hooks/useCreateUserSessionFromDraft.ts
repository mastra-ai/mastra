import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import { addCachedSession } from '../../../../hooks/useWorkspaces';
import { createUserSession, DraftSessionCreateError } from '../../workspaces/services/user-sessions';
import type { FactoryUserSession } from '../../workspaces/services/user-sessions';
import { useChatModels } from '../context/useChatModels';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatThinking } from '../context/useChatThinking';
import type { PendingImage } from '../context/ComposerImagesContext';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { stashHandoffFiles } from '../services/handoffFiles';
import { promptHandoffState } from './useHandoffPrompt';

/**
 * Starts the draft's session and opens its thread without waiting for the
 * server. The mutation settles once the draft's model is known (instant unless
 * a send beats the model load) and the thread is open; the create carries on
 * under the session's query key, which the thread route reads, so the thread
 * waits on this create instead of reading a session that does not exist yet.
 * The server takes the draft's id, so a repeated create returns the same session.
 */
export function useCreateUserSessionFromDraft() {
  const { baseUrl, factorySessionState } = useChatSessionContext();
  const { resolveDraftModels } = useChatModels();
  const { override: thinkingLevelOverride } = useChatThinking();
  const { factoryId, draftSessionId } = useParams<{ factoryId: string; draftSessionId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async ({ prompt, files }: { prompt: string; files: PendingImage[] }) => {
      const projectRepositoryId = factorySessionState?.projectRepositoryId;
      if (!draftSessionId || !factoryId || !projectRepositoryId || !resolveDraftModels) {
        throw new Error('Could not create the session. Reload the page and try again.');
      }
      const { activeModelId, defaultModelId } = await resolveDraftModels();
      if (!activeModelId) {
        throw new Error('Session configuration is not ready. Try again.');
      }

      const draftKeepsServerDefaults = activeModelId === defaultModelId && !thinkingLevelOverride;
      const handoffModelId = draftKeepsServerDefaults ? undefined : activeModelId;
      const sessionKey = queryKeys.userSession(draftSessionId);
      const draftPath = `/factories/${factoryId}/user/new/${draftSessionId}`;
      // A retry must read as pending on the thread route, not as the last failure.
      queryClient.removeQueries({ queryKey: sessionKey, exact: true });
      void queryClient.prefetchQuery({
        queryKey: sessionKey,
        queryFn: async (): Promise<FactoryUserSession> => {
          let session: FactoryUserSession;
          try {
            session = await createUserSession(baseUrl, projectRepositoryId, {
              sessionId: draftSessionId,
              title: prompt,
              // A session someone opens for themselves stays theirs until they share it.
              visibility: 'private',
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Session creation failed';
            throw new DraftSessionCreateError(
              `Could not create the session: ${message}. Try again.`,
              { prompt, modelId: handoffModelId, thinkingLevel: thinkingLevelOverride },
              draftPath,
              { cause: error },
            );
          }
          addCachedSession(queryClient, factoryId, session);
          return session;
        },
      });
      // A new session has no history, so the thread opens on an empty transcript
      // instead of waiting on a history read the session cannot answer yet.
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
      void navigate(`/factories/${factoryId}/user/threads/${draftSessionId}`, {
        replace: true,
        state: promptHandoffState(prompt, {
          modelId: handoffModelId,
          thinkingLevel: thinkingLevelOverride,
        }),
      });
    },
  });
}
