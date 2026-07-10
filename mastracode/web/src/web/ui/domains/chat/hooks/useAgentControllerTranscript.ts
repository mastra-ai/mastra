import type { AgentControllerEvent, AgentControllerMessage } from '@mastra/client-js';
import { useReducer } from 'react';

import { createInitialTranscript, transcriptReducer } from '../services/transcript';

export function useAgentControllerTranscript({ initialMessages }: { initialMessages?: AgentControllerMessage[] } = {}) {
  const [transcript, dispatch] = useReducer(transcriptReducer, undefined, () =>
    createInitialTranscript({ messages: initialMessages }),
  );

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
    onEvent,
    localUser,
    resolvePrompt,
    pushNotice,
  };
}
