import type { AgentControllerEvent, AgentControllerMessage, AgentControllerOMProgress } from '@mastra/client-js';
import { useCallback, useReducer, useRef } from 'react';

import { initialTranscript, transcriptReducer } from '../services/transcript';
import type { TranscriptState, UsageSnapshot } from '../services/transcript';

interface SessionStateSnapshot {
  modeId?: string;
  modelId?: string;
  threadId?: string;
  omProgress?: AgentControllerOMProgress;
  tokenUsage?: UsageSnapshot;
}

export function useAgentControllerTranscript() {
  const [transcript, dispatch] = useReducer(transcriptReducer, initialTranscript);
  const transcriptRef = useRef<TranscriptState>(transcript);
  const hydratedThreadRef = useRef<string | undefined>(undefined);
  transcriptRef.current = transcript;

  const hydrateMessages = useCallback(
    (messages?: AgentControllerMessage[]) => {
      const current = transcriptRef.current;
      const threadId = current.threadId;
      if (!threadId || !messages) return;
      if (hydratedThreadRef.current === threadId) return;
      if (current.running || current.pending || current.entries.length > 0) return;
      hydratedThreadRef.current = threadId;
      dispatch({ type: 'hydrateMessages', messages, threadId });
    },
    [],
  );

  const resetHydration = useCallback(() => {
    hydratedThreadRef.current = undefined;
  }, []);

  const reset = useCallback((state?: SessionStateSnapshot, threadId?: string) => {
    dispatch({
      type: 'reset',
      modeId: state?.modeId,
      modelId: state?.modelId,
      threadId: threadId ?? state?.threadId,
      omProgress: state?.omProgress,
      usage: state?.tokenUsage,
    });
  }, []);

  const resetCurrentThread = useCallback((threadId?: string) => {
    const prev = transcriptRef.current;
    dispatch({ type: 'reset', threadId, modeId: prev.modeId, modelId: prev.modelId });
  }, []);

  const syncState = useCallback((state: SessionStateSnapshot) => {
    dispatch({
      type: 'syncState',
      modeId: state.modeId,
      modelId: state.modelId,
      omProgress: state.omProgress,
      usage: state.tokenUsage,
    });
  }, []);

  const onEvent = useCallback((event: AgentControllerEvent) => {
    dispatch({ type: 'event', event });
  }, []);

  const localUser = useCallback((text: string, steer?: boolean) => {
    dispatch({ type: 'localUser', text, steer });
  }, []);

  const resolvePrompt = useCallback((id: string) => {
    dispatch({ type: 'resolvePrompt', id });
  }, []);

  const pushNotice = useCallback((text: string, level: 'info' | 'error' = 'info') => {
    dispatch({ type: 'localNotice', text, level });
  }, []);

  const resetDormant = useCallback(() => {
    hydratedThreadRef.current = undefined;
    dispatch({ type: 'reset' });
  }, []);

  return {
    transcript,
    transcriptRef,
    hydrateMessages,
    resetHydration,
    reset,
    resetCurrentThread,
    syncState,
    onEvent,
    localUser,
    resolvePrompt,
    pushNotice,
    resetDormant,
  };
}
