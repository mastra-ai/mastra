import type { AgentControllerEvent, AgentControllerMessage, AgentControllerOMProgress } from '@mastra/client-js';
import { useReducer, useRef } from 'react';

import { createInitialTranscript, transcriptReducer } from '../services/transcript';
import type { OutgoingFile, TranscriptState, UsageSnapshot } from '../services/transcript';

export interface SessionStateSnapshot {
  omProgress?: AgentControllerOMProgress;
  tokenUsage?: UsageSnapshot;
  /** Whether the agent is mid-run per the server snapshot (initial hydration). */
  running?: boolean;
}

export function useAgentControllerTranscript({
  initialThreadId,
  initialMessages,
  initialState,
}: {
  initialThreadId?: string;
  initialMessages?: AgentControllerMessage[];
  initialState?: SessionStateSnapshot;
} = {}) {
  const [transcript, dispatch] = useReducer(transcriptReducer, undefined, () =>
    createInitialTranscript({
      messages: initialMessages,
      threadId: initialThreadId,
      omProgress: initialState?.omProgress,
      usage: initialState?.tokenUsage,
      running: initialState?.running,
    }),
  );
  const transcriptRef = useRef<TranscriptState>(transcript);
  transcriptRef.current = transcript;

  const reset = (threadId?: string, state?: SessionStateSnapshot) => {
    dispatch({
      type: 'reset',
      threadId,
      omProgress: state?.omProgress,
      usage: state?.tokenUsage,
      running: state?.running,
    });
  };

  const syncState = (state: SessionStateSnapshot) => {
    dispatch({
      type: 'syncState',
      omProgress: state.omProgress,
      usage: state.tokenUsage,
      running: state.running,
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

  const pushNotice = (text: string, level: 'info' | 'error' = 'info') => {
    dispatch({ type: 'localNotice', text, level });
  };

  return {
    transcript,
    transcriptRef,
    reset,
    syncState,
    onEvent,
    localUser,
    resolvePrompt,
    pushNotice,
  };
}
