import type { AgentControllerMessage } from '@mastra/client-js';
import { useReducer } from 'react';
import type { ReactNode } from 'react';

import { useAgentControllerTranscript } from '../hooks/useAgentControllerTranscript';
import { initialChatRuntime, runtimeReducer } from '../services/runtime';
import type { ChatRuntimeState } from '../services/runtime';
import { ChatConnectionProvider } from './ChatConnectionProvider';
import { ChatRuntimeContext } from './ChatRuntimeContext';
import { ChatTranscriptContext } from './ChatTranscriptContext';
import type { ChatTranscriptApi } from './ChatTranscriptContext';
import { useChatConnection } from './useChatConnection';

export function ChatTranscriptProvider({ children, initialMessages }: { children: ReactNode; initialMessages?: AgentControllerMessage[] }) {
  const transcriptApi = useAgentControllerTranscript({ initialMessages });
  const [runtime, dispatchRuntime] = useReducer(runtimeReducer, initialChatRuntime);
  const onEvent = (event: Parameters<typeof transcriptApi.onEvent>[0]) => {
    transcriptApi.onEvent(event);
    dispatchRuntime(event);
  };

  return (
    <ChatConnectionProvider onEvent={onEvent}>
      <ChatRuntimeValueProvider runtime={runtime}>
        <ChatTranscriptValueProvider transcriptApi={transcriptApi}>{children}</ChatTranscriptValueProvider>
      </ChatRuntimeValueProvider>
    </ChatConnectionProvider>
  );
}

function ChatRuntimeValueProvider({ children, runtime }: { children: ReactNode; runtime: ChatRuntimeState }) {
  const { state } = useChatConnection();
  return (
    <ChatRuntimeContext.Provider
      value={{
        usage: runtime.usage ?? state?.tokenUsage,
        followUpCount: runtime.followUpCount,
        omProgress: runtime.omProgress ?? state?.omProgress,
        omPhase: runtime.omPhase,
        goal: runtime.goal,
        tokensPerSec: runtime.tokensPerSec,
      }}
    >
      {children}
    </ChatRuntimeContext.Provider>
  );
}

function ChatTranscriptValueProvider({
  children,
  transcriptApi,
}: {
  children: ReactNode;
  transcriptApi: ReturnType<typeof useAgentControllerTranscript>;
}) {
  const { transcript, localUser, resolvePrompt, pushNotice } = transcriptApi;
  const busy = transcript.running || transcript.pending;
  const lastEntry = transcript.entries.at(-1);
  const showWorkingIndicator = busy && !(lastEntry?.kind === 'message' && lastEntry.streaming);

  const transcriptValue: ChatTranscriptApi = {
    transcript,
    busy,
    showWorkingIndicator,
    localUser,
    resolvePrompt,
    pushNotice,
  };

  return <ChatTranscriptContext.Provider value={transcriptValue}>{children}</ChatTranscriptContext.Provider>;
}
