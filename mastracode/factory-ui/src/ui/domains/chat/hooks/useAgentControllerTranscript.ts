import type { AgentControllerEvent, MastraDBMessage } from '@mastra/client-js';
import { useCallback, useReducer } from 'react';

import { createInitialTranscript, createLocalMessageId, transcriptReducer } from '../services/transcript';
import type { OutgoingFile } from '../services/transcript';

export function useAgentControllerTranscript({
  initialThreadId,
  initialMessages,
  viewerId,
}: {
  initialThreadId?: string;
  initialMessages?: MastraDBMessage[];
  viewerId?: string;
} = {}) {
  const [transcript, dispatch] = useReducer(transcriptReducer, undefined, () =>
    createInitialTranscript({
      messages: initialMessages,
      threadId: initialThreadId,
    }),
  );
  const [initialHistoryReady, markInitialHistoryReady] = useReducer(
    () => true,
    !initialThreadId || initialMessages !== undefined,
  );

  const reset = useCallback((threadId?: string) => {
    dispatch({
      type: 'reset',
      threadId,
    });
  }, []);

  const onEvent = useCallback(
    (event: AgentControllerEvent) => {
      dispatch({ type: 'event', event, viewerId });
    },
    [viewerId],
  );

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
