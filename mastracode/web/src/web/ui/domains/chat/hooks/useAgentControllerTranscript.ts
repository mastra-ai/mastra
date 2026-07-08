import type { AgentControllerEvent, AgentControllerMessage, AgentControllerOMProgress } from '@mastra/client-js';
import { useReducer } from 'react';

import { initialTranscript, transcriptReducer } from '../services/transcript';
import type { UsageSnapshot } from '../services/transcript';

interface SessionStateSnapshot {
  modeId?: string;
  modelId?: string;
  threadId?: string;
  omProgress?: AgentControllerOMProgress;
  tokenUsage?: UsageSnapshot;
}

export interface TranscriptInit {
  state: SessionStateSnapshot;
  threadId?: string;
}

export function useAgentControllerTranscript(init?: TranscriptInit) {
  const [transcript, dispatch] = useReducer(transcriptReducer, init, initArg =>
    initArg
      ? transcriptReducer(initialTranscript, {
          type: 'reset',
          modeId: initArg.state.modeId,
          modelId: initArg.state.modelId,
          threadId: initArg.threadId ?? initArg.state.threadId,
          omProgress: initArg.state.omProgress,
          usage: initArg.state.tokenUsage,
        })
      : initialTranscript,
  );

  const hydrateMessages = (messages?: AgentControllerMessage[]) => {
    if (!messages) return;
    dispatch({ type: 'hydrateMessages', messages });
  };

  const resetHydration = () => {
    dispatch({ type: 'resetHydration' });
  };

  const reset = (state?: SessionStateSnapshot, threadId?: string) => {
    dispatch({
      type: 'reset',
      modeId: state?.modeId,
      modelId: state?.modelId,
      threadId: threadId ?? state?.threadId,
      omProgress: state?.omProgress,
      usage: state?.tokenUsage,
    });
  };

  const resetCurrentThread = (threadId?: string) => {
    dispatch({ type: 'resetThread', threadId });
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
    hydrateMessages,
    resetHydration,
    reset,
    resetCurrentThread,
    syncState,
    onEvent,
    localUser,
    resolvePrompt,
    pushNotice,
  };
}
