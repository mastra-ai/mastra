import type { AgentControllerEvent, MastraDBMessage } from '@mastra/client-js';
import { useReducer, useRef } from 'react';

import { createInitialTranscript, transcriptReducer } from '../services/transcript';
import type { OutgoingFile, TranscriptState, UsageSnapshot } from '../services/transcript';

export interface SessionStateSnapshot {
  tokenUsage?: UsageSnapshot;
}

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
      usage: initialState?.tokenUsage,
    }),
  );
  const transcriptRef = useRef<TranscriptState>(transcript);
  transcriptRef.current = transcript;

  const reset = (threadId?: string, state?: SessionStateSnapshot) => {
    dispatch({
      type: 'reset',
      threadId,
      usage: state?.tokenUsage,
    });
  };

  const onEvent = (event: AgentControllerEvent) => {
    dispatch({ type: 'event', event });
  };

  const localUser = (text: string, steer?: boolean, files?: OutgoingFile[]) => {
    dispatch({ type: 'localUser', text, steer, files });
  };

  const resolvePrompt = (id: string) => {
    dispatch({ type: 'resolvePrompt', id });
  };

  const clearPending = () => {
    dispatch({ type: 'clearPending' });
  };

  const pushNotice = (text: string, level: 'info' | 'error' = 'info') => {
    dispatch({ type: 'localNotice', text, level });
  };

  const mergeWindow = (messages: MastraDBMessage[]) => {
    dispatch({ type: 'mergeWindow', messages });
  };

  return {
    transcript,
    transcriptRef,
    reset,
    onEvent,
    localUser,
    resolvePrompt,
    clearPending,
    pushNotice,
    mergeWindow,
  };
}
