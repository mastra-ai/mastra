import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { useQueryClient } from '@tanstack/react-query';
import { useSessionHost } from '../context/SessionHostContext';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import { addCachedSession } from '../../../../hooks/useWorkspaces';
import { createUserSession } from '../../workspaces/services/user-sessions';
import { DraftSessionCreateError } from '../services/sessionErrors';
import type { FactoryUserSession } from '@internal/factory-contract';
import { useChatModels } from '../context/useChatModels';
import { useChatSessionContext } from '../context/useChatSessionContext';
import type { PendingImage } from '../context/ComposerImagesContext';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { stashHandoffFiles } from '../services/handoffFiles';
import { startPromptHandoff } from './useHandoffPrompt';

/**
 * Starts the draft's session and opens its thread without waiting for the
 * server: the create runs under the session's query key, which the thread
 * route reads, so the thread waits on this create instead of reading a session
 * that does not exist yet. The server takes the draft's id, so a repeated
 * create returns the same session.
 */
export function useCreateUserSessionFromDraft() {
  const { baseUrl, factorySessionState } = useChatSessionContext();
  const { activeModelId, selection } = useChatModels();
  const { factoryProjectId: factoryId, draftSessionId, navigate, links } = useSessionHost();
  const queryClient = useQueryClient();

  return ({ prompt, files }: { prompt: string; files: PendingImage[] }) => {
    const projectRepositoryId = factorySessionState?.projectRepositoryId;
    if (!draftSessionId || !factoryId || !projectRepositoryId) {
      throw new Error('Could not create the session. Reload the page and try again.');
    }
    if (!activeModelId) {
      throw new Error('Session configuration is not ready. Try again.');
    }

    const draftPath = `/factories/${factoryId}/user/new/${draftSessionId}`;
    void queryClient
      .query({
        queryKey: queryKeys.userSession(draftSessionId),
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
              { prompt, modelSelection: selection },
              draftPath,
              { cause: error },
            );
          }
          addCachedSession(queryClient, factoryId, session);
          return session;
        },
      })
      .catch(() => undefined);
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
    navigate(links.userThread(draftSessionId), {
      replace: true,
      state: startPromptHandoff(draftSessionId, prompt, { modelSelection: selection }),
    });
  };
}
