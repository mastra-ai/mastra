import type { AgentControllerEvent, AgentControllerMessage, AgentControllerOMProgress } from '@mastra/client-js';
import { useReducer, useRef } from 'react';

import { createInitialTranscript, transcriptReducer } from '../services/transcript';
import type { TranscriptState, UsageSnapshot } from '../services/transcript';

interface SessionStateSnapshot {
  modeId?: string;
  modelId?: string;
  omProgress?: AgentControllerOMProgress;
  tokenUsage?: UsageSnapshot;
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
  const [transcript, dispatch] = useReducer(
    transcriptReducer,
    undefined,
    () =>
      createInitialTranscript({
        messages: initialMessages,
        modeId: initialState?.modeId,
        modelId: initialState?.modelId,
        threadId: initialThreadId,
        omProgress: initialState?.omProgress,
        usage: initialState?.tokenUsage,
      }),
  );
  const transcriptRef = useRef<TranscriptState>(transcript);
  transcriptRef.current = transcript;

  const reset = (threadId?: string, state?: SessionStateSnapshot) => {
    const prev = transcriptRef.current;
    dispatch({
      type: 'reset',
      modeId: state?.modeId ?? prev.modeId,
      modelId: state?.modelId ?? prev.modelId,
      threadId,
      omProgress: state?.omProgress,
      usage: state?.tokenUsage,
    });
  };

  const syncState = (state: SessionStateSnapshot) => {
    dispatch({
      type: 'syncState',
      modeId: state.modeId,
      modelId: state.modelId,
      omProgress: state.omProgress,
      usage: state.tokenUsage,
    });
  };

  const onEvent = (event: AgentControllerEvent) => {
    dispatch({ type: 'event', event });
  };

  const localUser = (text: string, steer?: boolean) => {
    dispatch({ type: 'localUser', text, steer });
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
