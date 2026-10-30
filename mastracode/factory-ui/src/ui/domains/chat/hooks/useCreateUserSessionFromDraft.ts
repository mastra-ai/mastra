import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import { addCachedSession } from '../../../../hooks/useWorkspaces';
import { createUserSession } from '../../workspaces/services/user-sessions';
import type { FactoryUserSession } from '../../workspaces/services/user-sessions';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatModels } from '../context/useChatModels';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatThinking } from '../context/useChatThinking';
import { useChatTranscript } from '../context/useChatTranscript';
import type { PendingImage } from '../context/ComposerImagesContext';
import { useComposerImagesState } from '../context/useComposerImagesState';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { stashHandoffFiles, takeHandoffFiles } from '../services/handoffFiles';
import { promptHandoffState, readHandoffPrompt } from './useHandoffPrompt';

/** The server refused to create a draft's session; its thread route hands the prompt back to the draft. */
export class DraftSessionCreateError extends Error {}

/**
 * Starts the draft's session and opens its thread straight away. The thread
 * route reads the session under the same query key, so it waits on this create
 * rather than reading a session that does not exist yet. The server takes the
 * draft's id, so a repeated create returns the same session.
 */
export function useCreateUserSessionFromDraft() {
  const { baseUrl, factorySessionState } = useChatSessionContext();
  const { activeModelId, defaultModelId } = useChatModels();
  const { override: thinkingLevelOverride } = useChatThinking();
  const { factoryId, draftSessionId } = useParams<{ factoryId: string; draftSessionId: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return ({ prompt, files }: { prompt: string; files: PendingImage[] }) => {
    const projectRepositoryId = factorySessionState?.projectRepositoryId;
    if (!draftSessionId || !factoryId || !projectRepositoryId) {
      throw new Error('Could not create the session. Reload the page and try again.');
    }
    if (!activeModelId) {
      throw new Error('Session configuration is not ready. Try again.');
    }

    const draftKeepsServerDefaults = activeModelId === defaultModelId && !thinkingLevelOverride;
    const handoffModelId = draftKeepsServerDefaults ? undefined : activeModelId;
    const sessionKey = queryKeys.userSession(draftSessionId);
    // A retry must read as pending on the thread route, not as the last failure.
    if (queryClient.getQueryState(sessionKey)?.status === 'error') {
      queryClient.removeQueries({ queryKey: sessionKey, exact: true });
    }
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
          throw new DraftSessionCreateError(`Could not create the session: ${message}. Try again.`, { cause: error });
        }
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
        return session;
      },
    });
    stashHandoffFiles(draftSessionId, files);
    void navigate(`/factories/${factoryId}/user/threads/${draftSessionId}`, {
      replace: true,
      state: promptHandoffState(prompt, {
        modelId: handoffModelId,
        thinkingLevel: thinkingLevelOverride,
      }),
    });
  };
}

interface FailedDraftState {
  failedDraftPrompt: string;
  failedDraftError: string;
}

function readStateString(state: unknown, key: keyof FailedDraftState): string | undefined {
  if (typeof state !== 'object' || state === null || !(key in state)) return undefined;
  const value: unknown = Reflect.get(state, key);
  return typeof value === 'string' ? value : undefined;
}

/**
 * On a thread opened from a draft whose session failed to start, returns to
 * the draft with its prompt. True while that redirect is pending.
 */
export function useReturnToDraftOnCreateFailure(error: Error | undefined): boolean {
  const location = useLocation();
  const navigate = useNavigate();
  const { factoryId, threadId } = useParams<{ factoryId: string; threadId: string }>();
  const prompt = readHandoffPrompt(location.state);
  const returning = error instanceof DraftSessionCreateError && prompt !== undefined && Boolean(factoryId && threadId);

  useEffect(() => {
    if (!returning || prompt === undefined || !error) return;
    const state: FailedDraftState = { failedDraftPrompt: prompt, failedDraftError: error.message };
    void navigate(`/factories/${factoryId}/user/new/${threadId}`, { replace: true, state });
  }, [error, factoryId, navigate, prompt, returning, threadId]);

  return returning;
}

/** Puts a prompt (and its images) whose session failed to start back in the draft composer. */
export function useRestoreFailedDraft(enabled: boolean): void {
  const location = useLocation();
  const navigate = useNavigate();
  const { draftSessionId } = useParams<{ draftSessionId: string }>();
  const { prefillComposer } = useChatCommands();
  const { setImages } = useComposerImagesState();
  const { pushNotice } = useChatTranscript();
  const prompt = enabled ? readStateString(location.state, 'failedDraftPrompt') : undefined;
  const failure = readStateString(location.state, 'failedDraftError');

  const restore = useEffectEvent((restoredPrompt: string, sessionId: string) => {
    prefillComposer(restoredPrompt);
    const files = takeHandoffFiles(sessionId);
    if (files.length > 0) setImages(current => [...files, ...current]);
    pushNotice(failure ?? 'Could not create the session. Try again.', 'error');
    // Clear the state so a reload or later render does not restore it over new edits.
    void navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
  });

  useEffect(() => {
    if (prompt !== undefined && draftSessionId) restore(prompt, draftSessionId);
  }, [draftSessionId, prompt]);
}
