import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import { addCachedSession } from '../../../../hooks/useWorkspaces';
import { createUserSession } from '../../workspaces/services/user-sessions';
import { useChatModels } from '../context/useChatModels';
import { useChatModes } from '../context/useChatModes';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { promptHandoffState } from './useHandoffPrompt';

export function useCreateUserSessionFromDraft() {
  const { baseUrl, factorySessionState } = useChatSessionContext();
  const { activeModeId } = useChatModes();
  const { activeModelId, draftModelPackId, modelPacks } = useChatModels();
  const { factoryId, draftSessionId } = useParams<{ factoryId: string; draftSessionId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: async (prompt: string) => {
      const projectRepositoryId = factorySessionState?.projectRepositoryId;
      if (!draftSessionId || !factoryId || !projectRepositoryId) {
        throw new Error('Could not create the session. Reload the page and try again.');
      }
      if (!activeModeId || !activeModelId) {
        throw new Error('Session configuration is not ready. Try again.');
      }

      // Activating the pack applies its models server-side, so only hand off a
      // model when the draft explicitly deviated from the selected pack.
      const modeKey =
        activeModeId === 'build' || activeModeId === 'plan' || activeModeId === 'fast' ? activeModeId : undefined;
      const packModelId =
        draftModelPackId && modeKey
          ? modelPacks.find(pack => pack.id === draftModelPackId)?.models[modeKey]
          : undefined;
      const handoffModelId = activeModelId === packModelId ? undefined : activeModelId;

      try {
        const session = await createUserSession(baseUrl, projectRepositoryId, {
          sessionId: draftSessionId,
          title: prompt,
        });
        return { session, prompt, factoryId, projectRepositoryId, activeModeId, handoffModelId, draftModelPackId };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Session creation failed';
        throw new Error(`Could not create the session: ${message}. Try again.`, { cause: error });
      }
    },
    onSuccess: ({
      session,
      prompt,
      factoryId,
      projectRepositoryId,
      activeModeId,
      handoffModelId,
      draftModelPackId,
    }) => {
      queryClient.setQueryData(queryKeys.userSession(session.sessionId), session);
      addCachedSession(queryClient, projectRepositoryId, session);
      queryClient.setQueryData<MastraDBMessage[]>(
        queryKeys.agentControllerThreadMessages(
          AGENT_CONTROLLER_ID,
          session.sessionId,
          session.sessionId,
          INITIAL_THREAD_MESSAGE_LIMIT,
        ),
        [],
      );
      void navigate(`/factories/${factoryId}/user/threads/${session.sessionId}`, {
        replace: true,
        state: promptHandoffState(prompt, {
          modeId: activeModeId,
          modelId: handoffModelId,
          modelPackId: draftModelPackId,
        }),
      });
    },
  });
}
