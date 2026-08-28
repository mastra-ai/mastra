import type { AgentControllerEvent, AgentControllerSessionState, MastraDBMessage } from '@mastra/client-js';
import { useCallback, useReducer } from 'react';

import { createInitialTranscript, createLocalMessageId, transcriptReducer } from '../services/transcript';
import type { OutgoingFile } from '../services/transcript';

/** What the session-state route hydrates the status line with before the first event lands. */
export type SessionStateSnapshot = Pick<AgentControllerSessionState, 'omProgress' | 'tokenUsage'>;

/**
 * The transcript and the handles that change it. Every handle is a bare dispatch, so
 * they are pinned once: a delta then leaves the whole API identical, which is what lets
 * anything downstream skip a render.
 */
export function useAgentControllerTranscript({
  initialThreadId,
  initialMessages,
  initialState,
}: {
  initialThreadId?: string;
  initialMessages?: MastraDBMessage[];
  initialState?: SessionStateSnapshot;
} = {}) {
  const [transcript, dispatch] = useReducer(transcriptReducer, undefined, () =>
    createInitialTranscript({
      messages: initialMessages,
      threadId: initialThreadId,
      omProgress: initialState?.omProgress,
      usage: initialState?.tokenUsage,
    }),
  );
  const [initialHistoryReady, markInitialHistoryReady] = useReducer(
    () => true,
    !initialThreadId || initialMessages !== undefined,
  );

  const reset = useCallback((threadId?: string, state?: SessionStateSnapshot) => {
    dispatch({
      type: 'reset',
      threadId,
      omProgress: state?.omProgress,
      usage: state?.tokenUsage,
    });
  }, []);

  const onEvent = useCallback((event: AgentControllerEvent) => {
    dispatch({ type: 'event', event });
  }, []);

  const localUser = useCallback((text: string, steer?: boolean, files?: OutgoingFile[]) => {
    const id = createLocalMessageId();
    dispatch({ type: 'localUser', id, text, steer, files });
    return id;
  }, []);

  const failLocalUser = useCallback((id: string) => {
    dispatch({ type: 'failLocalUser', id });
  }, []);

  const resolvePrompt = useCallback((id: string) => {
    dispatch({ type: 'resolvePrompt', id });
  }, []);

  const clearPending = useCallback(() => {
    dispatch({ type: 'clearPending' });
  }, []);

  const pushNotice = useCallback((text: string, level: 'info' | 'error' = 'info') => {
    dispatch({ type: 'localNotice', text, level });
  }, []);

  const mergeWindow = useCallback((messages: MastraDBMessage[]) => {
    dispatch({ type: 'mergeWindow', messages });
    markInitialHistoryReady();
  }, []);

  return {
    transcript,
    initialHistoryReady,
    reset,
    onEvent,
    localUser,
    failLocalUser,
    resolvePrompt,
    clearPending,
    pushNotice,
    mergeWindow,
  };
}
