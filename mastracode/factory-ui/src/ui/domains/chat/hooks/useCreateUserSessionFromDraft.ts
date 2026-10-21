import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import { addCachedSession } from '../../../../hooks/useWorkspaces';
import { createUserSession } from '../../workspaces/services/user-sessions';
import { useChatModels } from '../context/useChatModels';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatThinking } from '../context/useChatThinking';
import type { PendingImage } from '../context/ComposerImagesContext';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { stashHandoffFiles } from '../services/handoffFiles';
import { promptHandoffState } from './useHandoffPrompt';

export function useCreateUserSessionFromDraft() {
  const { baseUrl, factorySessionState } = useChatSessionContext();
  const { activeModelId, defaultModelId } = useChatModels();
  const { override: thinkingLevelOverride } = useChatThinking();
  const { factoryId, draftSessionId } = useParams<{ factoryId: string; draftSessionId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async ({ prompt, files }: { prompt: string; files: PendingImage[] }) => {
      const projectRepositoryId = factorySessionState?.projectRepositoryId;
      if (!draftSessionId || !factoryId || !projectRepositoryId) {
        throw new Error('Could not create the session. Reload the page and try again.');
      }
      if (!activeModelId) {
        throw new Error('Session configuration is not ready. Try again.');
      }

      const draftKeepsServerDefaults = activeModelId === defaultModelId && !thinkingLevelOverride;
      const handoffModelId = draftKeepsServerDefaults ? undefined : activeModelId;

      try {
        const session = await createUserSession(baseUrl, projectRepositoryId, {
          sessionId: draftSessionId,
          title: prompt,
          // A session someone opens for themselves stays theirs until they share it.
          visibility: 'private',
        });
        return { session, prompt, files, factoryId, handoffModelId, thinkingLevelOverride };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Session creation failed';
        throw new Error(`Could not create the session: ${message}. Try again.`, { cause: error });
      }
    },
    onSuccess: ({ session, prompt, files, factoryId, handoffModelId, thinkingLevelOverride }) => {
      queryClient.setQueryData(queryKeys.userSession(session.sessionId), session);
      addCachedSession(queryClient, factoryId, session);
      queryClient.setQueryData<MastraDBMessage[]>(
        queryKeys.agentControllerThreadMessages(
          AGENT_CONTROLLER_ID,
          session.sessionId,
          session.sessionId,
          INITIAL_THREAD_MESSAGE_LIMIT,
        ),
        [],
      );
      stashHandoffFiles(session.sessionId, files);
      void navigate(`/factories/${factoryId}/user/threads/${session.sessionId}`, {
        replace: true,
        state: promptHandoffState(prompt, {
          modelId: handoffModelId,
          thinkingLevel: thinkingLevelOverride,
        }),
      });
    },
  });
}
