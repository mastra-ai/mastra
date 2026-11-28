import type { PendingImage } from '../context/ComposerImagesContext';

import { useSessionHost } from '../context/SessionHostContext';
import { useChatModels } from '../context/useChatModels';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { stashHandoffFiles } from '../services/handoffFiles';
import { DraftSessionCreateError } from '../services/sessionErrors';
import { startPromptHandoff } from './useHandoffPrompt';

/**
 * Starts the draft's session and opens its thread without waiting for the
 * server: the create runs under the session's query key, which the thread
 * route reads, so the thread waits on this create instead of reading a session
 * that does not exist yet. The server takes the draft's id, so a repeated
 * create returns the same session.
 */
export function useCreateUserSessionFromDraft() {
  const { factorySessionState } = useChatSessionContext();
  const { activeModelId, selection } = useChatModels();
  const { factoryProjectId: factoryId, draftSessionId, navigate, links, data } = useSessionHost();

  return ({ prompt, files }: { prompt: string; files: PendingImage[] }) => {
    const projectRepositoryId = factorySessionState?.projectRepositoryId;
    if (!draftSessionId || !factoryId || !projectRepositoryId) {
      throw new Error('Could not create the session. Reload the page and try again.');
    }
    if (!activeModelId) {
      throw new Error('Session configuration is not ready. Try again.');
    }

    const draftPath = `/factories/${factoryId}/user/new/${draftSessionId}`;
    void data
      .createUserSession(
        {
          projectId: factoryId,
          projectRepositoryId,
          sessionId: draftSessionId,
          title: prompt,
          // A session someone opens for themselves stays theirs until they share it.
          visibility: 'private',
        },
        error => {
          const message = error instanceof Error ? error.message : 'Session creation failed';
          return new DraftSessionCreateError(
            `Could not create the session: ${message}. Try again.`,
            { prompt, modelSelection: selection },
            draftPath,
            { cause: error },
          );
        },
      )
      .catch(() => undefined);
    stashHandoffFiles(draftSessionId, files);
    navigate(links.userThread(draftSessionId), {
      replace: true,
      state: startPromptHandoff(draftSessionId, prompt, { modelSelection: selection }),
    });
  };
}
